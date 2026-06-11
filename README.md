# Steakz Backend

RESTful TypeScript API for the Steakz restaurant-chain MIS.

## Stack

- Node.js, Express, TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication
- Zod validation
- Nodemon + TSX for development

## Run Locally

```bash
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Default API URL: `http://localhost:4000`

Seed password for every demo account: `123456`

## Demo Accounts

| Role | Email |
|---|---|
| Admin | `admin@steakz.test` |
| Headquarter Manager | `hq@steakz.test` |
| Branch Manager | `manager@steakz.test` |
| Chef | `chef@steakz.test` |
| Cashier | `cashier@steakz.test` |
