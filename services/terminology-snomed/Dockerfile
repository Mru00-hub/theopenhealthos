FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci 
COPY . .
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3010/health || exit 1
CMD ["npm", "start"]
