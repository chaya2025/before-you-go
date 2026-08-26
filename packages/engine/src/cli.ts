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
 *   npm run check -- fixtures/chaya.json
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

function report(result: Result, today: string): string {
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
  L.push('', '');
  L.push(`הדרך שלך — ${result.roadmap.length} שלבים`);
  L.push('');
  for (const s of result.roadmap) {
    L.push(`${STATE_MARK[s.state]} ${s.step.title.he}`);
    L.push(`     ${s.step.action.he.split('\n')[0]}`);

    if (s.start_now) L.push(`     ⭐ להתחיל עכשיו, גם אם השלב עצמו מגיע בהמשך`);
    if (s.must_precede) L.push(`     ⭐ חייב להיעשות לפני: ${s.must_precede}`);
    if (s.waiting_on.length) L.push(`     ⏸  ממתין ל: ${s.waiting_on.join(', ')}`);
    if (s.step.fallback) L.push(`     ↩  ${s.step.fallback.he}`);

    if (s.applies === 'unknown') {
      L.push(`     ❔ לא בטוח שהשלב הזה חל עליך. כדי לדעת, צריך לענות על: ${s.missing_answers.join(', ')}`);
    }
    for (const check of s.checks_first) L.push(`     🔎 לפני השלב: ${check.name.he}`);
    for (const item of s.step.checklist) L.push(`     ☐ ${item.he}`);

    if (s.step.cost?.amount_ils !== undefined) {
      const c = s.step.cost;
      L.push(`     ₪ ${c.amount_ils}${c.max_ils ? `-${c.max_ils}` : ''}${c.note ? ` · ${c.note.he}` : ''}`);
    }

    // ⭐ Official facts stated plainly, field reports introduced as reports.
    // Nothing is hidden for being uncertain (principle 20).
    const shown = attributions(s.step.evidence);
    for (const a of shown.official) {
      L.push(`     ${CERTAINTY_META[a.mark].symbol} ${a.lead_in.he ? a.lead_in.he + ' ' : ''}${a.claim}`);
      if (a.citation) L.push(`        ${a.citation}`);
    }
    for (const a of shown.reported) {
      L.push(`     ${CERTAINTY_META[a.mark].symbol} ${a.lead_in.he}: ${a.claim}`);
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
    for (const c of result.clocks) {
      const colour = c.status === 'expired' ? RED : c.status === 'running' ? GREEN : GREY;
      const days = c.days_left === null ? '' : `${c.days_left} days`;
      L.push(`  ${colour}${c.status.padEnd(12)}${RESET} ${days.padStart(11)}  ${GREY}${c.clock.id}${RESET}`);
    }
    L.push('');
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
    L.push(`  ${result.roadmap.length} steps · ${result.clocks.length} clocks · ${result.standing_conditions.length} standing conditions`);
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
  fs.writeFileSync(outPath, report(result, today), 'utf8');
  console.log(summary(result, outPath));
}

main();
