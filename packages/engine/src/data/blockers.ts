import type { BlockerInput } from '../domain';
import { official, inferred } from './sources';

/**
 * ============================================================================
 * BLOCKERS — there is exactly one
 * ============================================================================
 *
 * Source: גיליון F6_חסום_2א5 and גיליון 04 row 5.
 *
 * ⚠️ A blocker is an ABSOLUTE stop, and this system has precisely one. Missing a
 * teudat zehut is NOT a blocker; it changes the channel, never the entitlement.
 * If a second one ever appears here, it needs the same standard of proof: a
 * quoted source, a legal basis, and an honest statement of how contested it is.
 *
 * ⭐ Built so a single field flips it. גיליון F6 rule 1:
 *   "החסם ממומש כשדה יחיד: blocker.legal_status ∈ {active, in_litigation, lifted}.
 *    אם הבג"ץ יקבל את העתירה — שינוי ערך אחד פותח לאוכלוסייה שלמה את F3 ו-F5."
 */

export const BLOCKERS: BlockerInput[] = [
  {
    id: 'block.section_2a5',
    applies_when: { field: 'visa_type', op: 'eq', value: 'section_2a5' },

    title: {
      he: "היום אי אפשר להוציא רישיון נהיגה עם אישור שהייה לפי סעיף 2(א)(5)",
      en: 'Today a licence cannot be issued on a stay permit under section 2(a)(5)',
    },

    /**
     * ⚠️ Never a bare "אינך זכאי". גיליון F6 step 2 and rule 3: a person who is
     * blocked has to know WHAT blocks him, ON WHOSE AUTHORITY, and that it is
     * being fought over right now. The wording below is deliberate:
     *  · "לפי מה שכתוב היום" — dated, not eternal
     *  · names the source as a service page, NOT the נוהל and NOT the regulations
     *  · states the legal reasoning, so it is explained rather than decreed
     *  · ends with the court case, because that is the true state of the world
     */
    explanation: {
      he:
        "לפי מה שכתוב היום בדף השירות של משרד התחבורה, בעלי אישור שהייה מכוח סעיף 2(א)(5) לחוק הכניסה לישראל אינם רשאים להוציא רישיון נהיגה.\n\n" +
        "חשוב שתדע מאיפה זה מגיע: האיסור מופיע בדף שירות של משרד התחבורה — הוא אינו כתוב בנוהל ההמרה ואינו כתוב בתקנות התעבורה.\n\n" +
        "ההיגיון המשפטי מאחוריו: חוק הכניסה לישראל מבחין בין אשרה (רשות להיכנס) לבין רישיון ישיבה (רשות לשהות). לשון סעיף 2(א)(5) מגדירה את המחזיק כמי שנמצא בישראל \"בלי רישיון ישיבה\" — ורישיון ישיבה הוא בדיוק מה שנוהל ההמרה דורש.\n\n" +
        "⏳ הנושא אינו סגור. בג\"ץ הוציא צו על-תנאי המורה למדינה לנמק מדוע מבקשי מקלט אינם רשאים להוציא רישיון, להיבחן בתיאוריה ובטסט. העותרים: האגודה לזכויות האזרח, א.ס.ף, והמוקד לפליטים ולמהגרים. עמדת המדינה: קשיי זיהוי ואכיפה. למדינה ניתנו 90 יום להשיב.\n\n" +
        "האיסור הזה חל על הוצאת רישיון נהיגה בלבד. הוא אינו קובע דבר לגבי שאר תהליכי הקליטה.",
      en:
        "According to what the Ministry of Transport service page says today, holders of a stay permit under section 2(a)(5) of the Entry into Israel Law may not obtain a driving licence.\n\n" +
        "You should know where this comes from: the prohibition appears on a ministry service page. It is not in the conversion procedure and not in the traffic regulations.\n\n" +
        "The legal reasoning behind it: the Entry into Israel Law separates a visa (permission to enter) from a residence permit (permission to stay). The wording of section 2(a)(5) defines its holder as someone present in Israel \"without a residence permit\" — and a residence permit is exactly what the conversion procedure requires.\n\n" +
        "⏳ This is not settled. The High Court has issued an order nisi requiring the state to justify why asylum seekers may not obtain a licence or sit the theory and practical tests. Petitioners: the Association for Civil Rights in Israel, ASSAF, and the Hotline for Refugees and Migrants. The state's position: identification and enforcement difficulties. The state was given 90 days to respond.\n\n" +
        "This prohibition concerns issuing a driving licence only. It determines nothing about any other absorption process.",
    },

    // ⭐ The single field. Flip to 'lifted' and this population routes to F3/F5
    // with no other change anywhere in the system.
    legal_status: 'in_litigation',
    expected_resolution_at: '2026-10-10',

    // Never a dead end. גיליון 12.
    referrals: [
      {
        name: { he: "המוקד לפליטים ולמהגרים", en: 'Hotline for Refugees and Migrants' },
        url: 'https://hotline.org.il/refugees-and-asylum-seekers/',
      },
      { name: { he: "HIAS Israel", en: 'HIAS Israel' }, url: 'https://hias.org.il/' },
    ],

    evidence: [
      official(
        'דף השירות "הוצאת רישיון נהיגה", משרד התחבורה · סעיף "הוצאת רישיון נהיגה לעובד זר"',
        "האיסור עצמו, ומקורו הוא דף שירות ולא הנוהל ולא התקנות",
        "בעלי אישור שהייה מכוח סעיף 2(א)(5) לחוק הכניסה לישראל אינם רשאים להוציא רישיון נהיגה.",
        'https://www.gov.il/he/service/apply_for_new_driver_drivers_license',
      ),
      official(
        'חוק הכניסה לישראל, תשי"ב-1952, ס\' 2(א)(5)',
        "הבסיס המשפטי: לשון החוק מגדירה את המחזיק כמי שנמצא בישראל בלי רישיון ישיבה",
        "רישיון זמני לישיבת ביקור למי שנמצא בישראל בלי רישיון ישיבה וניתן עליו צו הרחקה – עד ליציאתו מישראל או הרחקתו ממנה.",
        'https://www.nevo.co.il/law_html/law01/189_003.htm',
      ),
      {
        claim:
          "בג\"ץ הוציא צו על-תנאי המורה למדינה לנמק. עותרים: האגודה לזכויות האזרח, א.ס.ף, המוקד לפליטים ולמהגרים. 90 יום להשיב מ-12.7.2026",
        certainty: 'in_litigation',
        // ⚠️ A press report, not a court record. The docket number was not
        // published, so this is the weakest link in an otherwise solid chain and
        // it is marked as such rather than dressed up.
        citation: 'וואלה רכב, 12.7.2026 · ⚠️ מקור עיתונאי — מספר התיק לא פורסם',
        quote: "בג\"ץ הוציא צו על-תנאי המורה למדינה לנמק מדוע מבקשי מקלט אינם רשאים להוציא רישיון נהיגה",
        url: 'https://cars.walla.co.il/item/3852919',
        last_verified_at: '2026-08-21',
        legal_status: 'in_litigation',
        expected_resolution_at: '2026-10-10',
        variation_factors: [],
      },
      inferred(
        "מועד היעד ~10.10.2026 — חישוב של 90 יום מפרסום הצו ב-12.7.2026",
        'חישוב מתאריך הפרסום · גיליון 02 שורה 18',
      ),
    ],
  },
];

/**
 * ⚠️ Two validation rules that belong with this blocker but are NOT blockers.
 * Recorded here so nobody adds them to the list above by mistake.
 *
 * 1. IDP ONLY (רישיון בין-לאומי). Not a block on the person — a block on the
 *    CONVERSION ROUTE. He is fully entitled to go the from-zero route, and
 *    telling him "you cannot get a licence" would be false. It is a routing
 *    decision, handled in the evaluator.
 *
 * 2. NO TEUDAT ZEHUT. Not a block at all, ever. It changes the channel.
 *    גיליון F0: "אין להציג למי שאין ת״ז מסך 'אינך זכאי' בשום שלב שאינו חסם 2(א)(5)."
 *
 * 3. Before showing this blocker, F6 validation 1 requires confirming he really
 *    does hold a 2(א)(5) permit, by describing the physical document — a
 *    "כרטיס רישיון שהייה". A wrong block is more damaging than a missed one.
 */
