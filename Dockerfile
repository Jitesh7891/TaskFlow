FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose API port
EXPOSE 3000

# Default command (overridden in docker-compose for worker)
CMD ["npm", "run", "dev"]
