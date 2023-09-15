#!/usr/bin/env node
const path = require('path')
const cors = require('cors')
const express = require('express')
const cron = require('cron')
const request = require('got')
const _ = require('lodash')
const Docker = require('dockerode')

const port = process.env.KONTROL_PORT || 8080
const config = require(process.env.KONTROL_CONFIG_FILEPATH || path.join(__dirname, 'config.js'))

let server
let jobs = {}
const docker = new Docker(config.docker)

async function publishToSlack (service, body) {
  if (!process.env.KONTROL_SLACK_WEBHOOK_URL) return

  body.channel = process.env.KONTROL_SLACK_WEBHOOK_CHANNEL
  body.username = process.env.KONTROL_SLACK_WEBHOOK_USERNAME || "Kontrol"
  body.icon_url = process.env.KONTROL_SLACK_WEBHOOK_ICON_URL || "https://avatars.githubusercontent.com/u/29858840?s=200&v=4"

  try {
    await request({
      url: process.env.KONTROL_SLACK_WEBHOOK_URL,
      method: 'POST',
      body: JSON.stringify(body)
    })
  } catch (error) {
    // Allowed to fail to make healthcheck robust
    console.error(`Notification for service ${service} failed`, error)
  }
}

// Setup and launch server
function serve() {
  const app = express()
  app.use(cors()) // add CORS headers -- required

  // Healthcheck
  app.get('/healthcheck', (req, res) => {
    res.set('Content-Type', 'application/json')
    let response = {
      isRunning: true
    }
    // Expose all health states
    _.forOwn(jobs, (value, key) => {
      response[key] = value.health
    })

    // Report random errors when under test
    if (process.env.KONTROL_UNDER_TEST) return res.status(Math.random() > 0.5 ? 200 : 500).json(response)
    else return res.status(200).json(response)
  })
  // Start the server
  server = app.listen(port, () => {
    console.log('kontrol server listening at %d', port)
  })
}

// Plan all jobs
function plan() {
  for (const [key, jobOptions] of Object.entries(config.jobs)) {
    console.log(`Registering service ${key}`)
    const cronJob = new cron.CronJob(jobOptions.cron, async () => {
      let job = jobs[key]
      if (job.isRunning) {
        console.log(`Skipping scheduled service ${key} as previous one is not yet finished`)
        return
      }
      job.isRunning = true
      console.log(`Executing scheduled service ${key}`)
      job.previousHealth = job.health
      try {
        const response = await request(_.omit(jobOptions, ['cron', 'notify', 'heal', 'delay']))
        console.log(`Scheduled service ${key} okay:`, response.statusCode, response.statusMessage)
        job.health = {
          statusCode: response.statusCode,
          statusMessage: response.statusMessage
        }
        // Notify when going back to normal
        if (jobOptions.notify && _.get(job, 'previousHealth.error')) {
          console.log(`Notifying healed state for service ${key}`)
          try {
            const body = await jobOptions.notify("HEALED", null)
            await publishToSlack(key, body)
          } catch (error) {
            console.error(`Notification for service ${key} failed`, error)
          }
        }
      } catch (error) {
        console.error(`Scheduled service ${key} error`, error)
        job.health = {
          error
        }
        // Notify when entering error state
        if (jobOptions.notify && !_.get(job, 'previousHealth.error')) {
          console.log(`Notifying healthcheck failure for service ${key}`)
          try {
            const body = await jobOptions.notify("UNHEALTHY", error)
            await publishToSlack(key, body)
          } catch (error) {
            console.error(`Notification for service ${key} failed`, error)
          }
        }
        if (jobOptions.heal) {
          console.log(`Performing healing for service ${key}`)
          try {
            await jobOptions.heal(docker, _)
          } catch (error) {
            console.error(`Healing for service ${key} failed`, error)
            if (jobOptions.notify) {
              console.log(`Notifying healing failure for service ${key}`)
              try {
                const body = await jobOptions.notify("NOT_HEALED", error)
                await publishToSlack(key, body)
              } catch (error) {
                console.error(`Notification for service ${key} failed`, error)
              }
            }
          }
        }
        // Continue immediately or after a given delay
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const delay = jobOptions.delay || 0
        await wait(delay)
      }
      job.isRunning = false
    })
    jobs[key] = { cronJob, health: {} }
    // Start immediately or after a given delay
    const delay = jobOptions.delay || 0
    setTimeout(() => cronJob.start(), delay)
  }
}

process.on('SIGTERM', () => {
  console.info('SIGTERM signal received, closing now.')
  _.forOwn(jobs, value => {
    value.cronJob.stop()
  })
  server.close(() => {})
})

async function run () {
  plan()
  serve()
}

run()
