FROM node:20-alpine
# tzdata so the TZ env var (Asia/Kolkata) is honored by the OS, not just V8/ICU
RUN apk add --no-cache tzdata
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps && npx prisma generate

COPY . .
# nest build is memory-hungry and OOMs at 2GB. The build now runs on CI runners
# (16GB), not on the small EC2 box, so give V8 a 4GB heap.
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
