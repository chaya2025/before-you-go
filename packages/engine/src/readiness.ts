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
 * Chaya's wasted trips were document problems — a stale 89 and a lapsed visa —
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
 * repeat exactly the harm Chaya caught on 30.8, where a visa with two months
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
        he: 'המסמך ברשותך, אך במצבו הנוכחי לא יתקבל.',
        en: 'You have this document, but in its current state it will not be accepted.',
      };

    case 'missing': {
      /**
       * ⭐⭐ RULE, not a branch (23.9). This used to carry two hardcoded
       * `doc.id === 'doc.record'` cases over a fallback that told everyone else
       * "המסלול דורש אותו". That sentence was FALSE every time it appeared on
       * the רקורד, because the נוהל offers that document rather than demanding
       * it — "למעוניינים בקבלת פטור".
       *
       * A document now says for itself how its own absence reads, in
       * documents.ts beside its sources, where somebody auditing the נוהל will
       * actually find it. This function renders; it decides nothing.
       */
      const variant = doc.absence_variants.find(
        (v) => evaluateCondition(v.when, facts) === true,
      );
      if (variant) return variant.detail;

      // Offered, not demanded. Its absence costs what it buys, never the route.
      if (doc.optional) return doc.optional.if_absent;

      return {
        he: 'המסמך אינו ברשותך, והמסלול דורש אותו.',
        en: 'You do not have this document, and your route requires it.',
      };
    }

    case 'ready': {
      const original =
        doc.must_be_original === true
          ? { he: ' יש להציג מקור, לא צילום.', en: ' Present the original, not a copy.' }
          : { he: '', en: '' };
      return {
        he: `לפי הפרטים שמסרת, המסמך תקין.${original.he}`,
        en: `Based on the details you gave, this document is in order.${original.en}`,
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
          ? `לא שאלנו על המסמך הזה, ולכן מצבו אינו ידוע. יש לוודא אותו לפני "${firstNeed.he}".`
          : 'לא שאלנו על המסמך הזה, ולכן מצבו אינו ידוע. יש לוודא אותו לפני ההגעה.',
        en: firstNeed
          ? `We did not ask about this document, so its status is unknown. Check it before "${firstNeed.en}".`
          : 'We did not ask about this document, so its status is unknown. Check it before you go.',
      };
  }
}

function actionFor(
  bucket: ReadinessBucket,
  doc: RequiredDocument,
  facts: Facts,
  resolvedBy: RoadmapStep | undefined,
): Text | undefined {
  // ⭐ 'ready' carries no action. There is nothing to do, and inventing a chore
  // for a document that is fine is how a clean report starts to read like a
  // list of problems.
  if (bucket === 'ready') return undefined;

  /**
   * ⭐⭐ 23.9. He has told us this document cannot be obtained at all, so there
   * is no action to give him.
   *
   * Found by reading the real report: the man who answered "my country does not
   * issue one" was shown the honest explanation and then, immediately under it,
   * "בקש מהרשות המוסמכת במדינת המוצא אסמכתה..." — go and ask the authority he
   * had just told us does not exist. The action came from the producing step,
   * which knows nothing about his answer. Two lines of one card contradicting
   * each other is worse than either line alone.
   */
  if (
    doc.absence_variants.some(
      (v) => v.no_action && evaluateCondition(v.when, facts) === true,
    )
  ) {
    return undefined;
  }

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
        : { he: ` גורם מנפיק: ${doc.issued_by.he}.`, en: ` Issued by: ${doc.issued_by.en}.` };
    return {
      he: `ודא שהמסמך ברשותך ובתוקף.${issuer.he}`,
      en: `Confirm you have the document and that it is valid.${issuer.en}`,
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
      he: 'בדוק אילו מהפרטים שמסרת אינם בתוקף, וטפל בהם לפני קביעת תור. ההתראות שלמעלה מפרטות.',
      en: 'Check which of the details you gave are no longer valid and deal with them before booking an appointment. The notices above give the detail.',
    };
  }

  return {
    he: `להנפקה יש לפנות אל ${doc.issued_by.he}.`,
    en: `To obtain it, apply to ${doc.issued_by.en}.`,
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
function firstAction(
  roadmap: RoadmapStep[],
  facts: Facts,
  wanted: Map<string, { doc: RequiredDocument; steps: RoadmapStep[] }>,
): FirstAction | null {
  /**
   * ⭐⭐ NEVER OFFER A STEP HE HAS TOLD US HE CANNOT DO (23.9).
   *
   * Found by reading the rendered page: a man who answered "my country does
   * not issue a רקורד" was shown "הדבר הראשון לעשות: השגת רקורד ממדינת המוצא"
   * directly above the panel explaining that he cannot get one and does not
   * need to. Two parts of one screen contradicting each other, which is the
   * same fault as the "go and ask the authority" action fixed earlier today —
   * this one just arrived through a different door.
   *
   * The document already carries the answer as data (`absence_variants` with
   * `no_action`), so nothing new is decided here: this only refuses to promote
   * a step whose whole purpose is a document he has said is unobtainable.
   */
  const unobtainable = (r: RoadmapStep) => {
    const id = r.step.produces_document;
    const doc = id ? wanted.get(id)?.doc : undefined;
    return Boolean(
      doc?.absence_variants.some(
        (v) => v.no_action && evaluateCondition(v.when, facts) === true,
      ),
    );
  };

  const next = roadmap.find((r) => r.state === 'do_now' && !unobtainable(r));
  if (!next) return null;

  const dependents = roadmap
    .filter((r) => r.state !== 'done' && r.waiting_on.includes(next.step.id))
    .map((r) => r.step.title);

  let why: Text;
  if (next.step.repairs_documents.length > 0) {
    why = {
      he: 'מסמך שאינו תקין מעכב את השלבים שאחריו, ולכן יש לטפל בו ראשון.',
      en: 'A document that is not in order holds up the steps behind it, so deal with it first.',
    };
  } else if (next.start_now) {
    why = {
      he: 'השלב מופיע בהמשך המסלול, אך הוא תלוי בגורם חיצוני וזמן הטיפול בו ארוך. מומלץ להתחיל אותו כעת.',
      en: 'The step appears later in the route, but it depends on an external body and takes time. Start it now.',
    };
  } else if (dependents.length > 0) {
    why = {
      he: `שלבים אחרים ממתינים לו: ${dependents.map((t) => t.he).join(' · ')}.`,
      en: `Other steps are waiting on it: ${dependents.map((t) => t.en).join(' · ')}.`,
    };
  } else {
    why = {
      he: 'זהו השלב הראשון במסלול שאינו מעוכב.',
      en: 'This is the first step in your route that nothing is holding up.',
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
    const action = actionFor(bucket, doc, facts, resolved_by);

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
   * ⭐⭐ THE VERDICT IS ABOUT DOCUMENTS THE ROUTE REQUIRES (23.9).
   *
   * An optional document — one the נוהל offers rather than demands — is listed
   * honestly in its bucket under "אינו ברשותך", but it must not drive the
   * verdict. A man holding every document the route actually requires is READY,
   * and a רקורד he was never obliged to produce cannot make him not-ready.
   *
   * ⚠️ The lists handed back are untouched. He still sees it; the headline just
   * stops calling it a gap.
   */
  const optionalIds = new Set(
    [...wanted.values()].filter(({ doc }) => doc.optional).map(({ doc }) => doc.id),
  );
  const requiredMissing = missing.filter((i) => !optionalIds.has(i.id));
  const requiredUnconfirmed = unconfirmed.filter((i) => !optionalIds.has(i.id));

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
        he: 'מסמך אחד שברשותך לא יתקבל במצבו הנוכחי. ניתן לטפל בכך מראש.',
        en: 'One document you hold will not be accepted in its current state. This can be dealt with in advance.',
      },
      {
        he: '{n} מסמכים שברשותך לא יתקבלו במצבם הנוכחי. ניתן לטפל בכך מראש.',
        en: '{n} documents you hold will not be accepted in their current state. This can be dealt with in advance.',
      },
    );
  } else if (requiredMissing.length > 0) {
    verdict = 'gaps';
    headline = plural(
      requiredMissing.length,
      {
        he: 'חסר מסמך אחד. כל מה שכבר ברשותך תקין.',
        en: 'One document is missing. Everything you already hold is in order.',
      },
      {
        he: 'חסרים {n} מסמכים. כל מה שכבר ברשותך תקין.',
        en: '{n} documents are missing. Everything you already hold is in order.',
      },
    );
  } else if (requiredUnconfirmed.length > 0) {
    verdict = 'unknown';
    headline = plural(
      requiredUnconfirmed.length,
      {
        he: 'מסמך אחד שהמסלול דורש טרם נבדק. מילוי פרטי המסמכים ייתן תשובה מלאה.',
        en: 'One document your route requires has not been checked. Filling in your document details gives a complete answer.',
      },
      {
        he: '{n} מסמכים שהמסלול דורש טרם נבדקו. מילוי פרטי המסמכים ייתן תשובה מלאה.',
        en: '{n} documents your route requires have not been checked. Filling in your document details gives a complete answer.',
      },
    );
  } else if (ready.length > 0) {
    verdict = 'ready';
    headline = {
      he: 'לפי הפרטים שמסרת, כל המסמכים שהמסלול דורש ברשותך ותקינים.',
      en: 'Based on the details you gave, every document your route requires is in your possession and in order.',
    };
  } else {
    /**
     * ⚠️ No outstanding step asks for a document at all. Saying "you are ready"
     * here would be a claim about nothing, so it stays 'unknown'.
     */
    verdict = 'unknown';
    headline = {
      he: 'אין מסמכים נדרשים בשלבים שנותרו.',
      en: 'No documents are required in the steps that remain.',
    };
  }

  return {
    verdict,
    headline,
    ready,
    mismatched,
    missing,
    unconfirmed,
    first_action: firstAction(roadmap, facts, wanted),
    steps_done: roadmap.length - outstanding.length,
    steps_total: roadmap.length,
  };
}
