# E_Office (Gafood)

Internal enterprise online document-signing & approval office system.

## Structure

- `backend/` — NestJS 11 + Prisma 6 + PostgreSQL + Redis API server (`:8080`, Swagger at `/api/docs`)
- `frontend/` — Next.js 16 (App Router) + React 19 + Tailwind CSS v4 web client (`:3000`)

## Quick Start (Local Dev)

1. Start PostgreSQL and Redis:
   ```bash
   docker compose -f backend/docker-compose.dev.yml up -d
   ```
2. Configure environment files:
   - Copy `backend/.env.example` to `backend/.env` (set `PORT=8080`).
   - Create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8080`.
3. Install dependencies, run migrations, and start both servers:
   ```bash
   cd backend && npm ci && npx prisma generate && npx prisma migrate deploy && npm run start:dev
   cd frontend && npm ci && npm run dev
   ```
4. Open `http://localhost:3000` (default bootstrap admin: `admin@gafood.local` / `admin@P@ssw0rd123`).

