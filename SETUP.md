# OrgOS — Layer 1 Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL running locally on port 5432

## Backend Setup

1. Create the database:
```sql
CREATE DATABASE orgos;
```

2. Configure environment:
```bash
# backend/.env is already configured for local dev
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orgos
```

3. Run migrations:
```bash
npx prisma migrate dev --name init --prefix backend/
```
Or from inside backend/:
```bash
npx prisma migrate dev --name init
```

4. Run seed:
```bash
npx prisma db seed --prefix backend/
```

5. Start backend:
```bash
npm run start:dev --prefix backend/
```
API: http://localhost:3001  
Swagger: http://localhost:3001/api/docs

## Frontend Setup

```bash
npm run dev --prefix frontend/
```
App: http://localhost:3000

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@orgos.io | Admin@123 |
| Org Admin | admin@acme.com | Admin@123 |
| HR Manager | hr@acme.com | Admin@123 |
| Employee (CEO) | ceo@acme.com | Admin@123 |
