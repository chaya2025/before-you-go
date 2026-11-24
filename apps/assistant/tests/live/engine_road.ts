/**
 * Prints the real engine Result for one profile fixture, as JSON.
 *
 * WHY: the live retrieval test needs a REAL road (which ids the engine puts on
 * it), and the TS API may not be running. This calls the engine directly, the
 * same function /api/v1/readiness calls, so the ids are exactly what a live
 * user would get. Run from the repo root:
 *
 *   npx tsx apps/assistant/tests/live/engine_road.ts packages/engine/fixtures/a5-converter.json 2026-11-23
 */
import { readFileSync } from 'node:fs';
import { evaluate, Profile } from '../../../../packages/engine/src/index';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
delete raw._comment;
const today = process.argv[3] ?? new Date().toISOString().slice(0, 10);
process.stdout.write(JSON.stringify(evaluate(Profile.parse(raw), today)));
