FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY portal_controller.js server.js ./
COPY public/ ./public/

ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "server.js"]

