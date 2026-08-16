FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# The lock file is shared with Windows development. Let npm resolve optional
# platform-specific Rolldown bindings for the Linux/Alpine build environment.
RUN npm install --include=optional --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
