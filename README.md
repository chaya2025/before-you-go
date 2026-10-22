# BeforeYouGo · לדעת לפני שמגיעים

Checks whether a person living in Israel without citizenship is ready for a government process before they go to the office: which documents they need, what is missing, and the steps in order. The first process covered is getting or converting an Israeli driver's licence.

**Live:** https://8mt068hzw3.execute-api.eu-central-1.amazonaws.com
(The first load after a quiet stretch can take a few seconds.)

## Features
- **Readiness check.** A short form produces a verdict (ready, or what is missing) and an ordered roadmap of the steps, each tied to the rule it comes from.
- **Plain-language summary.** An AI layer rewords the result in plain words. The verdict itself always comes from the rules; if the AI is unavailable, the site falls back to fixed text.
- **Document upload.** Upload a photo or PDF of a passport, visa or foreign licence. The fields are read automatically, the user confirms or corrects them, and the rules engine judges. Wrong or unreadable documents are refused, and fields that could not be read are flagged for manual entry.
- **Live checks.** Problems show up while the user fills in their details, for example a passport that expires before the likely test date.
- **Accounts.** Email or Google sign-in. A case is saved and resumes where the user left off. Answers that may have gone out of date are asked again.
- **Hebrew and English.**

## How it works

```
Browser (React)
   │  answers, or an uploaded document
   ▼
API (Fastify on AWS Lambda) ── validates input (Zod)
   │
   ├─► Rules engine ── pure TypeScript, no network
   │     the licence rules are stored as data and evaluated deterministically
   │
   ├─► Claude ── reads fields from documents · writes the plain-language summary
   │
   ├─► S3 (private) ── uploads go straight from the browser via short-lived signed links
   │
   └─► Supabase ── accounts, saved cases (Postgres with row-level security)
```

The rules are the source of truth. The AI never decides whether someone is eligible: it only reads documents (and the user confirms what it read) and rewords results.

## Stack
TypeScript throughout · React + Vite · Fastify · Zod · Supabase (Auth + Postgres) · AWS Lambda, API Gateway, S3, ECR · Docker · Claude API · Vitest · GitHub Actions

## Security and privacy
- Users can only read and write their own rows (Postgres row-level security).
- The document bucket is private and encrypted, with all public access blocked. Uploads use signed links that expire after 5 minutes and are capped in size.
- Document reading requires a signed-in user and has a usage limit.
- Deploys authenticate to AWS with short-lived OIDC credentials; no AWS keys are stored in GitHub.
- The browser only ever receives the public Supabase key.
- Development and tests use fake documents only.

## Repository layout
```
packages/engine/   rules engine: data model, licence rules as data, evaluation, fixtures
apps/api/          Fastify server: routes, document reading, plain-language layer, storage
apps/web/          React website
Dockerfile         single container serving the API and the built website
.github/workflows/ tests, AWS deploy, keep-alive
```

## Running locally
Requires Node 22.

```bash
npm install
cp .env.example .env          # fill in your own values
npm run dev:api               # API
npm run dev:web               # website on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm test` | all test suites (engine, API, web) |
| `npm run typecheck` | type-check every package |
| `npm run audit` | check the rules data for consistency |

## Deployment
Every push to `main` runs the tests. Only when they pass does GitHub Actions build the container, push it to Amazon ECR, switch the Lambda function to the new image and confirm the site answers.
