# Before You Go (לדעת לפני שמגיעים)

Checks whether a non-citizen resident of Israel is ready for a bureaucratic process before they show up. First process: getting or converting a driver's licence.

Live demo: https://before-you-go-4nk5.onrender.com (free tier, ~50s to wake)

## The map

```
packages/engine/     THE BRAIN. Pure logic, no internet, no screen.
  src/                 evaluate.ts, readiness.ts, domain.ts (the data shapes, Zod)
  src/data/            the licence rules, written as data
  fixtures/            fake test people
apps/api/            THE SERVER. Fastify. Validates, calls the engine, asks Claude for plain words.
  src/                 app.ts (routes), server.ts (starts it), explain.ts (Claude layer)
apps/web/            THE WEBSITE. React + Vite.
  src/                 App.tsx (which screen), api.ts (calls the server), components/ (the screens)
docs/                the POC build plan, Matan's PRD template
Dockerfile           the recipe for the container
render.yaml          how Render runs it
package.json         the 3 packages + the commands below
CLAUDE.md            local assistant config
```

**Ignore, all automatic:** `node_modules/` (downloaded libraries), `dist/` (built site), `.git/`, `package-lock.json`, `tsconfig*.json`, `.gitignore`, `.dockerignore`. **Never share:** `.env` (the secret key).

## One request, end to end
Form (web) → `POST /api/v1/readiness` (api) → `evaluate()` reads `data/` (engine) → `buildReadiness()` → JSON back → roadmap + report on screen → `POST /api/v1/explain` → plain words. With no `ANTHROPIC_API_KEY` set (the case now, D-139) that returns the fixed text from the rules and calls nothing paid. If Claude is down, the site still works from the rules.

## Commands
Needs Node 22 (the version the Dockerfile uses; at least 20.12). Run `npm install` once first.

| What | Command |
|---|---|
| Install everything | `npm install` |
| Run the server | `npm run dev:api` |
| Run the website | `npm run dev:web`, then http://localhost:5173 |
| All tests | `npm test` |
| Check the rules data | `npm run audit` |

## Decisions and status
Not in this repo, on purpose. They live in the project notes: `project-notes/`
- `decisions/decision-log.md`: every decision, with the why
- `status.md`: where the project is now
