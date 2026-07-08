FROM node:20-alpine
# tzdata so the TZ env var (Asia/Kolkata) is honored by the OS, not just V8/ICU
RUN apk add --no-cache tzdata
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps && npx prisma generate

COPY . .
# nest build is memory-hungry; raise V8 heap so it doesn't OOM on small instances
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
