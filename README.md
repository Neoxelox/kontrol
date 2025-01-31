# kontrol

[![Latest Release](https://img.shields.io/github/v/tag/kalisio/kontrol?sort=semver&label=latest)](https://github.com/kalisio/kontrol/releases)
[![Build Status](https://app.travis-ci.com/kalisio/kontrol.png?branch=master)](https://app.travis-ci.com/kalisio/kontrol)

**A controller that monitor and fix your Docker-based microservices infrastructure.**

kontrol is a very lightweight application you can run as a Docker container or a Docker Swarm service. It runs requests against a set of resources (containers or services) to determine whether those resources are operating normally (a.k.a. health check). Whenever a health check fails, it can launch commands against the Docker API in order to heal the infrastructure.

kontrol includes [Slack](https://slack.com/) notifications using [Incoming Webhook](https://api.slack.com/messaging/webhooks). Insert the webhook URL into your environment and enable the Slack integration. Anytime a healthcheck fails, the channel that you specified on Slack will receive a message.

## Why kontrol ?

Docker provides a built-in [healthcheck](https://docs.docker.com/engine/reference/builder/#healthcheck) for containers but it can be too much limited in some use cases. First, you will need to use a third-party tool anyway if you'd like to be notified on Slack about healthcheck failures. Second, the healing operation of Docker only consists in restarting the faulty container itself. In a complex microservices scenario this might not be sufficient as some containers depend on others to be reachable.

For instance, let imagine you have a service A using a service B, service A and B could be seen as healthy from the Docker point of view while the service B is not reachable from the service A for some reason (eg network failure, timeout, etc.). In that case it might be interesting to exhibit a healthcheck endpoint in service A providing the status of service B from the point of view of A. When that healthcheck fails in service A you should be notified and possibly the service B automatically restarted.

If you are looking for a solution to publish error logs to Slack you should better have a look to our [Slack adapter](https://github.com/kalisio/logspout-slack) for [logspout](https://github.com/gliderlabs/logspout).

## Configuring

Most of the configuration options come from [got](https://github.com/sindresorhus/got) and [dockerode](https://github.com/apocas/dockerode) powering kontrol. The exported object in the `config.js` should be structured like this:
* `docker`: the options used to initialize dockerode
* `jobs`: a map of healthcheck and notification/heal tasks to be performed, for each task identified by its key
  * `cron`: the [CRON pattern](https://github.com/kelektiv/node-cron) to schedule it
  * `delay`: the delay in milliseconds before scheduling the task
  * `notify`: optional function with the `state` (`UNHEALTHY`/`HEALED`/`NOT_HEALED`) and `error` (optional) object as input (returns the Slack message payload to be sent for notification)
  * `heal`: optional function with the `docker` object (i.e. dockerode instance) and `_` (lodash instance) as input and performing Docker commands to heal the infrastructure
  * all other options are sent to got instance for the healthcheck request

Here are the environment variables you can use to customize the behaviour:

| Variable  | Description | Defaults |
|-----------| ------------| ------------|
| `KONTROL_CONFIG_FILEPATH` | your configuration file path | `config.js` |
| `KONTROL_PORT` | the server port | `8080` |
| `KONTROL_SLACK_WEBHOOK_URL` | your Slack webhook URL |  |
| `KONTROL_SLACK_WEBHOOK_CHANNEL` | your Slack webhook channel | |
| `KONTROL_SLACK_WEBHOOK_USERNAME` | your Slack webhook username | `Kontrol` |
| `KONTROL_SLACK_WEBHOOK_ICON_URL` | your Slack webhook icon url| `https://avatars.githubusercontent.com/u/29858840?s=200&v=4` |

### Example

The default [`config.js`](./config.js) is a great example to start from. It basically checks the kontrol container itself and restart it on failure, like would Docker do. When under test mode, the kontrol container will randomly fail with a `500` status code, so that the container will restart as long as you don't kill it manually. To build and launch the example execute the following commands:
```
KONTROL_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
docker-compose build
docker-compose up
```

## Building

### Manual build 

You can build the image with the following command:

```bash
docker build -t <your-image-name> .
```

### Automatic build using Travis CI

This project is configured to use **Travis** to build and push the image on the [Kalisio's Docker Hub](https://hub.docker.com/u/kalisio/).
The built image is tagged using the `version` property in the `package.json` file.

To enable Travis to do the job, you must define the following variable in the corresponding Travis project:

| Variable  | Description |
|-----------| ------------|
| `DOCKER_USER` | your username |
| `DOCKER_PASSWORD` | your password |

## Deploying

This image is designed to be deployed using the [Kargo](https://kalisio.github.io/kargo/) project.

Check out the [compose file](https://github.com/kalisio/kargo/blob/master/deploy/kapture.yml) to have an overview on how the container is deployed.

## Contributing

Please read the [Contributing file](./.github/CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Authors

This project is sponsored by 

![Kalisio](https://s3.eu-central-1.amazonaws.com/kalisioscope/kalisio/kalisio-logo-black-256x84.png)

## License

This project is licensed under the MIT License - see the [license file](./LICENSE.md) for details
