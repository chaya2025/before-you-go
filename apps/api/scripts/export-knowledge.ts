/**
 * export-knowledge: turns the engine's rules into apps/assistant/app/data/items.json
 * (inside the Python package, so the Lambda zip carries it).
 *
 * Why this exists: the chat (apps/assistant) is Python and cannot import the
 * TypeScript engine. So we copy every engine item, with all its words and all
 * its sources, into one JSON file. The Python side embeds that file and
 * searches it. The engine stays the only place a rule is written; this file is
 * generated, never hand-edited (CONTRACT section 1).
 *
 * Run: npx tsx apps/api/scripts/export-knowledge.ts
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ALL_BLOCKERS,
  ALL_CATEGORY_RULES,
  ALL_CLOCKS,
  ALL_CONTINUOUS_CONDITIONS,
  ALL_DOCUMENTS,
  ALL_STEPS,
  ALL_VISA_PROFILES,
  type Condition,
  type SourcePart,
} from '@byg/engine';
// The about items quote the site's own words. Importing the strings (instead
// of retyping them) is what guarantees we invent nothing.
import { UI } from '../../web/src/i18n';

type Bi = { he: string; en: string };

export type KnowledgeSource = {
  citation: string | null;
  claim: string | null;
  quote: string | null;
  url: string | null;
  last_verified_at: string | null;
  certainty: string | null;
};

export type KnowledgeItem = {
  id: string;
  kind:
    | 'step'
    | 'document'
    | 'clock'
    | 'blocker'
    | 'condition'
    | 'visa_profile'
    | 'category_rule'
    | 'about';
  engine_id: string;
  general: boolean;
  title: Bi;
  text: Bi;
  applies_when_text: string;
  sources: KnowledgeSource[];
  links: string[];
};

export type Knowledge = { generated_at: string; engine_commit: string; items: KnowledgeItem[] };

// ── conditions as words ──────────────────────────────────────────────────────

const OP_WORDS: Record<string, string> = {
  eq: 'is',
  ne: 'is not',
  in: 'is one of',
  not_in: 'is not one of',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  is_known: 'is known',
  is_unknown: 'is unknown',
};

const valueText = (v: unknown): string => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

/**
 * The engine stores "who does this apply to" as a tree of conditions (data, not
 * code). Claude reads words, not trees, so we flatten it into one readable line.
 * This is context only: the engine still decides who gets which step.
 */
export function conditionText(c: Condition): string {
  if ('always' in c) return 'always';
  if ('all' in c) return `(${c.all.map(conditionText).join(' AND ')})`;
  if ('any' in c) return `(${c.any.map(conditionText).join(' OR ')})`;
  if ('not' in c) return `NOT (${conditionText(c.not)})`;
  const op = OP_WORDS[c.op] ?? c.op;
  return c.value === undefined ? `${c.field} ${op}` : `${c.field} ${op} ${valueText(c.value)}`;
}

/** "General" = true for everyone, so it may be searched with no road at all. */
const isAlways = (c: Condition | undefined): boolean => !c || 'always' in c;

// ── small text helpers ───────────────────────────────────────────────────────

/** Joins bilingual pieces line by line, skipping empty ones. */
function joinBi(parts: (Bi | string | null | undefined | false)[]): Bi {
  const he: string[] = [];
  const en: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === 'string') {
      he.push(p);
      en.push(p);
    } else {
      he.push(p.he);
      en.push(p.en);
    }
  }
  return { he: he.join('\n'), en: en.join('\n') };
}

/** A labelled line in both languages, e.g. "Fallback: ..." / "אם לא מסתדר: ...". */
const labelled = (label: Bi, body: Bi | undefined): Bi | null =>
  body ? { he: `${label.he}: ${body.he}`, en: `${label.en}: ${body.en}` } : null;

/**
 * A checklist line or note that only applies to some people. We keep the scope
 * next to the line, so Claude never tells a citizen to bring a form only
 * non-citizens need (the exact mistake the engine's `when` was added to stop).
 */
function scoped(t: Bi & { when?: Condition }, bullet = '- '): Bi {
  const suffix = t.when ? ` [only when ${conditionText(t.when)}]` : '';
  return { he: `${bullet}${t.he}${suffix}`, en: `${bullet}${t.en}${suffix}` };
}

function sourcesOf(parts: readonly SourcePart[]): KnowledgeSource[] {
  const seen = new Set<string>();
  const out: KnowledgeSource[] = [];
  for (const p of parts) {
    const s: KnowledgeSource = {
      citation: p.citation ?? null,
      claim: p.claim ?? null,
      quote: p.quote ?? null,
      url: p.url ?? null,
      last_verified_at: p.last_verified_at ?? null,
      certainty: p.certainty ?? null,
    };
    const key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

const uniq = (xs: string[]) => [...new Set(xs)];

// ── one builder per kind ─────────────────────────────────────────────────────

const L = {
  action: { he: 'מה עושים', en: 'Action' },
  checklist: { he: 'לבדוק לפני', en: 'Checklist' },
  notes: { he: 'הערות', en: 'Notes' },
  fallback: { he: 'אם לא מסתדר', en: 'Fallback' },
  cost: { he: 'עלות', en: 'Cost' },
  optional: { he: 'שלב רשות, מה הוא נותן', en: 'Optional step, what it buys' },
  links: { he: 'קישורים', en: 'Links' },
  where: { he: 'איפה', en: 'Where' },
};

function stepItem(s: (typeof ALL_STEPS)[number]): KnowledgeItem {
  const cost = s.cost
    ? joinBi([
        {
          he: `${L.cost.he}: ${s.cost.amount_ils ?? '?'}${s.cost.max_ils ? `-${s.cost.max_ils}` : ''} ₪`,
          en: `${L.cost.en}: ${s.cost.amount_ils ?? '?'}${s.cost.max_ils ? `-${s.cost.max_ils}` : ''} ILS`,
        },
        s.cost.note,
      ])
    : null;
  const text = joinBi([
    labelled(L.action, s.action),
    `${L.where.en}: ${s.channel}${s.authority ? `, ${s.authority}` : ''}; appointment: ${s.requires_appointment}; track: ${s.track}${s.lead_time_days !== undefined ? `; lead time ${s.lead_time_days} days` : ''}`,
    typeof s.act_when === 'string'
      ? s.act_when === 'start_now' && 'Start now, regardless of position'
      : `Must be done before step ${s.act_when.before}`,
    labelled(L.optional, s.optional?.buys),
    s.checklist.length > 0 && L.checklist,
    ...s.checklist.map((c) => scoped(c)),
    s.notes.length > 0 && L.notes,
    ...s.notes.map((n) => scoped(n)),
    labelled(L.fallback, s.fallback),
    cost,
    s.links.length > 0 && L.links,
    ...s.links.map((l) => ({ he: `- ${l.label.he}: ${l.url}`, en: `- ${l.label.en}: ${l.url}` })),
  ]);
  return {
    id: `step:${s.id}`,
    kind: 'step',
    engine_id: s.id,
    general: isAlways(s.applies_when),
    title: s.title,
    text,
    applies_when_text: conditionText(s.applies_when),
    sources: sourcesOf([...s.evidence, ...(s.cost?.evidence ?? [])]),
    links: uniq([
      ...s.requires_documents.map((d) => `document:${d}`),
      ...s.must_come_after.map((x) => `step:${x}`),
      ...(s.produces_document ? [`document:${s.produces_document}`] : []),
      ...s.repairs_documents.map((d) => `document:${d}`),
      ...(typeof s.act_when === 'object' ? [`step:${s.act_when.before}`] : []),
    ]),
  };
}

function documentItem(d: (typeof ALL_DOCUMENTS)[number]): KnowledgeItem {
  const text = joinBi([
    labelled({ he: 'מנפיק', en: 'Issued by' }, d.issued_by),
    `Must be original: ${d.must_be_original}; accepted by email: ${d.accepts_email}`,
    d.notes,
    labelled({ he: 'מסמך רשות, מה הוא נותן', en: 'Optional document, what it buys' }, d.optional?.buys),
    labelled({ he: 'אם אין אותו', en: 'If absent' }, d.optional?.if_absent),
    ...d.absence_variants.map((v) => scoped({ ...v.detail, when: v.when })),
    d.held_when && `Counted as held when: ${conditionText(d.held_when)}`,
    d.broken_when && `Counted as unusable when: ${conditionText(d.broken_when)}`,
  ]);
  // Reverse links: the steps that obtain or repair this document. A question
  // about "form 89" then also pulls in the step that tells you how to get one.
  const steps = ALL_STEPS.filter(
    (s) => s.produces_document === d.id || s.repairs_documents.includes(d.id),
  ).map((s) => `step:${s.id}`);
  return {
    id: `document:${d.id}`,
    kind: 'document',
    engine_id: d.id,
    general: isAlways(d.applies_when),
    title: d.name,
    text,
    applies_when_text: conditionText(d.applies_when),
    sources: sourcesOf(d.evidence),
    links: uniq(steps),
  };
}

function clockItem(c: (typeof ALL_CLOCKS)[number]): KnowledgeItem {
  return {
    id: `clock:${c.id}`,
    kind: 'clock',
    engine_id: c.id,
    general: isAlways(c.applies_when),
    title: c.name,
    text: joinBi([
      `Counts ${c.duration_days} days from: ${c.anchor}; warn ${c.warn_before_days} days before`,
      labelled({ he: 'מה קורה כשהזמן נגמר', en: 'When it runs out' }, c.on_expiry),
      c.activated_by.length > 0 && `Only starts once one of these steps is done: ${c.activated_by.join(', ')}`,
    ]),
    applies_when_text: conditionText(c.applies_when),
    sources: sourcesOf(c.evidence),
    links: uniq(c.activated_by.map((s) => `step:${s}`)),
  };
}

function blockerItem(b: (typeof ALL_BLOCKERS)[number]): KnowledgeItem {
  return {
    id: `blocker:${b.id}`,
    kind: 'blocker',
    engine_id: b.id,
    general: isAlways(b.applies_when),
    title: b.title,
    text: joinBi([
      b.explanation,
      `Legal status: ${b.legal_status}${b.expected_resolution_at ? `, expected resolution ${b.expected_resolution_at}` : ''}`,
      b.referrals.length > 0 && { he: 'למי לפנות', en: 'Who can help' },
      ...b.referrals.map((r) => ({
        he: `- ${r.name.he}${r.url ? `: ${r.url}` : ''}`,
        en: `- ${r.name.en}${r.url ? `: ${r.url}` : ''}`,
      })),
    ]),
    applies_when_text: conditionText(b.applies_when),
    sources: sourcesOf(b.evidence),
    links: [],
  };
}

function conditionItem(c: (typeof ALL_CONTINUOUS_CONDITIONS)[number]): KnowledgeItem {
  return {
    id: `condition:${c.id}`,
    kind: 'condition',
    engine_id: c.id,
    general: isAlways(c.applies_when),
    title: c.name,
    text: joinBi([
      labelled({ he: 'אם זה לא בתוקף', en: 'If it is not valid' }, c.consequence_if_invalid),
      labelled({ he: 'מה עושים', en: 'What to do' }, c.remedy),
      c.check_before.length > 0 && `Re-checked before each of these steps: ${c.check_before.join(', ')}`,
    ]),
    applies_when_text: conditionText(c.applies_when),
    sources: sourcesOf(c.evidence),
    links: uniq(c.check_before.map((s) => `step:${s}`)),
  };
}

function visaItem(v: (typeof ALL_VISA_PROFILES)[number]): KnowledgeItem {
  return {
    id: `visa_profile:${v.visa_type}`,
    kind: 'visa_profile',
    engine_id: v.visa_type,
    // A description of a visa type, not of a person: true for anyone who asks.
    general: true,
    title: v.label,
    text: joinBi([
      `Visa type: ${v.visa_type}; procedure category: ${v.nohal_category}; usually has a teudat zehut: ${v.usually_has_teudat_zehut}`,
      labelled({ he: 'המסמך המזהה', en: 'Identity document' }, v.identity_document),
      v.caveat && scoped(v.caveat, ''),
    ]),
    applies_when_text: `visa_type is ${v.visa_type}`,
    sources: sourcesOf(v.evidence),
    links: [`category_rule:${v.nohal_category}`],
  };
}

function categoryItem(r: (typeof ALL_CATEGORY_RULES)[number]): KnowledgeItem {
  return {
    id: `category_rule:${r.category}`,
    kind: 'category_rule',
    engine_id: r.category,
    general: true,
    title: r.label,
    text: joinBi([
      r.conversion_window_years !== undefined &&
        `Conversion window: ${r.conversion_window_years} years, counted from ${r.window_anchor ?? 'unknown'}`,
      r.grade_ceiling && `Licence grades available: regulations ${r.grade_ceiling.from}-${r.grade_ceiling.to}`,
      ...r.extra_requirements.map((t) => ({ he: `- ${t.he}`, en: `- ${t.en}` })),
      // A category with nothing else to say still needs non-empty text.
      { he: r.label.he, en: r.label.en },
    ]),
    applies_when_text: `nohal_category is ${r.category}`,
    sources: sourcesOf(r.evidence),
    links: [],
  };
}

// ── about items: only the site's own sentences ───────────────────────────────

function aboutItem(id: string, title: Bi, pieces: Bi[], generatedAt: string): KnowledgeItem {
  return {
    id: `about:${id}`,
    kind: 'about',
    engine_id: id,
    general: true,
    title,
    text: joinBi(pieces),
    applies_when_text: 'always',
    sources: [
      {
        citation: 'BeforeYouGo site',
        claim: null,
        quote: null,
        url: null,
        last_verified_at: generatedAt,
        certainty: null,
      },
    ],
    links: [],
  };
}

function aboutItems(generatedAt: string): KnowledgeItem[] {
  const heroTitle = { he: `${UI.hero_title.he} ${UI.hero_title_em.he}`, en: `${UI.hero_title.en} ${UI.hero_title_em.en}` };
  return [
    aboutItem('what_it_is', heroTitle, [UI.tagline, UI.hero_eyebrow, UI.hero_lede], generatedAt),
    aboutItem('not_government', UI.not_gov_title, [UI.not_gov_body, UI.hero_eyebrow], generatedAt),
    aboutItem(
      'what_you_get',
      UI.gets_kicker,
      [
        labelled(UI.get_route, UI.get_route_note)!,
        labelled(UI.get_docs, UI.get_docs_note)!,
        labelled(UI.get_first, UI.get_first_note)!,
      ],
      generatedAt,
    ),
    aboutItem(
      'how_to_start',
      UI.how_title,
      [
        UI.how_note,
        labelled(UI.beat_1, UI.beat_1_note)!,
        labelled(UI.beat_2, UI.beat_2_note)!,
        labelled(UI.beat_3, UI.beat_3_note)!,
        UI.intro,
        UI.hero_meta,
        UI.privacy,
      ],
      generatedAt,
    ),
  ];
}

// ── the whole export ─────────────────────────────────────────────────────────

export function buildKnowledge(opts: { generatedAt: string; engineCommit: string }): Knowledge {
  return {
    generated_at: opts.generatedAt,
    engine_commit: opts.engineCommit,
    items: [
      ...ALL_STEPS.map(stepItem),
      ...ALL_DOCUMENTS.map(documentItem),
      ...ALL_CLOCKS.map(clockItem),
      ...ALL_BLOCKERS.map(blockerItem),
      ...ALL_CONTINUOUS_CONDITIONS.map(conditionItem),
      ...ALL_VISA_PROFILES.map(visaItem),
      ...ALL_CATEGORY_RULES.map(categoryItem),
      ...aboutItems(opts.generatedAt),
    ],
  };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, '../../assistant/app/data/items.json');
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim();
  } catch {
    // Not in a git checkout: the file is still valid, just not traceable to a commit.
  }
  const knowledge = buildKnowledge({ generatedAt: new Date().toISOString().slice(0, 10), engineCommit: commit });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(knowledge, null, 2) + '\n', 'utf8');
  const byKind: Record<string, number> = {};
  for (const i of knowledge.items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
  console.log(`wrote ${knowledge.items.length} items to ${out}`);
  console.log(byKind);
}

// Only write the file when run directly, not when the test imports this module.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
