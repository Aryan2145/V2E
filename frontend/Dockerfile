FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_WS_URL=http://localhost:3001
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

ARG BACKEND_URL=http://localhost:3001
ENV BACKEND_URL=$BACKEND_URL

# Single-threaded static gen (next.config cpus:1) + a modest heap so the build
# fits a small instance (pair with ~4G swap on 2-4GB boxes). NOT 8G — that OOM-
# froze the host. Bump if you move to a bigger builder.
RUN NODE_OPTIONS=--max-old-space-size=3072 npm run build

EXPOSE 3000

CMD ["npm", "start"]
