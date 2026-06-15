FROM node:20-alpine
# tzdata so the TZ env var (Asia/Kolkata) is honored by the OS, not just V8/ICU
RUN apk add --no-cache tzdata
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps && npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
