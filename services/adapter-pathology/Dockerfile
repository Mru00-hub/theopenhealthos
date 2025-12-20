# Use lightweight Node.js Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
RUN npm install
# Copy source code
COPY . .

# Expose the service port
EXPOSE 3003

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3003/health || exit 1

# Start service
CMD ["npm", "start"]
