import { Profile } from './profile';
import { evaluate } from './evaluate';
import type { Result } from './result';
import type { IsoDate } from './dates';

/**
 * ============================================================================
 * THE AUDIT — checking the system says only things that are true of HIM
 * ============================================================================
 *
 * ⭐ the founder, 30.8:
 *   "I wanted to go over the whole site and do checks to be sure things are
 *    valid and actually work according to the rules. Some things I maybe
 *    wouldn't realize... Everything should be accurate and make sense."
 *
 * ⚠️ WHY THIS EXISTS ALONGSIDE 286 PASSING TESTS. A test proves the code did
 * what it was told. It cannot prove it was told the right thing. Every serious
 * bug in this project so far was found by a person reading real output:
 *
 *   27.8  twelve bugs, none caught by any test
 *   30.8  an answer collected and ignored (twice), and a roadmap that told one
 *         woman both to obtain her 89 and to update it, on the same page
 *
 * A version of this ran once on 27.8 and was thrown away. It is permanent now.
 * Run it with `npm run audit` from packages/engine.
 *
 * It reports two kinds of finding:
 *
 *   INVARIANT  — something that must never be true of any output, whoever is
 *                asking. A violation is a bug, not a matter of taste.
 *
 *   INERT      — an answer that changed NOTHING. Either genuinely irrelevant,
 *                or a question being collected and thrown away. Worse than not
 *                asking, because the user concludes his answer did not matter.
 */

const TODAY = '2026-08-30' as IsoDate;

type Finding = { kind: 'INVARIANT' | 'INERT'; persona: string; detail: string };

// ─────────────────────────────────────────────────────────────────────────────
// The people we check against
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAS: Record<string, Record<string, unknown>> = {
  'א/2 student, from zero': {
    visa_type: 'a2',
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'none' },
    born: '2005-03',
  },
  'ב/1 worker, converting': {
    visa_type: 'b1',
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B' },
    requested_class: 'B',
    entered_israel: '2024-01',
    born: '1990-05',
  },
  'א/5 with a teudat zehut, still capped': {
    visa_type: 'a5',
    has_teudat_zehut: true,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 9, held_class: 'B' },
    requested_class: 'B',
    entered_israel: '2023-05',
    born: '1988-11',
  },
  // ⚠️ Added 30.8 because the audit reported lived_abroad_6_months_continuous
  // as inert for everybody — which was true, and was a hole in this list rather
  // than a bug in the engine. ס' 1(ב) only bites on a RETURNING resident who is
  // converting, and nobody here was one.
  'תושב ישראל ששב, converting': {
    visa_type: 'permanent_resident',
    has_teudat_zehut: true,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 12, held_class: 'B' },
    requested_class: 'B',
    returned_to_israel: '2025-02',
    born: '1980-09',
  },
  'citizen, from zero': {
    visa_type: 'citizen',
    has_teudat_zehut: true,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'none' },
    born: '2004-07',
  },
  '⭐ the founder: mismatched 89 and an expired visa': {
    visa_type: 'a2',
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    visa_valid_now: false,
    foreign_license: { kind: 'none' },
    form_89_number: '891234567',
    form_89_passport_number: 'AB1234567',
    passport_number: 'CD7654321',
    born: '2005-03',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Invariants — must hold for everyone, always
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Every one of these was a real bug at some point, or guards the shape of
 * one. None of them is hypothetical.
 */
function invariants(persona: string, r: Result, raw: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  const add = (detail: string) => out.push({ kind: 'INVARIANT', persona, detail });

  const ids = new Set(r.roadmap.map((s) => s.step.id));
  const doneIds = new Set(r.roadmap.filter((s) => s.state === 'done').map((s) => s.step.id));

  // 1. A finished step must never hold anything up. (30.8: the 89 unblocking.)
  for (const step of r.roadmap) {
    for (const blocker of step.waiting_on) {
      if (doneIds.has(blocker)) {
        add(`${step.step.id} is waiting on ${blocker}, which is already done`);
      }
      if (!ids.has(blocker)) {
        add(`${step.step.id} is waiting on ${blocker}, which is not on his roadmap`);
      }
    }
  }

  // 2. ⭐ the founder's bug, 30.8. Never tell a man to obtain a document and to
  //    update the same document on the same page.
  const holds89 = Boolean(raw.form_89_number || raw.form_89_passport_number || raw.form_89_name_latin);
  if (holds89) {
    // ⚠️ `cv.doc_89` removed 23.9: the 89 is not on the conversion road at all.
    for (const acquire of ['fz.doc_89']) {
      const step = r.roadmap.find((s) => s.step.id === acquire);
      if (step && step.state !== 'done') {
        add(`he gave his 89 details, yet ${acquire} is "${step.state}" — told to obtain a document he holds`);
      }
    }
  }

  // 3. One route's steps must never appear on the other's road. (Fixed 27.8.)
  const track = r.diagnosis.track;
  if (track !== 'unknown') {
    for (const step of r.roadmap) {
      if (step.step.track !== 'both' && step.step.track !== track) {
        add(`${step.step.id} belongs to the ${step.step.track} route but appears on a ${track} roadmap`);
      }
    }
  }

  // 4. A step that plainly does not apply must not be shown at all.
  for (const step of r.roadmap) {
    if (step.applies === false) add(`${step.step.id} is on the roadmap with applies === false`);
  }

  // 5. Never bad news alone. Every urgent issue owes him an action and a source.
  for (const u of r.urgent) {
    if (!u.severity) add(`urgent ${u.id} has no severity, so the UI will render it as a blocker`);
    if (!u.action?.he?.trim()) add(`urgent ${u.id} states a problem with no action`);
    if (!u.evidence.length) add(`urgent ${u.id} cites nothing (hard rule 4)`);
  }

  // 6. Hard rule 4 again, on the road itself.
  for (const step of r.roadmap) {
    if (!step.step.evidence.length) add(`${step.step.id} is shown with no evidence`);
  }

  // 8. ⭐ ADDED 22.9, with the ordering chain. Eleven steps gained a declared
  //    prerequisite that day. Get one of those wrong in a circle, or hang the
  //    only root step on a condition that excludes this person, and every step
  //    on his road says "waiting on something else" — a page that tells a man
  //    there is nothing he can do, forever, and no test would have noticed.
  if (r.roadmap.length > 0 && !r.roadmap.some((s) => s.state === 'do_now' || s.state === 'done')) {
    add('every step on the road is blocked — there is nothing he can start');
  }

  // 7. ⭐ PRIVACY, checked rather than promised. No identifier he typed may
  //    come back out — a message quoting his passport number ends up in a
  //    screenshot he sends to a friend.
  const blob = JSON.stringify(r);
  for (const key of ['form_89_number', 'form_89_passport_number', 'passport_number']) {
    const value = raw[key];
    if (typeof value === 'string' && value && blob.includes(value)) {
      add(`⚠️ PRIVACY: the value of ${key} came back in the result`);
    }
  }

  // ── 8. the readiness report must not contradict the road it was read off ──
  //
  // ⚠️ The report is a SUMMARY. A summary that disagrees with the detail below
  // it is worse than no summary, because the user believes the short version.
  if (r.readiness) {
    const rd = r.readiness;
    const all = [...rd.ready, ...rd.mismatched, ...rd.missing, ...rd.unconfirmed];

    const seen = new Set<string>();
    for (const item of all) {
      if (seen.has(item.id)) add(`readiness lists ${item.id} in two buckets at once`);
      seen.add(item.id);

      if (!item.evidence.length) add(`readiness item ${item.id} cites nothing (hard rule 4)`);
      if (item.bucket !== 'ready' && !item.action?.he?.trim()) {
        add(`readiness item ${item.id} states a problem with no action`);
      }
      if (item.bucket === 'ready' && item.action) {
        add(`readiness item ${item.id} is fine and still carries a chore`);
      }
      for (const need of item.needed_for) {
        if (!ids.has(need)) add(`readiness item ${item.id} is needed for ${need}, not on his roadmap`);
        if (doneIds.has(need)) add(`readiness item ${item.id} is needed for ${need}, already done`);
      }
      if (item.resolved_by && !ids.has(item.resolved_by)) {
        add(`readiness item ${item.id} points at ${item.resolved_by}, not on his roadmap`);
      }
    }

    // ⭐ 31.8. You never tell somebody to go and obtain a document he is holding.
    for (const item of rd.mismatched) {
      if (item.action?.he.includes('השג אותו')) {
        add(`readiness tells him to OBTAIN ${item.id}, a document he is holding`);
      }
    }

    // ⭐ A document cannot be in order while a step to repair it stands unfinished.
    for (const step of r.roadmap) {
      if (step.state === 'done') continue;
      for (const id of step.step.repairs_documents) {
        if (rd.ready.some((i) => i.id === id)) {
          add(`readiness calls ${id} in order while ${step.step.id} is still waiting to repair it`);
        }
      }
      if (step.step.produces_document && rd.ready.some((i) => i.id === step.step.produces_document)) {
        add(`readiness calls ${step.step.produces_document} in hand while ${step.step.id} still says to obtain it`);
      }
    }

    if (rd.first_action) {
      const next = r.roadmap.find((s) => s.step.id === rd.first_action!.step_id);
      if (!next) add(`first_action points at ${rd.first_action.step_id}, not on his roadmap`);
      else if (next.state !== 'do_now') add(`first_action is "${next.state}", so he cannot actually do it`);
    } else if (r.roadmap.some((s) => s.state === 'do_now')) {
      add('there is an actionable step and the report names nothing to do first');
    }

    // ⚠️ 'ready' is a strong claim. It may not be made while anything is unknown.
    if (rd.verdict === 'ready' && (rd.missing.length || rd.mismatched.length || rd.unconfirmed.length)) {
      add('readiness says ready while something is missing, broken or unchecked');
    }
  } else if (!r.blocked) {
    add('an unblocked person got no readiness report');
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The inert sweep — one answer at a time
// ─────────────────────────────────────────────────────────────────────────────

/** What the USER sees. Facts are excluded: they change by definition. */
function visible(r: Result): string {
  return JSON.stringify({
    diagnosis: r.diagnosis,
    blocked: r.blocked?.blocker.id ?? null,
    urgent: r.urgent.map((u) => [u.id, u.severity, u.title.he]),
    roadmap: r.roadmap.map((s) => [s.step.id, s.state, s.waiting_on, s.documents.map((d) => d.id)]),
    clocks: r.clocks.map((c) => [c.clock.id, c.status, c.days_left]),
    standing: r.standing_conditions.map((c) => c.id),
    warnings: r.warnings.map((w) => w.field),
    // ⚠️ Added 31.8 with the report. Without this the sweep is blind to it, and
    // an answer that moves only the readiness buckets would be reported as
    // thrown away — the exact false negative this tool exists to avoid.
    readiness: r.readiness && [
      r.readiness.verdict,
      r.readiness.first_action?.step_id ?? null,
      [...r.readiness.ready, ...r.readiness.mismatched, ...r.readiness.missing, ...r.readiness.unconfirmed]
        .map((i) => [i.id, i.bucket]),
    ],
  });
}

/**
 * ⚠️ The method that found the two ignored answers on 30.8: change ONE thing
 * and diff the whole visible output. Anything that moves nothing is either
 * genuinely irrelevant to this person, or a question being thrown away.
 *
 * Expected-inert cases are listed so the report stays readable — an answer that
 * is legitimately irrelevant to THIS persona is not a finding.
 */
const VARIATIONS: { field: string; values: unknown[] }[] = [
  { field: 'visa_valid_now', values: [true, false, 'unknown'] },
  { field: 'visa_expires', values: ['2026-09', '2027-06', '2026-01'] },
  { field: 'has_record_document', values: ['yes', 'no', 'in_progress', 'origin_country_does_not_issue'] },
  { field: 'requested_class', values: ['B', 'C1', 'D'] },
  { field: 'born', values: ['2005-03', '1985-03'] },
  { field: 'passport_expires', values: ['2027-01', '2026-09'] },
  { field: 'lived_abroad_6_months_continuous', values: [true, false] },
];

function inertSweep(persona: string, base: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  for (const { field, values } of VARIATIONS) {
    const seen = new Set<string>();
    for (const value of values) {
      const profile = Profile.parse({ ...base, [field]: value });
      seen.add(visible(evaluate(profile, TODAY)));
    }
    if (seen.size === 1) {
      out.push({
        kind: 'INERT',
        persona,
        detail: `${field}: every value produced identical output (${values.map(String).join(' / ')})`,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

const findings: Finding[] = [];

for (const [name, raw] of Object.entries(PERSONAS)) {
  const result = evaluate(Profile.parse(raw), TODAY);
  findings.push(...invariants(name, result, raw));
  findings.push(...inertSweep(name, raw));
}

const broken = findings.filter((f) => f.kind === 'INVARIANT');
const inert = findings.filter((f) => f.kind === 'INERT');

console.log(`\nAUDIT · ${Object.keys(PERSONAS).length} personas · ${TODAY}\n`);

if (broken.length === 0) {
  console.log('  ✅ INVARIANTS   all hold\n');
} else {
  console.log(`  ❌ INVARIANTS   ${broken.length} broken\n`);
  for (const f of broken) console.log(`     [${f.persona}]\n       ${f.detail}`);
  console.log('');
}

console.log(`  ℹ️  INERT ANSWERS  ${inert.length}`);
console.log('     An answer that changes nothing is either irrelevant to this');
console.log('     person, or a question being thrown away. Read each one.\n');
for (const f of inert) console.log(`     [${f.persona}]\n       ${f.detail}`);

console.log('');
process.exit(broken.length > 0 ? 1 : 0);
