FROM node:20-alpine AS build

COPY . ./

RUN apk add --update curl
RUN npm install -g pnpm

RUN pnpm install
RUN pnpm build

FROM nginx:latest

COPY --from=build ./dist /usr/share/nginx/htm
