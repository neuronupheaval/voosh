FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080

RUN npm run build

FROM builder
COPY --from=builder /app/dist /app

CMD ["node", "index.js"] 
