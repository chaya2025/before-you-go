# Before You Go — POC Build Plan

**Build window:** Tue 2026-08-25 → Mon 2026-08-31. Five build days. Matan Tue 2026-09-01.
**Safety line:** Thu 2026-08-27 — a working website that gives a personal roadmap.

Scope, stack and reasoning live in the vault (`projects/ai-readiness-agent/poc-scope`). This file is the build order only.

---

## What the POC has to prove

> A person with no teudat zehut enters his status, enters his document details, and gets a personal readiness answer with what's missing and where each requirement came from. Without asking anyone.

Two things, in this order:
1. **מראה את כל הדרך** — the steps for *his* status, in order, with channels and clocks.
2. **בודק אותו מולה** — what's ready, missing, mismatched, and what to do first.

---

## Architecture

Three packages, npm workspaces, one language.

```
before-you-go/
├─ packages/engine/      ← the product. Pure TS, zero I/O, zero network.
│   ├─ schema.ts             Zod: Profile, Rule, Step, Result  (= the API contract)
│   ├─ data/rules.ts         eligibility gates + document rules
│   ├─ data/steps.ts         the roadmap steps, both tracks
│   ├─ evaluate.ts           evaluate(profile) → Result   [deterministic]
│   └─ *.test.ts             persona tests + data-integrity tests
├─ apps/api/             ← Node + TS + Fastify. Thin. Validates, calls engine, returns JSON.
└─ apps/web/             ← React + TS + Vite. Form → roadmap → readiness report.
```

**Why the engine is its own package:** it gets tested without a browser, without a server, without a mock. That's the architectural win the client/server split buys, and it's the part worth defending in an interview.

**The contract is the Zod schema.** `apps/web` and `apps/api` both import it from `engine`. One definition, no drift, types flow end to end.

**Where the AI lives:** the engine decides. The Anthropic SDK receives an already-finished `Result` and writes it in plain language. It cannot add, remove, or reverse a step. That is hard rule #3 made literal.

---

## The data model (get this right on Day 1, everything else follows)

**Profile** — what the user gives us:
`nohal_category` · `visa_type` · `has_teudat_zehut` · `age` · `entry_date` · `visa_expiry` · `foreign_licence {country, grade, issue_date, expiry_date, is_idp}` · `has_mismach_89` · `completed_steps[]`

**Rule** — one eligibility or document fact:
`id` · `applies_when` · `effect` · **`source_clause`** · **`confidence`**

**Step** — one thing he has to do:
`id` · `title_he/en` · `applies_when` · **`sequence_position`** · **`act_when`** · `channel (online | in_person | mail)` · `requires_documents[]` · `deadline_rule` · `source_clause`

**Result** — what comes back:
`eligibility {status: eligible | blocked | unsure, reasons[]}` · `roadmap[]` · `readiness {ready, missing, mismatched, first_action}` · `clocks[]` · `sources[]` · `confidence_notes[]`

`unsure` is a first-class output, not an error state. Hard rule #2.

---

## The five landmines — encode them, don't remember them

| # | Rule | Consequence of getting it wrong |
|---|---|---|
| 1 | **א/5 is eligible. 2(א)(5) is blocked.** Different fields, different routes. | Telling eligible temporary residents they can't get a licence. The worst output this system can produce. |
| 2 | **Two separate clocks.** 1 year = may keep *driving*. 5 years = conversion window stays open. | Between year 1 and 5 he may not drive but *can* still convert. Merging them loses real people their route. |
| 3 | **`has_teudat_zehut` gives the channel, not the eligibility.** א/5 holds an ID and still sits in תושב מדינת חוץ, capped by תקנות 176-181. | Deriving one axis from the other → rejection at the desk. |
| 4 | **IDP is not accepted.** National licence only. | He shows up with the wrong document. |
| 5 | **Age.** Under 24 → 6 months ליווי. | It has gone missing twice already. Put the field in on Day 1. |

Landmines 1 and 2 get named persona tests on Day 2.

---

## Day by day

### Day 1 — Tue 8/25 · Rules into data
- Scaffold: workspaces, TS, Vitest, `.gitignore`, first commit.
- Write `schema.ts` — Profile, Rule, Step, Result.
- Fill `data/steps.ts` and `data/rules.ts` from the verified mapping workbook. Both tracks (המרה + מאפס), all categories.
- Every rule carries `source_clause` and `confidence`. No exceptions — a rule with no source doesn't ship.
- **Day 1 test = data integrity**, not behaviour: every record parses against its schema, every `source_clause` is non-empty, no step references a step that doesn't exist, no cycles.

**End of day:** `npm test` green on a data file with no engine behind it yet.

### Day 2 — Wed 8/26 · The evaluator
- `evaluate(profile) → Result`. Pure function. Condition matcher, step filter, ordering by `sequence_position`, clock arithmetic.
- Five persona tests: the three fixtures **+ א/5 (must be eligible) + 2(א)(5) (must be blocked, and must say why).**
- Tiny CLI: `npm run check -- fixtures/persona-1.json` so you can read output without a UI.

**End of day:** the product works. It just has no face.

### Day 3 — Thu 8/27 · ⭐ SAFETY LINE · Wire it up
- **Morning = plumbing.** Fastify server, `POST /api/v1/readiness`, Zod-validated in and out, CORS. This is the day two services cost you something. Budget for it.
- **Afternoon = the form.** Vite + React, intake fields (status, teudat zehut, age, dates, foreign licence), POST, render the roadmap.
- Roadmap UI rule: **full map always visible, one line per step, one step open, future steps greyed — never hidden.** "אחרי הטסט אף אחד לא אמר מה השלב הבא" is a documented failure, don't reproduce it.
- **Throwaway deploy today.** Even ugly. Finding out how AWS behaves on Day 5 is how deadlines die.

**End of day:** a working website that gives a personal roadmap. You go into Shabbos with the thing existing.

### Fri 8/28 — short day. Buffer or nothing. No new scope.

### Day 4 — Sun 8/30 · Documents + cross-check
- Document detail entry, **typed not uploaded**: דרכון · אשרה · מסמך 89 · רישיון לאומי זר. (רקורד stays a yes/no question.)
- Cross-checks: expiry vs today · expiry vs remaining process duration · foreign grade vs the 176-181 ceiling · IDP rejected · under-24 ליווי.
- Documents feed the **same** roadmap — an expired visa becomes step one, not a footnote.
- Mid-process entry: he ticks what he's already done. **The gap between ticked and required is the readiness report.**

**End of day:** it knows whether he's ready.

### Day 5 — Mon 8/31 · Report + the language layer
- Readiness report view: ready / missing / mismatched / **first action**.
- Anthropic SDK layer: `Result` in, plain language out. Voice rules — state the rule and the action, never the anecdote (P21); cost is planning and progress, never a discouraging total (P22).
- **Guardrail:** the model receives a finished decision and rewrites it. It never sees the profile alone. If the API call fails, the deterministic text renders anyway — the product must work with the LLM switched off.
- Real deploy. Run all five personas through the live URL.

**End of day:** POC complete.

### Tue 9/1 — Matan.

---

## Not in the POC. If you start one of these, stop.

No login · no database · no file upload · no OCR · no RAG · no agent loop · no fees/amounts · no Hebrew/English i18n framework · no רקורד extraction.

Each of those is a written, defensible decision, not something forgotten. If Matan asks why an "AI agent" has this little AI in it: the deterministic spine ships first because false confidence in bureaucracy causes real harm, and document reading lands at MVP where it can be evaluated properly.

---

## Open, decide early

- **Deployment target.** AWS is Matan's call. Decide the exact service by Day 3 and do the throwaway deploy that day. Not Day 5.
- **Can a friend test it before 9/1?** Three confirmed test users, all of whom already completed the process. That's מדד 4 and it's a real acceptance metric — worth one message today.

## Learning-mode rule

End each day able to explain what you built and why, without notes. If something goes in that you can't defend, it comes back out. A demo you can't defend in an interview is a failed project.
