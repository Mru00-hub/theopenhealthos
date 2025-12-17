FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production || echo "No dependencies to install"

COPY . .

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

USER node

CMD ["node", "index.js"]
