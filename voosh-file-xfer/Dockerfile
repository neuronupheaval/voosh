# Stage 1: Build the Lit-TS Vite application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY .env.production .env

# Ensure Vite builds with the correct base path for your subdirectory
RUN npm run build -- --base=/arx/

# Stage 2: This will be handled by the main Nginx container
FROM scratch
COPY --from=builder /app/dist /dist
