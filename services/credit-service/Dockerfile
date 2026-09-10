FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src/ ./src/

ENV PORT=8084
EXPOSE 8084

USER node
CMD ["node", "src/index.js"]
