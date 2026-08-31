import Anthropic from '@anthropic-ai/sdk';
import type { Result } from '@byg/engine';

/**
 * ============================================================================
 * THE LANGUAGE LAYER — the finished answer, said in plain words
 * ============================================================================
 *
 * ⭐ HARD RULE 3 OF THIS PROJECT, MADE LITERAL: "The LLM does not make critical
 * decisions alone." The engine has already decided everything — eligibility,
 * the route, which documents are broken, what to do first. This layer receives
 * that finished decision and REWRITES it. It cannot add a step, remove one,
 * change a date, or reverse an eligibility answer, because it is never given
 * the inputs that would let it try.
 *
 * ⚠️ WHY IT LIVES IN apps/api AND NOT IN THE ENGINE. Two reasons, both absolute:
 *   · the engine is pure — no network, no I/O — and that purity is what lets
 *     360 tests run with no mock and no server
 *   · the API key must never reach a browser
 *
 * ⚠️ WHY IT IS ITS OWN ENDPOINT, called on demand. Ticking a step re-runs the
 * whole engine, and folding this into /readiness would fire a paid model call
 * on every checkbox click. The deterministic path must stay free.
 *
 * ⭐ AND IT FAILS SOFT, ALWAYS. No key, no credit, no network, a bad response —
 * every one of them returns the deterministic text instead. The product works
 * with the model switched off. That is not a fallback bolted on; it is the
 * reason the deterministic spine was built first.
 */

export type Lang = 'he' | 'en';

export type Explanation = {
  text: string;
  /**
   * ⚠️ Where the words came from, and the website SHOWS this. A person reading
   * a government answer is entitled to know which sentences were written by a
   * language model and which were quoted from a procedure.
   */
  source: 'model' | 'deterministic';
  /** Populated when the model was meant to run and could not. Never shown raw. */
  reason?: 'no_key' | 'call_failed' | 'empty_response';
};

const pick = (t: { he: string; en: string }, lang: Lang) => t[lang];

// ─────────────────────────────────────────────────────────────────────────────
// What the model is allowed to see
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ THE GUARDRAIL, AND IT IS STRUCTURAL RATHER THAN A REQUEST.
 *
 * The model never receives the Profile. It receives this — a rendering of the
 * FINISHED Result, and nothing else. It cannot reason about his eligibility
 * because it is not told his visa type, his dates, or his answers; it is told
 * what was already concluded.
 *
 * ⚠️ PRIVACY (hard rule 1), and it matters more here than anywhere else in the
 * system, because this is the only place where anything leaves the server.
 * These users are legally vulnerable and they are uploading passport details.
 *
 * The protection is one that is already proven rather than promised: this text
 * is built ONLY from fields of the Result, and `npm run audit` asserts as an
 * invariant that no value a user typed ever appears in a Result. So no passport
 * number, no 89 number, and no name can reach this string — not because the
 * wording here is careful, but because those values are not in the object it is
 * built from.
 */
export function distill(result: Result, lang: Lang): string {
  const L: string[] = [];
  const d = result.diagnosis;

  if (result.blocked) {
    L.push(`DECISION: this person is blocked by ${result.blocked.blocker.id}.`);
    L.push(`EXPLANATION: ${pick(result.blocked.blocker.explanation, lang)}`);
    L.push(`LEGAL STATUS: ${result.blocked.blocker.legal_status}`);
    return L.join('\n');
  }

  L.push('DIAGNOSIS');
  L.push(`- route: ${d.track}`);
  L.push(`- category in the procedure: ${d.nohal_category}`);
  L.push(`- holds an Israeli teudat zehut: ${d.has_teudat_zehut}`);
  if (d.grade_ceiling) L.push(`- may be issued grades under regulations ${d.grade_ceiling.from}-${d.grade_ceiling.to}`);
  /**
   * ⚠️ CONVERSION ONLY, and this was wrong in the first version — found by
   * reading a real Opus answer on 31.8.
   *
   * The exemption is from מבחן שליטה and בדיקת ראייה, and it exists only on the
   * conversion route; the engine therefore reports 'unknown' for everybody
   * going from zero. Sending that unconditionally made the model write, quite
   * faithfully, "we still do not know whether you are exempt from the eye
   * test" to a man for whom the question does not exist. An open question
   * invented out of a field that simply did not apply.
   *
   * ⭐ The model was not at fault: it reported exactly what it was given. The
   * screen already gates this row on `track === 'conversion'`; this did not.
   *
   * ⚠️ And it is the SAME failure as 27.8 and 30.8 — conversion concepts
   * leaking onto the from-zero route, where the six months abroad and the
   * entries-and-exits form both got to first. It is this codebase's recurring
   * bug, and it now has a test on this side too.
   */
  if (d.track === 'conversion') {
    L.push(`- exempt from the control test and eye test: ${d.exemption}`);
  }

  if (result.urgent.length) {
    L.push('', 'NOTICES (the severity of each is decided, do not change it)');
    for (const u of result.urgent) {
      L.push(`- [${u.severity}] ${pick(u.title, lang)}`);
      L.push(`  what it means: ${pick(u.consequence, lang)}`);
      L.push(`  what to do: ${pick(u.action, lang)}`);
    }
  }

  const r = result.readiness;
  if (r) {
    L.push('', 'READINESS');
    L.push(`- verdict: ${r.verdict}`);
    L.push(`- summary already written: ${pick(r.headline, lang)}`);
    const bucket = (name: string, items: typeof r.ready) => {
      if (items.length) L.push(`- ${name}: ${items.map((i) => pick(i.title, lang)).join(' · ')}`);
    };
    bucket('holding, and it will NOT pass', r.mismatched);
    bucket('does not have yet', r.missing);
    bucket('never asked about, so unknown', r.unconfirmed);
    bucket('holding and in order', r.ready);

    if (r.first_action) {
      L.push('', 'THE ONE THING TO DO FIRST');
      L.push(`- ${pick(r.first_action.title, lang)}`);
      L.push(`  action: ${pick(r.first_action.action, lang)}`);
      L.push(`  why this one: ${pick(r.first_action.why, lang)}`);
    }
    L.push('', `PROGRESS: ${r.steps_done} of ${r.steps_total} steps done.`);
  }

  L.push('', 'THE ROAD, IN ORDER');
  for (const step of result.roadmap) {
    L.push(`- [${step.state}] ${pick(step.step.title, lang)}`);
  }

  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// The voice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Every rule below is one this project already committed to in writing, and
 * most of them are the founder's. They are repeated here because the model has not
 * read the codebase, and because a language layer is exactly where a carefully
 * built answer gets casually undone — one cheerful "you're all set!" over a
 * blocking notice and the whole discipline is gone.
 *
 * ⭐ Stable text, cached. It is the same on every request, so it is sent with
 * cache_control and read back at a fraction of the price after the first call.
 */
const SYSTEM = `You are the plain-language voice of "Before You Go", a service that tells a person living in Israel WITHOUT Israeli citizenship whether he is ready for a bureaucratic process before he takes a day off work to attend it.

You will be given a decision that has ALREADY BEEN MADE by a deterministic rules engine, built from official Israeli procedures. Your only job is to say it back to the person in warm, plain, direct language.

WHAT YOU MUST NEVER DO
- Never add a step, a document, a fee, a date, a deadline or a requirement that is not in the decision you were given. If it is not there, it does not exist.
- Never remove, soften or reverse anything in the decision.
- Never change the severity of a notice. "blocking" means acting today is pointless. "advisory" means carry on today, this is only something to know or to start in parallel. Collapsing these two is the single worst thing you can do here: a person told that a warning is urgent when it is not may not go at all, and lose days he still had.
- Never tell anyone they are ineligible or rejected. Almost nobody in this system is. A person may need a different route, or a document put right, but that is not a refusal.
- Never promise certainty. If the decision says something may be required, say "may". If something is not known, say it is not known. False confidence in bureaucracy causes real harm.
- Never invent a reason, a legal clause or a source.
- Never restate or guess any document number, name or personal identifier.

HOW TO WRITE
- Speak directly to the person as "you".
- Short paragraphs. No headings, no bullet lists, no markdown.
- PROFESSIONAL, SIMPLE, CLEAR. This is official guidance, not a story. State the rule and the action, and stop.
- Do not dramatise a consequence. "The test is recorded as a failure" is the fact; "after a day off work and a queue" is colour, and it does not belong here.
- Do not reassure, console, or comment on how the person might feel. No "don't worry", no "it's not your fault", no "this is tiring". Respect is shown by being clear and brief, not by sympathising.
- Lead with where the person stands, then the first step, then what follows.
- If something he holds will not be accepted, say so plainly and immediately, followed by what puts it right.
- If money comes up, frame it as planning. Never total it into a discouraging number.
- 150 words or fewer. This sits above a detailed roadmap he can already read; you are the orientation, not the manual.`;

const PROMPT: Record<Lang, string> = {
  he: 'כתוב את התשובה בעברית בלבד, בלשון פנייה ישירה.',
  en: 'Write the answer in English only, speaking directly to the person.',
};

// ─────────────────────────────────────────────────────────────────────────────
// What renders when the model does not
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ THE PRODUCT WITH THE MODEL SWITCHED OFF.
 *
 * ⚠️ Not a stub and not an apology. Every sentence here is engine-authored text
 * that was written against a source, so this is a genuinely usable answer — it
 * is simply assembled rather than composed. If the key is missing on the
 * morning of a demo, or the credit runs out, the person still gets told where
 * he stands and what to do first.
 */
export function deterministicSummary(result: Result, lang: Lang): string {
  const parts: string[] = [];

  if (result.blocked) {
    parts.push(pick(result.blocked.blocker.explanation, lang));
    return parts.join('\n\n');
  }

  const r = result.readiness;
  if (r) parts.push(pick(r.headline, lang));

  const blocking = result.urgent.filter((u) => u.severity === 'blocking');
  for (const u of blocking) {
    parts.push(`${pick(u.title, lang)} ${pick(u.consequence, lang)}`);
  }

  if (r?.first_action) {
    parts.push(
      lang === 'he'
        ? `השלב הראשון: ${pick(r.first_action.title, lang)}. ${pick(r.first_action.action, lang)}`
        : `First step: ${pick(r.first_action.title, lang)}. ${pick(r.first_action.action, lang)}`,
    );
  }

  // ⚠️ Advisories last, and named as things that do not stop him. The founder, 30.8.
  const advisory = result.urgent.filter((u) => u.severity === 'advisory');
  for (const u of advisory) {
    parts.push(
      (lang === 'he' ? 'אינו עוצר אותך, אך חשוב לדעת: ' : 'This does not stop you, but is worth knowing: ') +
        pick(u.consequence, lang),
    );
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// The call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Read once, at module load, and never logged. An absent key is a normal
 * state — it is how the whole of Days 1 to 4 ran — so it produces the
 * deterministic answer rather than an error.
 */
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export const modelIsConfigured = () => client !== null;

/**
 * ⚠️ `max_tokens` is a HARD ceiling on what can be billed for output, and it is
 * set low on purpose. The brief asks for 150 words; 1200 tokens is generous for
 * that and makes a runaway response impossible.
 *
 * ⚠️ effort 'low' because this is a rewriting task with a finished answer in
 * hand, not a reasoning problem. Thinking is left ON — Claude Opus 5 runs
 * adaptive by default, and disabling it invites internal tags leaking into the
 * visible text, which on this screen would be worse than the tokens it saves.
 */
const MAX_TOKENS = 1200;

export async function explain(
  result: Result,
  lang: Lang,
  deps: { client?: Anthropic | null } = {},
): Promise<Explanation> {
  const anthropic = deps.client === undefined ? client : deps.client;
  const fallback = deterministicSummary(result, lang);

  if (!anthropic) return { text: fallback, source: 'deterministic', reason: 'no_key' };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low' },
      system: [
        // Stable across every request, so it is worth caching.
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content: `${PROMPT[lang]}\n\nHere is the decision to put into plain words:\n\n${distill(result, lang)}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    /**
     * ⚠️ An empty answer is a failure, not an answer. A refusal or a response
     * that came back with nothing usable must fall through to the text we
     * wrote ourselves rather than leave a blank panel on the screen.
     */
    if (!text) return { text: fallback, source: 'deterministic', reason: 'empty_response' };

    return { text, source: 'model' };
  } catch {
    /**
     * ⚠️ Swallowed deliberately, and nothing about it is logged. The failure
     * could be a bad key, exhausted credit, a rate limit or a dropped
     * connection — and none of those is the user's problem or worth risking a
     * request body in a log line. He gets a real answer either way.
     */
    return { text: fallback, source: 'deterministic', reason: 'call_failed' };
  }
}
