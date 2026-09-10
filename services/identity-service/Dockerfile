FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src/ ./src/

ENV PORT=8082
EXPOSE 8082

USER node
CMD ["node", "src/index.js"]
