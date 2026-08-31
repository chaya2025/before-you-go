import type { Facts } from './condition';
import { evaluateCondition } from './condition';
import type { Text, RequiredDocument } from './domain';
import type {
  RoadmapStep,
  Readiness,
  ReadinessItem,
  ReadinessBucket,
  ReadinessVerdict,
  FirstAction,
} from './result';

/**
 * ============================================================================
 * THE READINESS REPORT — "if I went tomorrow, would this work?"
 * ============================================================================
 *
 * The roadmap answers what the whole way looks like. This answers the narrower
 * question the product is named after, and it is the one that actually costs
 * people a day off work.
 *
 * ⭐ THE UNIT IS THE DOCUMENT. A step is something he does; a document is
 * something he holds, and it is the documents that get you turned away. Both of
 * the wasted trips were document problems — a stale 89 and a lapsed visa —
 * and neither of them was a step she had got wrong.
 *
 * ⚠️ EVERYTHING HERE IS READ OFF THE ROADMAP, NEVER RECOMPUTED. If the road says
 * "go and get your 89" and the step is not ticked, then he has no 89, and this
 * file does not go looking for a second opinion. That is the same discipline
 * `Diagnosis.exemption` already follows, for the same reason: the summary at the
 * top of the screen must not be able to contradict the steps underneath it.
 *
 * ⚠️ AND IT NEVER JUDGES THE PERSON. There is no "you are not ready" in here. A
 * man on step one of fourteen is not failing at anything, and saying so would
 * repeat exactly the harm the founder caught on 30.8, where a visa with two months
 * left was rendered in the same red box as one that had already expired.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Wording helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Both number forms are written out in full rather than glued together from
 * a count and a fixed sentence.
 *
 * Found by reading the report on 31.8: "2 מסמכים בידך לא יעבור בדלפק" — a
 * plural subject with a singular verb, because the count and the sentence were
 * being concatenated and the verb could not agree with the number in front of
 * it. Hebrew inflects the verb, so a template cannot be shared. English needs
 * the same care ("one document is" / "three documents are").
 *
 * A sentence about somebody's documents that does not parse is a sentence he
 * does not trust.
 */
function plural(n: number, one: Text, many: Text): Text {
  const pick = n === 1 ? one : many;
  return { he: pick.he.replace('{n}', String(n)), en: pick.en.replace('{n}', String(n)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// One document, one verdict
// ─────────────────────────────────────────────────────────────────────────────

type Placement = {
  bucket: ReadinessBucket;
  resolved_by?: RoadmapStep;
};

/**
 * ⭐ THE ORDER OF THESE TESTS IS THE WHOLE DESIGN, and each one is here because
 * the one above it would otherwise give a worse answer.
 *
 *   1. broken beats everything. A document he is holding that will be rejected
 *      is worse than one he knows he lacks, because he thinks he is ready.
 *   2. his own road, when it still tells him to go and obtain the thing.
 *   3. ⭐ his own road again, when he has TICKED that step. Mid-process entry:
 *      the man who did this last month is holding the document, and nothing
 *      else in the profile would ever tell us.
 *   4. what he transcribed.
 *   5. ⚠️ and then silence, which stays silence. Never a "no".
 */
function place(
  doc: RequiredDocument,
  facts: Facts,
  producer: RoadmapStep | undefined,
  repairer: RoadmapStep | undefined,
): Placement {
  // 1 — it is in his hand and it will not do.
  if (doc.broken_when && evaluateCondition(doc.broken_when, facts) === true) {
    return { bucket: 'mismatched', ...(repairer ? { resolved_by: repairer } : {}) };
  }
  if (repairer) return { bucket: 'mismatched', resolved_by: repairer };

  // 2, 3 — what his own roadmap already says about it.
  if (producer) {
    return producer.state === 'done'
      ? { bucket: 'ready', resolved_by: producer }
      : { bucket: 'missing', resolved_by: producer };
  }

  // 4, 5 — what he told us, and what he did not.
  const held = doc.held_when ? evaluateCondition(doc.held_when, facts) : 'unknown';
  if (held === true) return { bucket: 'ready' };
  if (held === false) return { bucket: 'missing' };
  return { bucket: 'unconfirmed' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Saying it in words
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ The wording is generic on purpose, and the SPECIFIC words come from the
 * step that resolves it — a step whose action was written against a source and
 * reviewed. Restating "renew your visa, it takes about a month" a second time
 * here would be a second place to get it wrong.
 */
function detailFor(
  bucket: ReadinessBucket,
  doc: RequiredDocument,
  facts: Facts,
  firstNeed: Text | null,
): Text {
  switch (bucket) {
    case 'mismatched':
      return {
        he: 'המסמך הזה בידך, אבל במצבו הנוכחי הוא לא יתקבל. זה בדיוק סוג הדבר שמתגלה בדלפק — אחרי יום חופש ואחרי תור.',
        en: 'You are holding this one, but as it stands it will not be accepted. This is exactly the kind of thing that surfaces at the desk, after a day off work and a queue.',
      };

    case 'missing': {
      /**
       * ⭐ The one document-specific case in this file, and it earns its place.
       * "מדינת המוצא לא מנפיקה מסמך כזה" is open question 16 — the biggest
       * practical blocker in the conversion route, and the נוהל says nothing
       * about it. The honest answer is not "go and get it"; it is that the
       * רקורד only ever bought the exemption, and the route is still his.
       */
      if (doc.id === 'doc.record' && facts.has_record_document === 'origin_country_does_not_issue') {
        return {
          he: 'אמרת שמדינת המוצא אינה מנפיקה מסמך כזה. הנוהל אינו אומר מה עושים במקרה הזה, ואיננו יודעים — זו שאלה פתוחה. מה שכן ידוע: הרקורד קונה רק את הפטור ממבחן שליטה ומבדיקת ראייה. בלעדיו המסלול פתוח בפניך בדיוק כמו קודם, פשוט עם שתי הבדיקות האלה בתוכו.',
          en: 'You said your home country does not issue one. The procedure does not say what happens then, and neither do we — it is an open question. What is known: the record only ever buys exemption from the control test and the eye test. Without it your route is open exactly as before, just with those two tests in it.',
        };
      }
      if (doc.id === 'doc.record' && facts.has_record_document === 'in_progress') {
        return {
          he: 'אמרת שהתחלת לטפל בזה. הוא מגיע מרשות זרה ולכן הוא הדבר האיטי ביותר בדרך שלך — שווה לרדוף אחריו עכשיו ולא בסוף.',
          en: 'You said you have started on it. It comes from a foreign authority, which makes it the slowest thing on your road — worth chasing now rather than at the end.',
        };
      }
      return {
        he: 'עוד לא בידך, והדרך שלך דורשת אותו.',
        en: 'Not in your hands yet, and your road needs it.',
      };
    }

    case 'ready': {
      const original =
        doc.must_be_original === true
          ? { he: ' ⚠️ להביא את המקור, לא צילום.', en: ' ⚠️ Bring the original, not a copy.' }
          : { he: '', en: '' };
      return {
        he: `לפי מה שמסרת, המסמך הזה בידך ותקין.${original.he}`,
        en: `From what you told us, you have this one and it is in order.${original.en}`,
      };
    }

    case 'unconfirmed':
      /**
       * ⚠️ The bucket that exists so this sentence can be said instead of
       * "missing". Nobody asked, which is not the same as him not having it,
       * and it is not something to be alarmed about.
       */
      return {
        he: firstNeed
          ? `לא שאלנו על זה, ולכן איננו יודעים. זו אינה בעיה — רק דבר לוודא לפני "${firstNeed.he}".`
          : 'לא שאלנו על זה, ולכן איננו יודעים. זו אינה בעיה — רק דבר לוודא לפני שיוצאים.',
        en: firstNeed
          ? `We did not ask, so we do not know. Not a problem — just something to check before "${firstNeed.en}".`
          : 'We did not ask, so we do not know. Not a problem — just something to check before you go.',
      };
  }
}

function actionFor(
  bucket: ReadinessBucket,
  doc: RequiredDocument,
  resolvedBy: RoadmapStep | undefined,
): Text | undefined {
  // ⭐ 'ready' carries no action. There is nothing to do, and inventing a chore
  // for a document that is fine is how a clean report starts to read like a
  // list of problems.
  if (bucket === 'ready') return undefined;

  // The precise words, from the step that was written against a source.
  if (resolvedBy) return resolvedBy.step.action;

  if (bucket === 'unconfirmed') {
    // ⚠️ "מנפיק: —." Three documents carry a dash as their issuer, because
    // nobody issues your glasses. Printing the field regardless produced a
    // sentence that reads like a rendering bug, which is how a careful report
    // stops being believed.
    const issuer =
      doc.issued_by.he === '—'
        ? { he: '', en: '' }
        : { he: ` מנפיק: ${doc.issued_by.he}.`, en: ` Issued by: ${doc.issued_by.en}.` };
    return {
      he: `ודא שהוא בידך ובתוקף.${issuer.he}`,
      en: `Check you have it and that it is valid.${issuer.en}`,
    };
  }

  /**
   * ⚠️ A MISMATCH IS NEVER "GO AND GET A NEW ONE", and this branch exists
   * because it briefly was. A man whose visa had lapsed was told to obtain a
   * fresh passport from his home country — he has a passport; what expired was
   * the sticker inside it. "Obtain" is only ever right for something he lacks.
   *
   * Reached only when nothing on his road repairs it, which today means his own
   * passport has run out. There is no step for that: renewing a foreign passport
   * is an embassy matter and outside what this system has researched. So it says
   * what it knows and points at the notices that spell the case out, rather than
   * inventing a procedure.
   */
  if (bucket === 'mismatched') {
    return {
      he: 'בדוק איזה מהפרטים שמסרת כבר אינו בתוקף, וסדר אותו לפני שאתה קובע תור. ההתראות שלמעלה מפרטות מה בדיוק נשבר.',
      en: 'Work out which of the details you gave is no longer valid and put it right before booking an appointment. The notices above spell out exactly what broke.',
    };
  }

  return {
    he: `השג אותו מול ${doc.issued_by.he}.`,
    en: `Obtain it from ${doc.issued_by.en}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// What to do first
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ ONE thing, and the reason it is that thing.
 *
 * ⚠️ The `why` is not a flourish. A person told to do step nine before step two
 * assumes the system is broken, closes it, and goes back to asking friends. Both
 * of the surprising orderings in this system — the רקורד that must be begun on
 * day one, and the fix that has to happen before anything else — look wrong
 * until they are explained.
 */
function firstAction(roadmap: RoadmapStep[]): FirstAction | null {
  const next = roadmap.find((r) => r.state === 'do_now');
  if (!next) return null;

  const dependents = roadmap
    .filter((r) => r.state !== 'done' && r.waiting_on.includes(next.step.id))
    .map((r) => r.step.title);

  let why: Text;
  if (next.step.repairs_documents.length > 0) {
    why = {
      he: 'מסמך שאינו תקין עוצר את כל מה שבא אחריו, ולכן הוא קודם לכול — גם לשלבים שנראים דחופים יותר.',
      en: 'A document that is not in order stops everything behind it, so it comes first, ahead of steps that look more urgent.',
    };
  } else if (next.start_now) {
    why = {
      he: 'השלב עצמו מגיע בהמשך הדרך, אבל הוא תלוי בגורם חיצוני ולוקח זמן. מי שמתחיל אותו כשמגיעים אליו — כבר איחר.',
      en: 'The step itself comes later on the road, but it depends on somebody else and it takes time. Anyone who starts it when he reaches it has already left it too late.',
    };
  } else if (dependents.length > 0) {
    why = {
      he: `שלבים אחרים ממתינים לו: ${dependents.map((t) => t.he).join(' · ')}.`,
      en: `Other steps are waiting on it: ${dependents.map((t) => t.en).join(' · ')}.`,
    };
  } else {
    why = {
      he: 'זה הראשון בדרך שלך ששום דבר לא מעכב.',
      en: 'It is the first thing on your road that nothing is holding up.',
    };
  }

  return { step_id: next.step.id, title: next.step.title, action: next.step.action, why };
}

// ─────────────────────────────────────────────────────────────────────────────
// The report
// ─────────────────────────────────────────────────────────────────────────────

export function buildReadiness(facts: Facts, roadmap: RoadmapStep[]): Readiness {
  // ⚠️ A step he has already done cannot need anything: he handed it over. Its
  // documents are history, and listing them would make the report GROW as he
  // makes progress, which is backwards.
  const outstanding = roadmap.filter((r) => r.state !== 'done');

  /** doc id → the document, and every outstanding step that wants it in hand. */
  const wanted = new Map<string, { doc: RequiredDocument; steps: RoadmapStep[] }>();
  for (const item of outstanding) {
    for (const doc of item.documents) {
      const entry = wanted.get(doc.id) ?? { doc, steps: [] };
      entry.steps.push(item);
      wanted.set(doc.id, entry);
    }
  }

  /**
   * ⚠️ `applies === true` only. A step we cannot place stays on the ROADMAP,
   * correctly, saying so — but it must not be read here as proof that he lacks
   * the document. "We are not sure you need to go and get an 89" is not evidence
   * that you have no 89.
   */
  const producers = new Map<string, RoadmapStep>();
  const repairers = new Map<string, RoadmapStep>();
  for (const item of roadmap) {
    const { produces_document, repairs_documents } = item.step;
    if (produces_document && item.applies === true && !producers.has(produces_document)) {
      producers.set(produces_document, item);
    }
    // A repair he has ticked is not a mismatch any more — he went and fixed it.
    if (item.applies === true && item.state !== 'done') {
      for (const id of repairs_documents) if (!repairers.has(id)) repairers.set(id, item);
    }
  }

  const order = new Map(roadmap.map((r, i) => [r.step.id, i]));

  const items: ReadinessItem[] = [...wanted.values()].map(({ doc, steps }) => {
    const { bucket, resolved_by } = place(doc, facts, producers.get(doc.id), repairers.get(doc.id));
    const firstNeed = steps[0] ? steps[0].step.title : null;
    const action = actionFor(bucket, doc, resolved_by);

    return {
      id: doc.id,
      bucket,
      title: doc.name,
      detail: detailFor(bucket, doc, facts, firstNeed),
      ...(action ? { action } : {}),
      /**
       * ⭐ The document's own note, carried rather than rewritten. It is where
       * the real qualifications live — "רק למי שמרכיב" on the glasses, and the
       * fact that the 89 has no expiry date. Without it the report says "check
       * you have your glasses" to a man with perfect eyesight.
       */
      ...(doc.notes ? { note: doc.notes } : {}),
      needed_for: steps.map((s) => s.step.id),
      ...(resolved_by ? { resolved_by: resolved_by.step.id } : {}),
      // Hard rule 4: the document's own sources travel with it.
      evidence: doc.evidence,
    };
  });

  // Soonest-needed first inside every bucket, so the top of each list is the
  // thing that bites first.
  items.sort((a, b) => (order.get(a.needed_for[0]!) ?? 0) - (order.get(b.needed_for[0]!) ?? 0));

  const of = (bucket: ReadinessBucket) => items.filter((i) => i.bucket === bucket);
  const mismatched = of('mismatched');
  const missing = of('missing');
  const unconfirmed = of('unconfirmed');
  const ready = of('ready');

  /**
   * ⚠️ Worst first, and 'ready' last of the four. The verdict is about the
   * DOCUMENTS, never about him — see ReadinessVerdict.
   */
  let verdict: ReadinessVerdict;
  let headline: Text;
  if (mismatched.length > 0) {
    verdict = 'mismatch';
    headline = plural(
      mismatched.length,
      {
        he: 'מסמך אחד שבידך לא יעבור בדלפק כמו שהוא. זה מה שהופך תור ליום מבוזבז, ואפשר לסדר אותו מראש.',
        en: 'One document in your hands will not pass at the desk as it stands. That is what turns an appointment into a wasted day, and it can be sorted out beforehand.',
      },
      {
        he: '{n} מסמכים שבידך לא יעברו בדלפק כמו שהם. זה מה שהופך תור ליום מבוזבז, ואפשר לסדר אותם מראש.',
        en: '{n} documents in your hands will not pass at the desk as they stand. That is what turns an appointment into a wasted day, and it can be sorted out beforehand.',
      },
    );
  } else if (missing.length > 0) {
    verdict = 'gaps';
    headline = plural(
      missing.length,
      {
        he: 'מסמך אחד עוד חסר לך. שום דבר ממה שכבר בידך אינו שבור — זו פשוט הדרך, לפי הסדר.',
        en: 'One document is still missing. Nothing you already hold is broken — this is simply the road, in order.',
      },
      {
        he: '{n} מסמכים עוד חסרים לך. שום דבר ממה שכבר בידך אינו שבור — זו פשוט הדרך, לפי הסדר.',
        en: '{n} documents are still missing. Nothing you already hold is broken — this is simply the road, in order.',
      },
    );
  } else if (unconfirmed.length > 0) {
    verdict = 'unknown';
    headline = plural(
      unconfirmed.length,
      {
        he: 'מסמך אחד שהדרך שלך דורשת עוד לא נבדק, כי לא שאלנו עליו. מילוי פרטי המסמכים ייתן תשובה ברורה.',
        en: 'One document your road needs has not been checked, because we did not ask. Filling in your document details gives a clear answer.',
      },
      {
        he: '{n} מסמכים שהדרך שלך דורשת עוד לא נבדקו, כי לא שאלנו עליהם. מילוי פרטי המסמכים ייתן תשובה ברורה.',
        en: '{n} documents your road needs have not been checked, because we did not ask. Filling in your document details gives a clear answer.',
      },
    );
  } else if (ready.length > 0) {
    verdict = 'ready';
    headline = {
      he: 'לפי מה שמסרת, כל מה שהדרך שלך דורשת נמצא אצלך ותקין.',
      en: 'From what you told us, everything your road needs is in your hands and in order.',
    };
  } else {
    /**
     * ⚠️ No outstanding step asks for a document at all. Saying "you are ready"
     * here would be a claim about nothing, so it stays 'unknown'.
     */
    verdict = 'unknown';
    headline = {
      he: 'אין כרגע מסמך שממתין לך בשלבים שנותרו.',
      en: 'Nothing on the steps you have left is waiting on a document.',
    };
  }

  return {
    verdict,
    headline,
    ready,
    mismatched,
    missing,
    unconfirmed,
    first_action: firstAction(roadmap),
    steps_done: roadmap.length - outstanding.length,
    steps_total: roadmap.length,
  };
}
