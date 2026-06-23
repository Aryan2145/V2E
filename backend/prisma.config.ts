import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed-restore.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5432/orgos?schema=public",
  },
});
