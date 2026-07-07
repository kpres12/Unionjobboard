FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/jobboard.db
ENV PYTHON_SERVICE_URL=http://python:8000

EXPOSE 3001

CMD ["sh", "-c", "node src/seed.js && node src/index.js"]
