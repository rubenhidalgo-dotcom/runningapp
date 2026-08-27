# RUN

Mobile-first training planner built with Next.js, Cloudflare Workers, and D1.

## Features

- Today, Week, Plan, and Settings views
- Editable actual kilometres when completing a workout
- Weekly actual distance updates immediately after completion
- Floating action button for unscheduled runs
- CSV plan import with completion data preserved on matching date + title
- Multiple plans in the database model
- Installable PWA with iPhone safe-area and dark-mode handling
- Placeholder for future Polar Flow integration

## Local setup

```bash
npm install
```

Create the local D1 database and apply migrations:

```bash
npm run db:local
```

Run Next.js locally:

```bash
npm run dev
```

Open http://localhost:3000. The Cloudflare dev initializer in `next.config.ts` exposes local bindings to Next.js.

## Create the production D1 database

```bash
npx wrangler login
npx wrangler d1 create runningapp-db
```

Copy the returned database ID into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`, then apply migrations:

```bash
npm run db:remote
```

## Preview and deploy

```bash
npm run preview
npm run deploy
```

Cloudflare will provide a `workers.dev` URL. Add a custom domain from the Worker settings in the Cloudflare dashboard.

## CSV format

Use `sample-plan.csv` as a template. Required fields are `date` in YYYY-MM-DD format and `title`. Import updates plan fields while preserving completion status, actual distance, completion timestamp, and workout notes because those fields are excluded from the upsert update.

## Security note

This MVP has no login. The anonymous browser ID is convenient, not secure authentication. Do not use it for sensitive/private data. Add proper authentication before opening the app to multiple people.
