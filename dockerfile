FROM node:12.16-buster-slim
LABEL maintainer "<contact@kalisio.xyz>"

ENV NODE_ENV=production

# Install curl for healthechk purpose
RUN apt-get -y update && apt-get -y install curl

EXPOSE 8080

ENV HOME /kontrol
RUN mkdir ${HOME}

COPY . ${HOME}

WORKDIR ${HOME}

RUN yarn

CMD npm run start
