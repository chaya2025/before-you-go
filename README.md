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
CLAUDE.md            rules for Nick inside this folder
```

**Ignore, all automatic:** `node_modules/` (downloaded libraries), `dist/` (built site), `.git/`, `package-lock.json`, `tsconfig*.json`, `.gitignore`, `.dockerignore`. **Never share:** `.env` (the secret key).

## One request, end to end
Form (web) → `POST /api/v1/readiness` (api) → `evaluate()` reads `data/` (engine) → `buildReadiness()` → JSON back → roadmap + report on screen → `POST /api/v1/explain` → Claude writes it in plain words. If Claude is down, the site still works from the rules.

## Commands
| What | Command |
|---|---|
| Run the server | `npm run dev:api` |
| Run the website | `npm run dev:web`, then http://localhost:5173 |
| All tests | `npm test` |
| Check the rules data | `npm run audit` |

## Decisions and status
Not in this repo, on purpose. They live in Chaya's vault: `personal-os/vault/projects/ai-readiness-agent/`
- `decisions/decision-log.md`: every decision, with the why
- `status.md`: where the project is now
