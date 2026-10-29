# Mindcheck

A personal CS2 journal with an English interface. Built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma 7, Zod, React Hook Form and Recharts.

## Run locally

Requirements: Node.js 22.13+ and PostgreSQL 18. All application dependencies and database data live in this project.

```sh
npm ci --cache .npm-cache
npm run db:local
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:5173. The database helper uses `C:/Program Files/PostgreSQL/18/bin` on Windows; set `PG_BIN` for another installation. It creates `.env` from `.env.example`, initializes `.data/postgres`, and starts PostgreSQL on port 55432. Existing data is preserved. Stop it with `npm run db:stop`.

Authentication uses Steam OpenID. Configure `APP_URL`, `STEAM_WEB_API_KEY`, and a dedicated service account's `STEAM_BOT_REFRESH_TOKEN` in `.env`; never commit that file or paste the token into the UI. The native local database uses trust authentication on loopback. Do not expose PostgreSQL publicly.

Alternatively, use `docker compose up -d` and set `DATABASE_URL` in `.env` to `postgresql://mindcheck:mindcheck-local@127.0.0.1:55432/mindcheck?schema=public`. Use either Docker or the native database on this port, then generate the client and apply migrations as above.

## Workflow

1. `/check-in`: record sleep, physical activity, food, substances, mental state and preparation for a selected day. Checkboxes cycle through not logged, yes and no.
2. Create a session associated with that day.
3. `/matches`: manually add, edit and delete Valve or FACEIT matches, or connect Steam match history once and synchronize recent Valve matches with one click afterward.
4. `/`: review your dashboard. `/analytics`: inspect trends, habit comparisons and correlations.

The model is `DailyLog → Session → Match`. A session retains its check-in day when games continue past midnight. Creating a session alone does not count as a completed check-in. Unanswered values stay null, distinct from false or zero.

K/D uses total kills divided by total deaths for matches with both values. Correlations pair daily state with daily average ADR, require at least three paired days and variation, and do not imply causation. Small samples are labeled.

Steam credentials are encrypted locally. Imports use the CS2 Game Coordinator for recent match details, query Valve for newer sharing codes, and read the demo header when the map is absent from metadata. A gap of more than 60 minutes starts a new session. Automatic FACEIT imports remain deferred. Manual match entry checks data shape, not competitive scoring rules.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

With the development server running, `npx tsx scripts/smoke-test.ts` checks database-backed CRUD and removes its own fixtures. It refuses to run if its reserved date (1999-12-31) is already occupied.

For production locally, stop the development server, run `npm run build`, then `npm start`.

Application routes and API handlers are in `app/`, shared UI in `components/`, data and analytics helpers in `lib/`, and the database schema and migrations in `prisma/`. The original workbook remains in the root. Previous scaffolding is preserved in `.archive/`.
# DemoParser

Mindcheck includes a local CS2 `.dem` analyzer at `/demo-parser`. It uses
`@laihoe/demoparser2` on the server and creates reports only for the SteamID64
of the authenticated Mindcheck user.

The parser separates raw demo reading, event normalization, personal metric and
impact calculation, local report storage, and UI rendering. Reports are stored
under `.data/demo-parser/` and can be exported as JSON or CSV. A Steam history
sync queues at most the newest 30 demos and analyzes them sequentially from
newest to oldest; older demos remain available through manual `.dem` upload.

Local start:

```powershell
npm install
npm run db:local
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:5173/demo-parser` after signing in with Steam. Database
startup and migration are only needed when the local Mindcheck database has not
already been prepared.
