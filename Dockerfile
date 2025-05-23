FROM node:hydrogen-alpine
WORKDIR /usr/src/app

# Override the base log level (info).
ENV NPM_CONFIG_LOGLEVEL warn

# # Install npm dependencies first (so they may be cached if dependencies don't change)
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY yarn.lock yarn.lock
COPY src src
COPY typings ./typings
#RUN yarn install --production

RUN yarn install

EXPOSE 3040

ADD start-demo.sh /usr/src/app
RUN chmod +x ./start-demo.sh
CMD ["./start-demo.sh"]