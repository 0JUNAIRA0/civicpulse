# API documentation

REST JSON API served by Next.js route handlers under `/api`. All routes except `auth/login`, `auth/register` and `areas` require a session cookie (`cp_session`), obtained from `POST /api/auth/login`.

## Conventions

- Request/response bodies are JSON (`Content-Type: application/json`), except `POST /api/uploads` (multipart).
- IDs are UUIDs. Dates are ISO 8601. Query dates use `YYYY-MM-DD`.
- Paginated responses: `{ items, page, pageSize, total, totalPages }`.
- Errors: `{ "error": { "code", "message", "fields"? } }`

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | BAD_REQUEST | Business rule violated (e.g. invalid transition) |
| 401 | UNAUTHORIZED / INVALID_CREDENTIALS | Not signed in / wrong credentials |
| 403 | FORBIDDEN / ACCOUNT_DISABLED | Not permitted for this role, department or record |
| 404 | NOT_FOUND | |
| 409 | CONFLICT | Duplicate (email, feedback) or concurrent update |
| 422 | VALIDATION_ERROR | Zod validation failed, `fields` maps field → message |
| 429 | RATE_LIMITED | Too many login / register / upload attempts |

Roles: **A** Admin · **M** Department Manager · **S** Maintenance Staff · **C** Citizen. Authorization is checked in the service layer on top of the role gate shown here.

---

## Auth & profile

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Citizen sign-up. Body `{ name, email, phone?, password, confirmPassword }`. Password: 8+ chars, upper, lower, digit. Sets session. 201 |
| POST | `/api/auth/login` | public | `{ email, password }` → `{ user, redirectTo }`, sets session cookie. Rate limited (8 / 15 min) |
| POST | `/api/auth/logout` | any | Clears session |
| GET | `/api/auth/me` | any | `{ user, permissions[] }` |
| GET | `/api/profile` | any | Current profile |
| PATCH | `/api/profile` | any | `{ name, phone?, address?, avatarUploadId? }` |
| POST | `/api/profile/password` | any | `{ currentPassword, newPassword, confirmPassword }` — revokes other sessions |

## Issues

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/api/issues` | all | Server-side list scoped to the caller (C: own, S: assigned, M: department, A: all). Query below |
| POST | `/api/issues` | C | Create. Body below. Returns `{ issue, possibleDuplicates[] }`, 201 |
| GET | `/api/issues/:id` | all | `{ issue, activity[], capabilities }`. Citizens viewing others' reports get a redacted public view; managers/staff outside scope get 403 |
| PATCH | `/api/issues/:id` | C, M, A | Reporter: `title/description/address` while SUBMITTED. Manager: `priority`, `departmentId` |
| DELETE | `/api/issues/:id` | C | Withdraw own SUBMITTED report (becomes REJECTED; history kept) |
| POST | `/api/issues/:id/verify` | M, A | `{ action: "verify", priority, note? }` · `{ action: "reject", reason }` · `{ action: "duplicate", duplicateOfId, note? }` |
| POST | `/api/issues/:id/assign` | M, A | `{ assigneeId, dueDate?, instructions?, priority? }` — staff must be active and in the issue's department; reassigning cancels the open task. 201 `{ task }` |
| POST | `/api/issues/:id/status` | M, A | `{ status, note? }` — manual transitions (back to review, reject, resolve, close, reopen). `ASSIGNED` only via `/assign`; `CLOSED` needs `issues:close`; `REJECTED` needs a note |
| POST | `/api/issues/:id/feedback` | C | Reporter only, once, after RESOLVED/CLOSED. `{ rating: 1-5, comment? }` |
| GET | `/api/issues/:id/history` | all | `{ history[], activity[] }` |
| GET | `/api/issues/duplicates` | all | `?lat&lng&category?&title?&description?&excludeId?` → similar open reports within the configured radius, scored by distance + text similarity |
| GET | `/api/issues/nearby` | all | `?lat&lng&radius=50..5000` → issues within radius (metres), nearest first, with `distance` |
| GET | `/api/issues/map` | all | Lightweight markers. Same filters as list plus `scope=all|mine` |

**List query parameters** (`GET /api/issues`)

| Param | Values |
| --- | --- |
| `q` | Search in title, description, address, reference code (case-insensitive) |
| `status` | One `issue_status` |
| `statusGroup` | `open` (submitted…in progress) or `done` (resolved, closed) |
| `category` | One `issue_category` |
| `priority` | LOW, MEDIUM, HIGH, CRITICAL or `NONE` (not set) |
| `departmentId`, `areaId` | UUID |
| `from`, `to` | `YYYY-MM-DD`, filters `created_at` (inclusive) |
| `sort` | `createdAt` (default), `updatedAt`, `priority`, `status`, `title`, `category` |
| `order` | `desc` (default) / `asc` |
| `page`, `pageSize` | default 1 / 10, max 100 |
| `mine` | `1` → only issues reported by the caller |

**Create body** (`POST /api/issues`)

```json
{
  "title": "Large pothole in front of Gulshan 2 market",
  "description": "A deep pothole about one metre wide…",
  "category": "ROAD_DAMAGE",
  "address": "Gulshan Avenue, Gulshan 2",
  "latitude": 23.7949,
  "longitude": 90.4143,
  "areaId": null,
  "imageIds": ["<upload id>"]
}
```
Validation: title 8–140, description 20–4000, 1–5 images owned by the caller and unused, latitude −90..90, longitude −180..180 **and inside the configured city bounds**. The department is chosen from the category, the area from the nearest known location, and a suspected duplicate is flagged automatically.

## Tasks

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/api/tasks` | A, M, S | S: own; M: department; A: all. `?group=active|review|done&status&q&assigneeId&page&pageSize` |
| PATCH | `/api/tasks/:id` | S (assignee) | `{ status: "IN_PROGRESS" }` starts work (issue → IN_PROGRESS). `{ status: "COMPLETED", note?, completionImageIds? }` completes; at least one completion photo is required (issue → RESOLVED) |
| POST | `/api/tasks/:id/updates` | S, M, A | `{ type: "PROGRESS"|"NOTE", message, progress?, imageIds? }` — only the assignee can post PROGRESS |
| POST | `/api/tasks/:id/review` | M, A | `{ decision: "approve", note? }` closes the issue; `{ decision: "rework", note }` sends it back (issue → IN_PROGRESS) |

## Uploads

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| POST | `/api/uploads` | all | `multipart/form-data` with `file`. JPEG/PNG/WebP (checked by magic bytes), ≤ 5 MB. 201 `{ id, url, mimeType, size }` |
| GET | `/api/uploads/:id` | all | Image bytes, private cache, sandbox CSP |

## Departments & teams

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/api/departments` | all | Active departments with manager, staff count, open/total issues. `?includeInactive=1` (admin) |
| POST | `/api/departments` | A (`departments:manage`) | `{ name, code, description?, categories[], email?, phone?, managerId? }` |
| PATCH | `/api/departments/:id` | A | Any field above plus `isActive` (blocked while open issues exist) |
| GET | `/api/departments/:id/team` | A, M (own) | Members with workload: `activeTasks, awaitingReview, completed30d, completedTotal, overdue, avgHours` |

## Users

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/api/users` | A, M | A: all; M: own department. `?q&role&departmentId&status=active|inactive&sort&order&page&pageSize` |
| POST | `/api/users` | A, M | `{ name, email, role, departmentId?, phone?, jobTitle?, password }`. Managers may only add STAFF to their own department |
| PATCH | `/api/users/:id` | A, M | A: `role, departmentId, permissions[], isActive, name, jobTitle, phone`. M: activate/deactivate own staff. Nobody can change their own role or deactivate themselves |

Grantable permissions: `issues:view_all, issues:verify, issues:close, analytics:view, departments:manage, users:manage, settings:manage`.

## Notifications

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/api/notifications` | all | `?unread=1&limit=20` → `{ items, unread }` |
| PATCH | `/api/notifications` | all | `{ ids: [uuid…] }` or `{ ids: "all" }` marks as read |
| GET | `/api/notifications/stream` | all | Server-Sent Events: `event: unread` `{ unread }` and `event: notification` (row). Reconnects automatically |

## Analytics, settings, misc

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/api/analytics` | A (or `analytics:view`), M (own dept only) | `?from&to&departmentId&heat=1` → `{ kpis, monthly, categories, statuses, priorities, departments (ranked), areas, zones, satisfaction, heat? }` |
| GET | `/api/settings` | all | Platform configuration |
| PUT | `/api/settings` | A (`settings:manage`) | Full settings object (see `settingsSchema`) |
| GET | `/api/areas` | public | Sample locations |
| GET | `/api/geocode/reverse` | any signed-in user | `?lat&lng` → `{ address }` from OpenStreetMap Nominatim; cached; 20 lookups/min per user, 1/s globally; 429 when limited, 502 if the geocoder is down |
| GET/POST | `/api/cron/reminders` | `Authorization: Bearer $CRON_SECRET` or admin | Notifies staff about tasks due within 24 h or overdue (and managers about overdue ones), once per configured interval. `{ reminded }` |

## Example session (curl)

```bash
curl -c jar -H 'content-type: application/json' \
  -d '{"email":"manager.roads@civicpulse.gov","password":"Manager@123"}' \
  http://localhost:3000/api/auth/login

curl -b jar 'http://localhost:3000/api/issues?status=SUBMITTED&sort=createdAt&order=asc&pageSize=5'

curl -b jar -H 'content-type: application/json' \
  -d '{"action":"verify","priority":"HIGH"}' \
  http://localhost:3000/api/issues/<id>/verify
```

`scripts/smoke-test.mjs` exercises the full workflow and the permission rules against a running instance.
