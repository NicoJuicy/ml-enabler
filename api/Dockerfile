FROM ubuntu:22.04

EXPOSE 2000

ENV HOME=/home/mle
WORKDIR $HOME
COPY ./ $HOME/api
WORKDIR $HOME/api

RUN apt-get update > /dev/null \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx curl git python3 > /dev/null

RUN export NODEV='18.7.0' \
    && curl "https://nodejs.org/dist/v${NODEV}/node-v${NODEV}-linux-x64.tar.gz" | tar -xzv > /dev/null \
    && cp ./node-v${NODEV}-linux-x64/bin/node /usr/bin/ \
    && ./node-v${NODEV}-linux-x64/bin/npm install -g npm

RUN npm install \
    && npm run doc \
    && cd web \
    && npm install \
    && npm run prod

RUN cp ./nginx.conf /etc/nginx/sites-enabled/default

CMD service nginx restart \
    && ./node_modules/.bin/knex migrate:latest \
    && npm start

