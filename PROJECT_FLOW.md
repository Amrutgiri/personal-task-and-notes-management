# ZenNotes — Project Flow & Functionality

A full-stack **Personal Task & Notes Management** web application (branded **ZenNotes**) built with
**Node.js + Express 5 + EJS + MongoDB (Mongoose) + Socket.IO**.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (CommonJS) |
| Web framework | Express 5 |
| View engine | EJS + `express-ejs-layouts` (master layout `views/layouts/main.ejs`) |
| Database | MongoDB via Mongoose 9 |
| Session | `express-session` + `connect-mongo` (MongoStore) + `connect-flash` |
| Realtime | Socket.IO 4 |
| File upload | Multer + `multer-storage-cloudinary` (Cloudinary CDN) |
| Push | `web-push` (VAPID) + service worker |
| Exports | `exceljs` (xlsx), CSV builder, `pdfkit` (pdf) |
| Google integration | `googleapis` (Sheets API, service account) |
| Validation | `express-validator` (server) + jQuery Validation (client) + `sanitize-html` |
| Frontend libs (CDN) | Bootstrap, jQuery, Chart.js, SweetAlert2, CKEditor 5, Feather icons, highlight.js |
| Deployment target | Standard Node server **or** Vercel serverless (`api/index.js`) |

Scripts: `npm run dev` (nodemon), `npm start`, `npm run seed:admin`.

---

## 2. Directory Structure

```
server.js              # App entry: middleware chain, routes, socket wiring
api/index.js           # Vercel serverless entry (exports app, no listen)
config/
  db.js                # Mongoose connection (MONGO_URI)
  permissions.js       # MODULES + ROLE_PERMISSIONS + normalizeRole
models/                # User, Note, Task, DailyNote, Category, Chat, Message, Subscription
routes/                # 13 routers (mounted in server.js)
controllers/           # task, dailyNote, chat, profile, export, analytics, search, notification, admin
middleware/            # auth.js (guards), upload.js (Cloudinary multer)
services/              # accessService, taskService, notificationService, googleSheetsService,
                       # exportService, cloudinaryService, emailService (+ emailTemplates)
socket/                # chatSocket.js, sessionSocket.js, presenceSocket.js
views/                 # EJS pages by feature + partials + layouts + error pages
public/                # css/, js/ (client logic), service-worker.js, uploads/
scripts/seed-admin.js  # Idempotent admin seeder
```

---

## 3. Application Boot Flow (`server.js`)

Execution order (this order defines the request lifecycle):

1. `dotenv.config()` → load `.env`
2. `connectDB()` → MongoDB connection
3. Create `http` server + `socket.io`
4. Create **Mongo session store** (`connect-mongo`)
5. If production/Vercel → `app.set('trust proxy', 1)`
6. EJS setup (`view engine`, layout `./layouts/main`)
7. Body parsers (`urlencoded`, `json`) → `method-override('_method')` → static `public/`
8. **Session middleware** (shared instance)
   - `io.engine.use(sessionMiddleware)` → Socket.IO handshake sees the same session
   - `app.set('io', io)` / `app.set('notificationService', ...)` → available inside controllers
9. **`sessionGuard`** (global single-session enforcement)
10. `connect-flash`
11. **Global locals middleware** → exposes to every view:
    - `user` (normalized role context), `permissions`, `modules`, `canAccess(moduleName)`
    - flash messages `success_msg / error_msg / error`
    - re-syncs `req.session.user.role` if the role changed in DB
12. **Route mounting** (see §5)
13. Socket handlers: `chatSocket(io)`, `sessionSocket(io)`
14. `server.listen(PORT)` only when run directly (`module.exports = app` for serverless)

> `PUT / PATCH / DELETE` are issued from HTML forms via `?_method=PUT|DELETE|PATCH`.

---

## 4. Authentication & Session Flow

### 4.1 Register / Login
```
GET  /auth/register  → form
POST /auth/register  → hash bcrypt → create User (role defaults to 'employee') → auto login
GET  /auth/login     → form
POST /auth/login     → verify bcrypt → rotate current_session_token (UUID)
                       → req.session.user + req.session.session_token
                       → emit 'force_logout' to old session room
                       → web-push notify old device
                       → redirect /dashboard
GET  /auth/logout    → destroy session → redirect /
```

### 4.1b Forgot / Reset password
```
GET  /auth/forgot-password           → form
POST /auth/forgot-password           → email required
    ├ user not found        → generic success flash (no account enumeration) → ?sent=1
    ├ SMTP configured       → store SHA-256 of a 32-byte token + 30-min expiry
    │                         → email link /auth/reset-password/<raw token> → ?sent=1
    └ SMTP NOT configured   → same token stored, but the link is rendered on screen
                              ("Dev mode" box) so it can be tested locally
GET  /auth/reset-password/:token     → validate hash + expiry → new-password form
                                       (invalid/expired → "Request a new link")
POST /auth/reset-password            → strong-password check (8+, upper/lower/digit) + match
    → bcrypt hash new password → clear reset fields
    → current_session_token = null (kills every active session)
    → delete all push Subscriptions → flash success → redirect /auth/login
```
Admins can also trigger this flow for any other user from `/admin/users` (see §7.12).
Email sending lives in `services/emailService.js` (nodemailer; `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM`).

### 4.1c Chat message push notifications (symmetric)
`socket/chatSocket.js` derives the sender from the authenticated session (never the
client-supplied `senderId`), verifies participation, and pushes a web-push notification to
**every other participant** — the code path is identical for admin → user and user → admin.
Push payload fields are defensively defaulted (`body`, `icon`) so a malformed message can
never crash delivery. The client (`public/js/notifications.js`) re-syncs its push
subscription to the server on every page load and tab focus, and the VAPID public key is
injected from the server (`<body data-vapid-public-key>`), keeping client/server keys in sync.

### 4.2 Single-session enforcement (3 layers)
1. **HTTP**: `sessionGuard` (global) compares `req.session.session_token` with `User.current_session_token`.
   Mismatch → destroy session → API requests get JSON `{code:'SESSION_EXPIRED',401}`,
   pages get redirect `/auth/login?reason=session_expired`.
2. **Socket handshake**: `sessionSocket` `io.use()` rejects with `Error('SESSION_EXPIRED')` on token mismatch;
   on connect the socket joins rooms `user:<id>` and `user:<id>:session:<token>`.
3. **Client**: `public/js/session-monitor.js` shows a SweetAlert on `?reason=session_expired`,
   patches `window.fetch` to catch `SESSION_EXPIRED` JSON, and listens for the `force_logout` socket event.

### 4.3 Guards (`middleware/auth.js`)
| Guard | Behaviour |
|---|---|
| `ensureAuthenticated` | No session → flash + redirect `/auth/login` |
| `forwardAuthenticated` | Already logged in → redirect `/dashboard` (used on `/` and auth pages) |
| `sessionGuard` | Global token validation (see above) |
| `authorizeModule(name)` | Role must have the module permission, else flash + redirect `/dashboard` |
| `authorizeRoles(...roles)` | Normalized role must match, else flash + redirect `/dashboard` |

---

## 5. Roles & Permission Model (two layers)

### Layer 1 — Module access (`config/permissions.js`)
12 modules: `dashboard, notes, tasks, kanban, analytics, search, chat, daily-notes, categories, profile, export, admin-users`

| Role | Access |
|---|---|
| **admin** | all 12 (only role with `admin-users`) |
| **manager** | 11 (everything except `admin-users`) |
| **employee** | 10 (no `analytics`, no `admin-users`) |

`normalizeRole()` maps `user`/unknown → `employee`. Enforced by `authorizeModule()` per router,
and surfaced to views as `canAccess(module)` so the sidebar/UI hides unavailable features.

### Layer 2 — Record visibility (`services/accessService.js`)
| Helper | admin/manager | employee |
|---|---|---|
| `getVisibleUserFilter()` (notes, daily-notes, categories) | `{}` → see all | `{ user: self }` → own only |
| `getTaskAccessFilter()` | `{}` → all tasks | `$or: [{createdBy: self}, {assignedTo: self}]` |
| `canManageTask()` | always true | only creator or assignee |
| `canManageUserRoles()` | admin only | false |

---

## 6. Route Map (mount → auth → purpose)

| Mount | Auth / Gate | Purpose |
|---|---|---|
| `/` | `forwardAuthenticated` | Public welcome page; logged-in users → `/dashboard` |
| `/dashboard` | `ensureAuthenticated` | Stats + recent activity + charts |
| `/auth` | public | register / login / logout |
| `/notes` | auth + `notes` | Note CRUD, soft-delete, trash/restore |
| `/categories` | auth + `categories` | User categories CRUD |
| `/tasks` | auth + `tasks` (+`kanban` for board) | Task CRUD, filters, Kanban board |
| `/daily-notes` | auth + `daily-notes` | Daily work log CRUD + Google Sheets sync + report |
| `/chat` | auth + `chat` | Chats, messages, memberships, file upload (JSON) |
| `/profile` | auth + `profile` | View/edit profile, image upload, password change |
| `/notifications` | per-route auth | Web Push subscribe/unsubscribe (JSON) |
| `/export` | auth + `export` | Download notes/daily-notes as xlsx/csv/pdf |
| `/analytics` | auth + `analytics` | Aggregated KPI/chart dashboard |
| `/search` | auth + `search` | Global search across notes/tasks/messages |
| `/admin` | auth + `admin-users` + `authorizeRoles('admin')` | User list + role update |

---

## 7. Feature Modules & Functionality

### 7.1 Dashboard (`GET /dashboard`)
- Computes role-scoped stats: active/archived/trash notes, pending vs completed work logs,
  total/done/overdue tasks (overdue = status ≠ Done and `deadline < now`).
- Recent activity: last 5 work logs, last 5 notes, last 6 tasks (populated assignee).
- Two Chart.js datasets: **tasks by status**, **productivity by priority**.

### 7.2 Notes (`/notes`) — inline logic in `routes/notes.js`
- Create / list / view / edit / soft-delete (`status: active | archived | trash`).
- Filters: text search, category, priority; file attachment via Cloudinary.
- Rich description sanitized with `sanitize-html`; CKEditor on the client.
- Trash view with **Restore** (→ active) and **Delete permanently**.
- Ownership check on view/edit/update/delete (owner or admin/manager scope).
- **Convert to Task** flow: `Note.convertedTask` ⇄ `Task.sourceNote` (see §7.3).

### 7.3 Tasks & Kanban (`/tasks`)
- List with search + status/priority/assignee filters (role-scoped by `taskService.buildTaskFilters`).
- Create/Edit: title, description, deadline, priority (`Low|Medium|High|Critical`),
  status (`Todo|In Progress|Done`), assignee, tags; `activityCount` and `completedAt` maintained.
- **Note → Task conversion**: `/tasks/add?fromNote=<id>` pre-fills the form; on save the note is
  back-linked with `convertedTask` + `taskConvertedAt`.
- **Kanban board** `/tasks/board`: 3 columns, HTML5 drag-and-drop → `PATCH /tasks/:id/status` (JSON).

### 7.4 Daily Work Log / Daily Notes (`/daily-notes`) — largest feature
- CRUD with `express-validator` rules (`date, project_name, task_title, day_start_description, status`)
  and `sanitize-html` on rich fields.
- Status enum: `Pending | Started | InProgress | Completed | Holiday`.
- List filters: today / this week / this month / custom range, status, search; **pagination (10/page)**.
- **Google Sheets two-way integration** (`googleSheetsService`, service account):
  - `POST /daily-notes/sync` — export unsynced (`is_synced:false`) rows, grouped under month headers,
    colour-coded (green = Completed, red = Pending), dedup key `Date|Project|Title`.
  - `POST /preview-import` → `POST /import` — preview then import with duplicate detection
    (user + date + project + task) and status normalization (`In Progress` → `InProgress`).
  - `POST /backfill-uids` — write Mongo `_id` back into sheet column A for existing rows.
  - `POST /settings` — per-user `googleSpreadsheetId` / `googleSheetName` (stored on User + session).
- **Summary report** `/daily-notes/report`: date-range aggregation with completed/pending/holiday counters.

### 7.5 Chat (`/chat`) — real-time
- Types: `private | group | channel` (`is_public` for channels).
- REST: list chats, fetch messages (JSON), create private/group/channel, upload file,
  add/remove member (admin-only), leave chat.
- Socket layer (`socket/chatSocket.js`):

| Event | Direction | Purpose |
|---|---|---|
| `join_chat` / `leave_chat` | client → server | Room membership |
| `send_message` | client → server | Persist Message, update `chat.last_message`, channel admin-only posting, broadcast + web-push fan-out |
| `receive_message` | server → room | Populated message to participants |
| `typing` / `stop_typing` | both | `user_typing` / `user_stop_typing` indicators |
| `error` | server → socket | Permission failure message |

- Slack-style UI: workspace sidebar, message pane, typing indicator, drag-drop upload,
  code snippets with language (`highlight.js`).

### 7.6 Categories (`/categories`)
- List/create/delete categories scoped to the current user (ownership enforced).

### 7.7 Profile (`/profile`)
- View profile (avatar, role badge, member since).
- Edit name / bio / phone + profile image upload (Cloudinary); session copy updated.
- Change password (verify current with bcrypt → re-hash).

### 7.8 Notifications (Web Push)
- Client: `public/js/notifications.js` registers the service worker, requests permission,
  `pushManager.subscribe()` with the VAPID public key, POSTs to `/notifications/subscribe`.
- Server: `notificationService.sendPushNotification(userId, payload, {sessionToken})` targets a
  specific session's subscriptions and auto-prunes dead endpoints (404/410).
- Service worker handles `push` + `notificationclick` (open/focus the target URL).

### 7.9 Export (`/export?resource=..&format=..`)
- Resources: `daily-notes`, `notes`; formats: `xlsx`, `csv`, `pdf` (whitelisted).
- Optional filters: `startDate`, `endDate`, `status`, `projectName`.
- Built by `exportService` (styled Excel, escaped CSV, paginated A4 PDF), streamed as a download.
- UI: reusable `partials/export-modal.ejs` + `public/js/export.js` (SweetAlert confirm).

### 7.10 Analytics (`/analytics`) — admin/manager only
- KPI cards: total users, total tasks, completed tasks, chat messages (role-scoped).
- Charts: completed tasks per day (last 7), productivity by priority,
  per-assignee activity (`$lookup` into users, top 6, "Unassigned" fallback).

### 7.11 Global Search (`/search?q=`)
- Parallel regex search over Notes, Tasks, Messages (limits 8/8/10), de-duplicated.
- Scoping: notes by owner filter, tasks by task-access filter, messages limited to
  participated chats or public channels.

### 7.12 Admin (`/admin`) — admin only
- `GET /admin/users` — list users (name, email, role, created date).
- `PUT /admin/users/:id/role` — change role (`admin|manager|employee`); if an admin changes their
  own role, the session copy is synced immediately.
- `POST /admin/users/:id/reset-link` — **send a password reset link to a user** (admin cannot
  target themselves; own resets go through "Forgot password"). Stores a SHA-256 token hash
  (30-min TTL), revokes the user's session and push subscriptions, then emails a branded reset
  email (`adminPasswordResetEmail`). Without SMTP configured, the link is rendered on a
  dev-mode page (`views/admin/reset-link.ejs`) with a copy button instead.

---

## 8. Data Models (Mongoose)

| Model | Key fields | Enums / notes |
|---|---|---|
| **User** | name, email (unique), password, role, profileImage, bio, phoneNumber, `current_session_token`, `googleSpreadsheetId`, `googleSheetName` | `role: admin\|manager\|employee` (default employee, normalized by hooks) |
| **Note** | title, description, tags, priority, category, user, status, isPinned, isFavorite, file, `convertedTask`, `taskConvertedAt` | `priority: Low\|Medium\|High`; `status: active\|archived\|trash` |
| **Task** | title, description, deadline, priority, status, assignedTo, createdBy, `sourceNote`, tags, activityCount, completedAt | `priority: Low\|Medium\|High\|Critical`; `status: Todo\|In Progress\|Done` |
| **DailyNote** | user, date, project_name, task_title, day_start_description, day_end_description, remarks, `is_synced`, `synced_at` | `status: Pending\|Started\|InProgress\|Completed\|Holiday` |
| **Category** | name, user | — |
| **Chat** | type, name, participants[], admins[], created_by, is_public, last_message | `type: private\|group\|channel` |
| **Message** | chat, sender, type, content, language, file_url/name/size, status, seen_by[] | `type: text\|image\|video\|file\|code`; `status: sent\|delivered\|seen` |
| **Subscription** | user, endpoint (unique), sessionToken (indexed), keys.p256dh, keys.auth | Web Push |

All models use `{ timestamps: true }`.

---

## 9. End-to-End User Flows

**A. New user**
```
/ (welcome) → /auth/register → auto-login → /dashboard
  → create Category → create Note (attachment, tag, priority)
  → open Note → "Convert to Task" → pre-filled /tasks/add → Task created
  → /tasks/board → drag card to "Done"
```

**B. Daily work log + Google Sheets**
```
/daily-notes → Add log (date, project, task, description, status)
  → Sync → POST /daily-notes/sync → Google Sheet (rows + colour formatting)
  → Import ← preview modal → confirm import (duplicates skipped)
  → /daily-notes/report → date-range summary → Print
  → Export modal → /export?resource=daily-notes&format=xlsx → download
```

**C. Real-time chat**
```
/chat → create private/group/channel → socket join_chat room
  → send_message → persisted + broadcast receive_message → web-push to offline members
  → typing indicators → file upload → admin manages members
```

**D. Session takeover / force logout**
```
Login on device B → rotate current_session_token
  → emit force_logout to device A room → device A SweetAlert → redirect to login
  → subsequent requests blocked by sessionGuard (401 JSON or redirect)
```

**E. Role change**
```
/admin/users → set role → permissions re-synced on next request
  (sessionGuard + locals middleware refresh req.session.user.role)
  → sidebar items appear/disappear via canAccess()
```

---

## 10. Setup & Run

1. Create `.env` (see keys below) — required: `MONGO_URI`, `SESSION_SECRET`, `NODE_ENV`.
2. `npm install`
3. `npm run seed:admin` — creates/updates admin `apgoswami.eww@gmail.com` / `Password@123`
4. `npm run dev` (or `npm start`) → http://localhost:5000

Environment keys used: `MONGO_URI, NODE_ENV, PORT, SESSION_SECRET, CLOUDINARY_CLOUD_NAME,
CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY,
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM`.

Password-reset email: fill the `SMTP_*` keys to send real mail; with them empty the forgot-password
page prints the reset link on screen instead (dev fallback).

Optional integrations degrade gracefully: without Cloudinary/Google/VAPID keys those features fail
at call time (uploads, sheet sync, push), while the rest of the app works.

---

## 11. Code Review Notes / Known Issues

Verified during review (53 JS files pass `node --check`; app boots and all pages return 200 when
`NODE_ENV=development`):

1. **`.env` sets `NODE_ENV=production` locally** → use `NODE_ENV=development` for local work.
2. ~~**Chat file upload URL bug**~~ — FIXED: `chatController.uploadFile` now returns
   `req.file.path` (the Cloudinary CDN URL) with an `/uploads/` fallback only for legacy rows.
3. ~~**No global 404/500 handlers**~~ — FIXED: `server.js` now has a 404 handler and a global
   error handler; browsers get the styled `views/error/404|500.ejs` pages, JSON clients and
   `/api/*` routes get JSON errors.
4. ~~**Permissive upload filter**~~ — FIXED: `checkFileType` now requires BOTH a known extension
   AND a matching mimetype (`&&` instead of `||`).
5. **`sessionGuard` runs before `flash`** — by design; redirect uses `?reason=session_expired`.
6. **Serverless caveats** — Socket.IO + Mongo session store initialize at require time (poor fit
   for cold starts); no `vercel.json` present.
7. **Admin seeder credentials are hard-coded** in `scripts/seed-admin.js` (`Password@123`) — rotate
   after first login.
8. `public/uploads/file-*.png` is committed to git; `.env` is correctly git-ignored.
9. **Push subscriptions can silently expire** (browser-side endpoints die) — the client now
   re-syncs on load/focus (§4.1c); if notifications still fail for one user, have them log in
   once and check the `subscriptions` collection for a fresh row.
