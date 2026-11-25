# CivicPulse — Smart City Infrastructure Management Platform

CivicPulse connects **citizens**, **government departments** and **maintenance teams** in one workflow to report, verify, assign, fix and close public infrastructure problems: road damage, broken streetlights, drainage, footpaths, waste and other civic assets.

```
Submitted → Under Review → Assigned → In Progress → Resolved → Closed      (+ Rejected / Duplicate)
```

Every status change is stored with the responsible user and a timestamp, and every permission is enforced on the server.

- **Live demo:** _to be added after deployment_
- **Database design:** [docs/DATABASE.md](docs/DATABASE.md)
- **API documentation:** [docs/API.md](docs/API.md)

## Demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@civicpulse.gov` | `Admin@123` |
| Department Manager (Roads & Highways) | `manager.roads@civicpulse.gov` | `Manager@123` |
| Maintenance Staff (Roads & Highways) | `staff@civicpulse.gov` | `Staff@123` |
| Citizen | `citizen@civicpulse.app` | `Citizen@123` |

The sign-in page has one-click buttons for each account. Other seeded accounts follow the same patterns: `manager.{lighting|drainage|waste|footpaths|publicworks}@civicpulse.gov`, `staff.{dept}{1-4}@civicpulse.gov`, `citizen{1-44}@civicpulse.app`.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | **Next.js 16 (App Router)**, React 19, **TypeScript** (strict) |
| Database | **PostgreSQL** via **Drizzle ORM** (typed schema, SQL migrations in `drizzle/`) |
| Auth | Custom: bcrypt password hashing + signed HS256 JWT in an `httpOnly` cookie (`jose`), DB-checked on every request |
| Authorization | Role defaults + admin-granted fine-grained permissions (`src/lib/permissions.ts`), enforced in the service layer |
| Validation | **Zod** schemas shared by client forms and API handlers |
| Styling | **Tailwind CSS v4**, custom design tokens (blue `#123B5D`, teal `#00A6A6`), dark mode |
| Charts | **Recharts** |
| Maps | **Leaflet** + React-Leaflet + OpenStreetMap tiles, `leaflet.heat` heatmap |
| File storage | Images stored in PostgreSQL (`uploads.data bytea`) — no extra service needed; validated by magic bytes, max 5 MB, resized in the browser |
| Real-time | Server-Sent Events (`/api/notifications/stream`) |
| PDF | jsPDF + autotable, generated in the browser |

## Features

**Citizens** register, report issues with photos, GPS (“Use my GPS location”) or a map pin, see live duplicate warnings for similar nearby reports, track status on a visual workflow, get real-time notifications, edit or withdraw before review, and rate the fix.

**Department managers** get a verification queue with automatic duplicate detection, verify with priority (sets an SLA due date), reject or mark duplicates, move issues between departments, assign or reassign tasks to staff (sorted by workload), send notes, review completed work (approve and close, or request rework), and manage their team.

**Maintenance staff** see their task queue and a task map, open directions, start work, post progress reports and notes with photos, and complete tasks with mandatory completion photos.

**Admins** manage users (roles, departments, extra permissions, activation), departments (create, edit, deactivate, assign manager, routing categories), monitor all issues, run analytics and configure the system (city bounds for GPS validation, duplicate radius, SLA days per priority, reminders, registration).

**Cross-cutting:** server-side search, filtering (status, category, priority, department, area, date range), sorting and pagination with debounced search; interactive map with category markers, heatmap, area filter and nearby search; analytics (KPIs, monthly trends, category, status, department-wise, average resolution time, department ranking, area/zone distribution, citizen satisfaction); notifications with live updates; activity log; automated maintenance reminders; PDF issue reports; dark mode; responsive layout; loading, empty, error and success states.

### Bonus challenges covered

Real-time notifications (SSE) · automatic duplicate detection (distance + text similarity) · heatmap · department performance ranking · citizen satisfaction analytics · automated maintenance reminders (`/api/cron/reminders`) · PDF issue reports · dark mode.

## Getting started

Requirements: Node.js 20.9+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET
npm run db:setup                # runs migrations and seeds demo data
npm run dev                     # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run db:migrate` | Apply SQL migrations in `drizzle/` |
| `npm run db:seed` | **Reset** and load demo data (destructive) |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run typecheck` / `lint` | Static checks |
| `npm run test:smoke` | 59 end-to-end API checks of the workflow and permission rules (needs a running, seeded app; `BASE_URL` optional) |

### Environment variables

| Name | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. SSL is enabled automatically for common hosts or `sslmode=require`. |
| `AUTH_SECRET` | 32+ character secret used to sign sessions (`openssl rand -base64 48`). |
| `CRON_SECRET` | Bearer token for the scheduler calling `/api/cron/reminders`. |

### Deployment (Vercel + managed PostgreSQL)

1. Create a PostgreSQL database (Neon, Supabase, Railway, RDS…).
2. Run `DATABASE_URL=… npm run db:setup` once from your machine.
3. Import the repository in Vercel and set `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`.
4. Optionally schedule `GET /api/cron/reminders` hourly with header `Authorization: Bearer $CRON_SECRET`.

## Seed data

| Item | Count |
| --- | --- |
| Roles | 4 |
| Departments | 6 |
| Issues | 176 (12 months of history, every workflow state, 8 duplicates) |
| Maintenance staff | 24 (one inactive) |
| Sample locations | 36 Dhaka areas across 5 zones |
| Citizens | 45 · plus 2 admins and 6 managers |
| Tasks / history rows / feedback | ~140 / ~850 / ~90 |

## Project structure

```
src/
  app/
    page.tsx                 Landing page
    (auth)/login, register   Public auth pages
    (app)/                   Authenticated shell (sidebar, notifications, theme)
      citizen/               Dashboard, report/new, reports
      department/            Dashboard, issues, team
      staff/                 Dashboard, tasks
      admin/                 Dashboard, analytics, issues, departments, users, settings
      issues/[id]            Shared issue details with role-specific actions
      map, notifications, profile
    api/                     REST route handlers (see docs/API.md)
  proxy.ts                   Optimistic route protection (Next.js 16 "proxy", formerly middleware)
  db/schema.ts               Drizzle schema (tables, enums, indexes, checks, relations)
  server/
    auth.ts                  Session + current user + permission helpers
    services/                Business logic and authorization (issues, tasks, departments, users, analytics…)
  lib/                       Shared constants, validation schemas, permissions, geo utils
  components/                UI, charts, maps, forms
scripts/seed.ts, smoke-test.mjs
drizzle/                     SQL migrations
```

## Security notes

- Passwords hashed with bcrypt; login is rate limited and uses constant-time comparison for unknown emails.
- Session JWT is `httpOnly`, `SameSite=Lax`, `Secure` in production. The user's role, department, permissions and active flag are re-read from the database on each request, and a `session_version` revokes old sessions after a password change, role change or deactivation.
- `proxy.ts` only does fast redirects; **every page and API handler re-checks authorization on the server.**
- Citizens can only edit/withdraw/rate their own reports; staff can only update tasks assigned to them; managers only act on their own department's issues; only users with `issues:verify` / `issues:close` can verify or close.
- Status changes go through one transition function with an allow-list and optimistic locking; history rows are append-only and withdrawals are status changes, not deletes.
- GPS is range-checked and must fall within the configured city bounds; uploads are type-checked by magic bytes, size-limited, single-use and served with a sandboxing CSP.
- Standard security headers are set in `next.config.ts`.
