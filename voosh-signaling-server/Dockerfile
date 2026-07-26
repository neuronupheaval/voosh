FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# 1. Compile TypeScript/Vite into a pure backend node bundle
RUN npm run build  

# 2. Run the compiled node build (adjust 'dist/server/index.js' based on your vite configuration)
CMD ["node", "dist/App.js"] 
