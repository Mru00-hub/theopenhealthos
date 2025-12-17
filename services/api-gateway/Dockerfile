FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production || npm install --production || echo "No dependencies"

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

USER node

CMD ["node", "index.js"]
