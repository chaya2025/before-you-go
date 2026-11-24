import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_BLOCKERS,
  ALL_CATEGORY_RULES,
  ALL_CLOCKS,
  ALL_CONTINUOUS_CONDITIONS,
  ALL_DOCUMENTS,
  ALL_STEPS,
  ALL_VISA_PROFILES,
} from '@byg/engine';
import { buildKnowledge, conditionText } from './export-knowledge';

/**
 * The chat may only explain what the engine says (CONTRACT, the rule above
 * everything). These tests prove the export is a faithful copy: nothing in the
 * engine is left out, nothing is doubled, nothing is unsourced, and every link
 * leads somewhere real.
 */
const knowledge = buildKnowledge({ generatedAt: '2026-11-23', engineCommit: 'test' });
const items = knowledge.items;
const ids = new Set(items.map((i) => i.id));

const countOf = (id: string) => items.filter((i) => i.id === id).length;

describe('export-knowledge', () => {
  it('has exactly one item for every engine step, document, clock and blocker', () => {
    for (const s of ALL_STEPS) expect(countOf(`step:${s.id}`), s.id).toBe(1);
    for (const d of ALL_DOCUMENTS) expect(countOf(`document:${d.id}`), d.id).toBe(1);
    for (const c of ALL_CLOCKS) expect(countOf(`clock:${c.id}`), c.id).toBe(1);
    for (const b of ALL_BLOCKERS) expect(countOf(`blocker:${b.id}`), b.id).toBe(1);
  });

  it('also covers continuous conditions, visa profiles and category rules', () => {
    for (const c of ALL_CONTINUOUS_CONDITIONS) expect(countOf(`condition:${c.id}`), c.id).toBe(1);
    for (const v of ALL_VISA_PROFILES) expect(countOf(`visa_profile:${v.visa_type}`)).toBe(1);
    for (const r of ALL_CATEGORY_RULES) expect(countOf(`category_rule:${r.category}`)).toBe(1);
  });

  it('ids are unique', () => {
    expect(ids.size).toBe(items.length);
  });

  it('every item has at least one source', () => {
    for (const i of items) expect(i.sources.length, i.id).toBeGreaterThan(0);
  });

  it('every link points at an existing item', () => {
    for (const i of items) for (const l of i.links) expect(ids.has(l), `${i.id} -> ${l}`).toBe(true);
  });

  it('every item has text in both languages', () => {
    for (const i of items) {
      expect(i.title.he.length, i.id).toBeGreaterThan(0);
      expect(i.title.en.length, i.id).toBeGreaterThan(0);
      expect(i.text.he.length, i.id).toBeGreaterThan(0);
      expect(i.text.en.length, i.id).toBeGreaterThan(0);
    }
  });

  it('a step carries its action, its checklist and its requirements as links', () => {
    const step = ALL_STEPS.find((s) => s.requires_documents.length > 0 && s.checklist.length > 0)!;
    const item = items.find((i) => i.id === `step:${step.id}`)!;
    expect(item.text.en).toContain(step.action.en);
    expect(item.text.he).toContain(step.checklist[0].he);
    expect(item.links).toContain(`document:${step.requires_documents[0]}`);
  });

  it('marks only always-true items, about items and reference tables as general', () => {
    for (const i of items) {
      if (i.kind === 'about' || i.kind === 'visa_profile' || i.kind === 'category_rule') {
        expect(i.general, i.id).toBe(true);
      }
    }
    const scoped = ALL_STEPS.find((s) => !('always' in s.applies_when))!;
    expect(items.find((i) => i.id === `step:${scoped.id}`)!.general).toBe(false);
    const always = ALL_STEPS.find((s) => 'always' in s.applies_when)!;
    expect(items.find((i) => i.id === `step:${always.id}`)!.general).toBe(true);
  });

  it('about items quote the site and are sourced to it', () => {
    const about = items.filter((i) => i.kind === 'about');
    expect(about.length).toBeGreaterThanOrEqual(3);
    for (const a of about) {
      expect(a.sources[0].citation).toBe('BeforeYouGo site');
      expect(a.sources[0].url).toBeNull();
    }
  });

  it('writes conditions as readable text', () => {
    expect(conditionText({ always: true })).toBe('always');
    expect(
      conditionText({
        all: [
          { field: 'has_teudat_zehut', op: 'eq', value: false },
          { not: { field: 'visa_type', op: 'in', value: ['a1', 'b1'] } },
        ],
      }),
    ).toBe('(has_teudat_zehut is false AND NOT (visa_type is one of [a1, b1]))');
  });

  it('the committed items.json is exactly a fresh export (no drift)', () => {
    // WHY: the chat answers from items.json, not from the engine. If someone
    // changes a rule in the engine and forgets to re-export, the chat would
    // quietly explain the OLD rule. Fix a failure here with:
    //   npx tsx apps/api/scripts/export-knowledge.ts   (then re-run python -m app.ingest)
    const here = dirname(fileURLToPath(import.meta.url));
    const file = JSON.parse(readFileSync(resolve(here, '../../assistant/app/data/items.json'), 'utf8'));
    // Same date and commit as the file, so only the CONTENT is compared.
    const fresh = buildKnowledge({ generatedAt: file.generated_at, engineCommit: file.engine_commit });
    expect(file.items).toEqual(JSON.parse(JSON.stringify(fresh.items)));
  });
});
