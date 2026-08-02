# Stage 1: Build the Lit-TS Vite application
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY .env.production .env

# Ensure Vite builds with the correct base path for your subdirectory
RUN npm run build

# Stage 2: Run nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
