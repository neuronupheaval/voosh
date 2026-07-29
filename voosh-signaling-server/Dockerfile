FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080

FROM builder
COPY /app/dist /app

CMD ["node", "index.js"] 
