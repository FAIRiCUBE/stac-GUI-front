FROM node:lts-alpine3.18 AS build-step

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run generate


FROM nginx:1-alpine-slim

COPY --from=build-step /app/.output/public /usr/share/nginx/html

# change default port to 8080
RUN apk add jq pcre-tools && \
    sed -i 's/\s*listen\s*80;/    listen 8080;/' /etc/nginx/conf.d/default.conf && \
    sed -i 's/\s*location \/ {/    location \/ {\n        try_files $uri $uri\/ \/index.html;/' /etc/nginx/conf.d/default.conf && \
    sed -i '/location \//a\
    add_header \"Access-Control-Allow-Origin\" \"*\";\n    add_header \"Access-Control-Allow-Methods\" \"GET, POST, PUT, DELETE, OPTIONS\"; \
    add_header \"Access-Control-Allow-Headers\" \"Content-Type, Authorization\";' /etc/nginx/conf.d/default.conf


EXPOSE 8080

STOPSIGNAL SIGTERM


