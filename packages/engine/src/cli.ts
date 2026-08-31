import fs from 'node:fs';
import path from 'node:path';
import { Profile } from './profile';
import { evaluate } from './evaluate';
import type { Result, RoadmapStep, ClockState } from './result';
import { attributions, CERTAINTY_META } from './certainty';

/**
 * ============================================================================
 * CLI — run a person through the engine and read the answer
 * ============================================================================
 *
 *   npm run check -- fixtures/a2-student.json
 *   npm run check -- fixtures/a5-converter.json --today 2027-01-15
 *
 * ⚠️ This is the FIRST impure code in the package, and it is deliberately at the
 * edge: it reads files and prints. The engine underneath still touches nothing.
 * That separation is what lets the rules be tested without any of this.
 *
 * ⚠️ Hebrew in a terminal renders right-to-left and copies back reversed, so the
 * full report is also written to a .txt file next to the fixture. Open that in
 * an editor. The terminal view is a summary.
 */

const GREY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

const STATE_MARK: Record<RoadmapStep['state'], string> = {
  done: '✅',
  do_now: '▶️',
  waiting_on: '⏸️',
  later: '· ',
  uncertain: '❔',
};

const CLOCK_MARK: Record<ClockState['status'], string> = {
  running: '⏳',
  expired: '⌛',
  unknown: '❔',
  not_started: '· ',
};

function report(result: Result, today: string, withSources: boolean): string {
  const L: string[] = [];
  const rule = (ch = '=') => L.push(ch.repeat(74));

  rule();
  L.push(`Before You Go · לדעת לפני שמגיעים    (נכון ל-${today})`);
  rule();

  const d = result.diagnosis;
  L.push('');
  L.push('אבחון');
  L.push(`  מסלול:     ${d.track}`);
  L.push(`  קטגוריה:   ${d.nohal_category}`);
  L.push(`  תעודת זהות: ${d.has_teudat_zehut}`);
  L.push(
    `  תקרת דרגות: ${d.grade_ceiling ? `תקנות ${d.grade_ceiling.from}-${d.grade_ceiling.to}` : 'לא מוגדר בנוהל'}`,
  );
  if (d.caveat) L.push(`\n  ⚠️  ${d.caveat.he}`);
  for (const req of d.extra_requirements) L.push(`  •  ${req.he}`);

  // ── blocked ────────────────────────────────────────────────────────────
  if (result.blocked) {
    const b = result.blocked;
    L.push('', '');
    rule('─');
    L.push(`⛔ ${b.blocker.title.he}`);
    rule('─');
    L.push('');
    L.push(b.blocker.explanation.he);
    if (b.days_to_expected_resolution !== null) {
      L.push('');
      L.push(
        b.days_to_expected_resolution >= 0
          ? `📅 צפי הכרעה בעוד ${b.days_to_expected_resolution} ימים (${b.blocker.expected_resolution_at})`
          : `📅 המועד המשוער (${b.blocker.expected_resolution_at}) חלף. יש לבדוק אם ניתן פסק דין.`,
      );
    }
    if (b.blocker.referrals.length) {
      L.push('', 'ארגונים שיכולים לעזור:');
      for (const r of b.blocker.referrals) L.push(`  · ${r.name.he}${r.url ? `  ${r.url}` : ''}`);
    }
    L.push('', 'המקורות:');
    for (const part of b.blocker.evidence) {
      const meta = CERTAINTY_META[part.certainty];
      L.push(`  ${meta.symbol} ${part.claim}`);
      if (part.citation) L.push(`     ${part.citation}`);
    }
    return L.join('\n');
  }

  // ── urgent ─────────────────────────────────────────────────────────────
  //
  // ⭐ Above the clocks and above the road, because that is the entire point of
  // an UrgentIssue: a roadmap built on a lapsed visa describes a process he
  // cannot currently start.
  //
  // ⚠️ Added 30.8. The CLI had NEVER rendered these. The ceiling and expired
  // visa issues built on 27.8 were invisible in the one tool used for reading
  // real output, which is the tool that found them in the first place. A
  // finding that cannot be seen is a finding that does not exist.
  //
  // ⚠️ the founder, 30.8: blocking and advisory must never share a heading. A visa
  // expiring in three days does not stop him going today, and printing it under
  // "deal with this first" is how a person loses the days he still had.
  const blocking = result.urgent.filter((u) => u.severity === 'blocking');
  const advisory = result.urgent.filter((u) => u.severity === 'advisory');

  const urgentBlock = (issues: typeof result.urgent, heading: string, verb: string) => {
    if (!issues.length) return;
    L.push('', '');
    rule('─');
    L.push(heading);
    rule('─');
    for (const u of issues) {
      L.push('');
      L.push(`  ${u.title.he}`);
      L.push(`     ${verb} ${u.consequence.he}`);
      L.push(`     מה לעשות:   ${u.action.he}`);
      if (withSources) {
        for (const part of u.evidence) {
          const meta = CERTAINTY_META[part.certainty];
          L.push(`     ${meta.symbol} ${part.claim}`);
          if (part.citation) L.push(`        ${part.citation}`);
        }
      }
    }
  };

  urgentBlock(blocking, `❗ לטפל בזה קודם  ·  ${blocking.length}`, 'מה זה עוצר:');
  urgentBlock(advisory, `ℹ️  כדאי לדעת — לא עוצר אותך  ·  ${advisory.length}`, 'מה זה אומר: ');

  // ── readiness ──────────────────────────────────────────────────────────
  //
  // ⭐ The answer to the question the product is named after, so it sits above
  // the clocks and above the road. Everything below it is detail.
  //
  // ⚠️ The four buckets are printed under four SEPARATE headings, for the same
  // reason blocking and advisory were split on 30.8: "we never asked about this"
  // and "you do not have this" mean completely different things to the person
  // reading, and one heading over both would make the honest one frightening.
  if (result.readiness) {
    const r = result.readiness;
    L.push('', '');
    rule('─');
    L.push(`מוכנות  ·  ${r.headline.he}`);
    rule('─');

    if (r.first_action) {
      L.push('');
      L.push(`  ⭐ הדבר הראשון לעשות:  ${r.first_action.title.he}`);
      for (const line of r.first_action.action.he.split('\n')) if (line) L.push(`        ${line}`);
      L.push(`     למה דווקא הוא:  ${r.first_action.why.he}`);
    }

    const bucket = (items: typeof r.ready, heading: string) => {
      if (!items.length) return;
      L.push('', `  ${heading}  ·  ${items.length}`);
      for (const item of items) {
        L.push(`     ${item.title.he}`);
        L.push(`        ${item.detail.he}`);
        if (item.action) {
          for (const line of item.action.he.split('\n')) if (line) L.push(`        ← ${line}`);
        }
        if (item.note) L.push(`        ${item.note.he}`);
        L.push(`        · נדרש ב: ${item.needed_for.join(', ')}`);
      }
    };

    bucket(r.mismatched, '⚠️  בידך, ולא יעבור כמו שהוא');
    bucket(r.missing, '○  עוד לא בידך');
    bucket(r.unconfirmed, '❔ לא נבדק — לא שאלנו על זה');
    bucket(r.ready, '✅ בידך ותקין');
  }

  // ── clocks ─────────────────────────────────────────────────────────────
  if (result.clocks.length) {
    L.push('', '');
    L.push('שעונים');
    for (const c of result.clocks) {
      const days =
        c.days_left === null
          ? '        '
          : c.days_left < 0
            ? `${-c.days_left} ימים אחרי`.padStart(16)
            : `עוד ${c.days_left} ימים`.padStart(16);
      L.push(`  ${CLOCK_MARK[c.status]} ${days}  ${c.clock.name.he}`);
      if (c.status === 'expired') L.push(`        ↳ ${c.clock.on_expiry.he}`);
      if (c.warning) L.push(`        ⚠️  מתקרב לסוף`);
      if (c.status === 'unknown') L.push(`        ↳ חסרה תשובה כדי להתחיל את הספירה`);
    }
  }

  // ── standing conditions ────────────────────────────────────────────────
  if (result.standing_conditions.length) {
    L.push('', '');
    L.push('⚠️  תנאים שחייבים להתקיים לאורך כל התהליך');
    L.push('   (שלב שכבר עברת יכול להתבטל בשקט אם אחד מאלה נשבר)');
    for (const c of result.standing_conditions) L.push(`  · ${c.name.he}`);
  }

  // ── roadmap ────────────────────────────────────────────────────────────
  //
  // ⭐ the founder, 2026-08-26, after reading the first version:
  //   "as a user it's very overwhelming to see a bunch of lines with the same
  //    thing... display whatever is important. On the side you could click to
  //    see the sources, and maybe you'll find five sources for one line."
  //
  // So: ONE line per fact, however many sources back it. The sources are not
  // hidden — principle 20 still holds — they are one click away instead of
  // shouting over the instruction. Here that click is `--sources`.
  L.push('', '');
  L.push(`הדרך שלך — ${result.roadmap.length} שלבים`);
  L.push('');
  for (const s of result.roadmap) {
    L.push(`${STATE_MARK[s.state]} ${s.step.title.he}`);
    // The action can run to several lines. All of it, indented.
    for (const line of s.step.action.he.split('\n')) L.push(line ? `     ${line}` : '');

    if (s.start_now) L.push(`     ⭐ להתחיל עכשיו, גם אם השלב עצמו מגיע בהמשך`);
    if (s.must_precede) L.push(`     ⭐ חייב להיעשות לפני: ${s.must_precede}`);
    if (s.waiting_on.length) L.push(`     ⏸  ממתין ל: ${s.waiting_on.join(', ')}`);
    if (s.step.fallback) L.push(`     ↩  ${s.step.fallback.he}`);

    if (s.applies === 'unknown') {
      L.push(`     ❔ לא בטוח שהשלב הזה חל עליך. כדי לדעת, צריך לענות על: ${s.missing_answers.join(', ')}`);
    }
    // ⚠️ Added 30.8. The CLI never printed the required documents at ALL, so a
    // step asking for three documents and a step asking for nine read
    // identically in the one tool used for reading real output. That is how
    // cv.attend went weeks listing three of the nine it needs.
    if (s.documents.length) {
      L.push(`     📄 להביא: ${s.documents.map((d) => d.name.he).join(" · ")}`);
      const originals = s.documents.filter((d) => d.must_be_original);
      if (originals.length) {
        L.push(`        ⚠️ במקור: ${originals.map((d) => d.name.he).join(" · ")}`);
      }
    }
    for (const check of s.checks_first) L.push(`     🔎 לפני השלב: ${check.name.he}`);
    /**
     * ⚠️ s.checklist and s.notes, NOT s.step.* — the engine has already removed
     * the lines that do not apply to this person, and the raw arrays have not.
     *
     * ⭐ Found 31.8, and it is the 30.8 lesson repeating: the CLI was printing
     * the RAW checklist, so it asked a citizen "have you booked the permit
     * appointment?" — a question scoped to people with no teudat zehut, who are
     * the only ones for whom that appointment exists. Roadmap.tsx has read the
     * filtered list since 27.8; this had not caught up.
     *
     * ⚠️ And notes were never printed here AT ALL, which is exactly how
     * cv.attend spent weeks asking for three documents of nine. A finding that
     * cannot be seen in the tool used for reading real output does not exist.
     */
    for (const note of s.notes) {
      for (const line of note.he.split('\n')) if (line) L.push(`     ${line}`);
    }
    for (const item of s.checklist) L.push(`     ☐ ${item.he}`);

    if (s.step.cost?.amount_ils !== undefined) {
      const c = s.step.cost;
      L.push(`     ₪ ${c.amount_ils}${c.max_ils ? `-${c.max_ils}` : ''}${c.note ? ` · ${c.note.he}` : ''}`);
    }
    for (const link of s.step.links) L.push(`     🔗 ${link.label.he}: ${link.url}`);

    // The sources, folded. Counted by mark so he can see at a glance what kind
    // of evidence is behind the step without reading five near-identical lines.
    const shown = attributions(s.step.evidence);
    const counts = new Map<string, number>();
    for (const part of s.step.evidence) {
      counts.set(part.certainty, (counts.get(part.certainty) ?? 0) + 1);
    }
    const badge = [...counts.entries()]
      .map(([mark, n]) => `${CERTAINTY_META[mark as keyof typeof CERTAINTY_META].symbol}${n > 1 ? `×${n}` : ''}`)
      .join(' ');
    L.push(`     📎 ${s.step.evidence.length} מקורות  ${badge}`);

    if (withSources) {
      for (const a of shown.official) {
        L.push(`        ${CERTAINTY_META[a.mark].symbol} ${a.lead_in.he ? a.lead_in.he + ' ' : ''}${a.claim}`);
        if (a.citation) L.push(`           ${a.citation}`);
        if (a.url) L.push(`           ${a.url}`);
      }
      for (const a of shown.reported) {
        L.push(`        ${CERTAINTY_META[a.mark].symbol} ${a.lead_in.he}: ${a.claim}`);
      }
    }
    L.push('');
  }

  if (result.diagnosis.unanswered.length) {
    L.push('');
    L.push(`שאלות שיחדדו את התשובה: ${result.diagnosis.unanswered.join(', ')}`);
  }
  if (result.warnings.length) {
    L.push('', '⚠️  סתירות בתשובות (לא חוסמות):');
    for (const w of result.warnings) L.push(`  · ${w.message_he}`);
  }
  return L.join('\n');
}

/** The terminal view. Latin-heavy on purpose, so RTL cannot scramble it. */
function summary(result: Result, outPath: string): string {
  const L: string[] = [];
  const d = result.diagnosis;

  if (result.blocked) {
    L.push(`${RED}${BOLD}BLOCKED${RESET}  ${result.blocked.blocker.id}`);
    L.push(`${GREY}category${RESET} ${d.nohal_category}`);
    L.push(`${GREY}resolution expected in${RESET} ${result.blocked.days_to_expected_resolution} days`);
    L.push(`${GREY}referrals${RESET} ${result.blocked.blocker.referrals.length}`);
  } else {
    const ceiling = d.grade_ceiling ? `${d.grade_ceiling.from}-${d.grade_ceiling.to}` : 'none';
    L.push(
      `${GREEN}${BOLD}OK${RESET}  track=${BOLD}${d.track}${RESET}  category=${d.nohal_category}  ceiling=${ceiling}  teudat_zehut=${d.has_teudat_zehut}`,
    );
    L.push('');
    // ⚠️ Urgent first in the terminal too, same reason as in the report.
    for (const u of result.urgent) {
      const isBlocking = u.severity === 'blocking';
      L.push(
        `  ${isBlocking ? `${RED}${BOLD}❗ blocking` : `${YELLOW}ℹ  advisory`} ${u.id}${RESET}`,
      );
    }
    if (result.urgent.length) L.push('');
    for (const c of result.clocks) {
      const colour = c.status === 'expired' ? RED : c.status === 'running' ? GREEN : GREY;
      const days = c.days_left === null ? '' : `${c.days_left} days`;
      L.push(`  ${colour}${c.status.padEnd(12)}${RESET} ${days.padStart(11)}  ${GREY}${c.clock.id}${RESET}`);
    }
    // ⭐ The readiness verdict, in the terminal too. A finding that cannot be
    // seen in the tool used for reading real output does not exist — 30.8.
    if (result.readiness) {
      const r = result.readiness;
      const colour =
        r.verdict === 'mismatch' ? RED : r.verdict === 'ready' ? GREEN : r.verdict === 'gaps' ? YELLOW : GREY;
      L.push(
        `  ${colour}${BOLD}${r.verdict.toUpperCase().padEnd(9)}${RESET}` +
          `${GREY}mismatched=${RESET}${r.mismatched.length}  ` +
          `${GREY}missing=${RESET}${r.missing.length}  ` +
          `${GREY}unconfirmed=${RESET}${r.unconfirmed.length}  ` +
          `${GREY}ready=${RESET}${r.ready.length}  ` +
          `${GREY}first=${RESET}${r.first_action?.step_id ?? '—'}`,
      );
      L.push('');
    }
    for (const s of result.roadmap) {
      const colour = s.state === 'uncertain' ? YELLOW : s.state === 'do_now' ? GREEN : GREY;
      const flags = [
        s.start_now ? '⭐start-now' : '',
        s.must_precede ? `⭐before:${s.must_precede}` : '',
        s.waiting_on.length ? `waits:${s.waiting_on.join('|')}` : '',
        s.missing_answers.length ? `needs:${s.missing_answers.join('|')}` : '',
      ]
        .filter(Boolean)
        .join('  ');
      L.push(`  ${colour}${STATE_MARK[s.state]} ${s.step.id.padEnd(28)}${RESET}${GREY}${flags}${RESET}`);
    }
    L.push('');
    L.push(`  ${result.roadmap.length} steps · ${result.urgent.length} urgent · ${result.clocks.length} clocks · ${result.standing_conditions.length} standing conditions`);
  }
  L.push('');
  L.push(`${GREY}full Hebrew report →${RESET} ${outPath}`);
  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const todayIdx = args.indexOf('--today');
  const today = todayIdx >= 0 ? args[todayIdx + 1]! : new Date().toISOString().slice(0, 10);

  if (!file) {
    console.error('usage: npm run check -- <fixture.json> [--today YYYY-MM-DD]\n');
    const dir = path.join(process.cwd(), 'fixtures');
    if (fs.existsSync(dir)) {
      console.error('available fixtures:');
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))._comment ?? '';
        console.error(`  fixtures/${f.padEnd(24)} ${GREY}${c}${RESET}`);
      }
    }
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete raw._comment;

  const parsed = Profile.safeParse(raw);
  if (!parsed.success) {
    console.error(`${RED}That profile is not valid:${RESET}`);
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }

  const result = evaluate(parsed.data, today);
  const outPath = file.replace(/\.json$/, '') + '.roadmap.txt';
  fs.writeFileSync(outPath, report(result, today, args.includes('--sources')), 'utf8');
  console.log(summary(result, outPath));
}

main();
