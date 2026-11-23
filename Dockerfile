# Self-contained image: the app plus whatever tiles are in web/public at build time.
# Build the tiles first (npm run basemap && npm run tiles), then: docker build -t bikeottawa-maps .
FROM node:24-alpine AS build
# Where the app finds the router; /brouter is proxied to the router container (see compose.yml).
ARG VITE_ROUTER_URL=/brouter
ENV VITE_ROUTER_URL=$VITE_ROUTER_URL
# Which folder of regions/ the site is built for.
ARG MAP_REGION=ottawa
ENV MAP_REGION=$MAP_REGION
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY pipeline/package.json pipeline/
RUN npm ci --workspace web
COPY regions regions
# Shared with the tile pipeline: surface groups, the pathways' length steps and the stress model.
COPY pipeline/surface-groups.json pipeline/pathway-lengths.json pipeline/stressmodel.mjs pipeline/stressmodel.d.mts pipeline/
COPY web web
RUN npm run build --workspace web

FROM nginx:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
