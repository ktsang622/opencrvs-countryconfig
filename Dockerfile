FROM node:hydrogen-alpine
WORKDIR /usr/src/app

# Override the base log level (info).
ENV NPM_CONFIG_LOGLEVEL=warn

# # Install npm dependencies first (so they may be cached if dependencies don't change)
COPY package.json package.json
COPY tsconfig.json tsconfig.json
COPY yarn.lock yarn.lock
COPY opencrvs-toolkit.tgz opencrvs-toolkit.tgz
COPY src src

# Install all dependencies (including dev) for development/production flexibility
# pino-pretty is needed when NODE_ENV !== 'production'
RUN yarn install --frozen-lockfile

EXPOSE 3040

ADD start-prod.sh /usr/src/app
RUN chmod +x ./start-prod.sh
CMD ["./start-prod.sh"]
