FROM node:18-alpine

WORKDIR /app

# Install dependencies (deterministic, skip devDependencies)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Expose API port
EXPOSE 3000

# Default command (overridden in docker-compose for worker)
CMD ["node", "server.js"]
