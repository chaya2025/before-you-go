import type { Text } from '@byg/engine';

/**
 * ============================================================================
 * Two languages, from the foundation
 * ============================================================================
 *
 * Every piece of content in the engine already exists in Hebrew and English —
 * every step title, every action, every clock. So the content half of this is
 * free; `pick()` below is the whole mechanism.
 *
 * What is NOT free is the interface chrome: buttons, questions, headings. Those
 * live here.
 *
 * ⚠️ Direction is not decoration. Hebrew reads right-to-left, English
 * left-to-right, and the entire layout mirrors — which is why the stylesheet
 * uses logical properties throughout rather than left and right.
 */

export type Lang = 'he' | 'en';

/** Take the right side of a bilingual string from the engine. */
export const pick = (text: Text | null | undefined, lang: Lang): string =>
  text ? text[lang] : '';

export const dirFor = (lang: Lang): 'rtl' | 'ltr' => (lang === 'he' ? 'rtl' : 'ltr');

/** Interface strings. Content comes from the engine; this is only the chrome. */
export const UI = {
  brand: { he: 'Before You Go', en: 'Before You Go' },
  tagline: { he: 'לדעת לפני שמגיעים', en: 'Know before you go' },

  intro: {
    he: 'כמה שאלות קצרות, ואז מפת הדרכים שלך — כל השלבים לפי הסדר, מה נדרש בכל אחד, ומה כדאי להתחיל כבר עכשיו.',
    en: 'A few short questions, then your roadmap — every step in order, what each one needs, and what to start today.',
  },
  privacy: {
    he: 'בלי הרשמה. שום דבר לא נשמר.',
    en: 'No sign-up. Nothing is saved.',
  },

  q_status: { he: 'מה המעמד שלך בישראל?', en: 'What is your status in Israel?' },
  q_status_help: {
    he: 'זה מה שקובע לאיזה מסלול אתה שייך, כמה זמן יש לך, ואילו דרגות פתוחות בפניך.',
    en: 'This decides which route you are on, how long you have, and which licence grades are open to you.',
  },

  q_license: {
    he: 'יש לך רישיון נהיגה מהמדינה שממנה הגעת?',
    en: 'Do you have a driving licence from the country you came from?',
  },
  license_national: { he: 'כן — רישיון רגיל של המדינה', en: 'Yes — a normal national licence' },
  license_idp: { he: 'יש לי רק רישיון בין-לאומי (IDP)', en: 'I only have an International Permit (IDP)' },
  license_none: { he: 'אין לי רישיון נהיגה', en: 'I have no driving licence' },
  license_idp_note: {
    he: 'רישיון בין-לאומי אינו מתקבל להמרה — רק רישיון לאומי. עדיין אפשר להוציא רישיון ישראלי מאפס.',
    en: 'An International Permit cannot be converted — only a national licence. You can still get an Israeli licence from scratch.',
  },

  q_entered: { he: 'מתי נכנסת לישראל?', en: 'When did you enter Israel?' },
  q_aliyah: { he: 'מתי עלית לארץ?', en: 'When did you make aliyah?' },
  q_returned: { he: 'מתי שבת לישראל?', en: 'When did you return to Israel?' },
  q_date_help: {
    he: 'חודש ושנה מספיקים. מכאן נספרים שני השעונים.',
    en: 'Month and year is enough. Both clocks count from here.',
  },
  /**
   * ⚠️ Chaya, 30.8, using the site: "it asks when he came back to Israel. What
   * does it have to do with when he came back? I thought the thing was six
   * months."
   *
   * She is the person who did this research and she still could not tell why
   * the question was there. A generic "both clocks count from here" says
   * nothing about WHICH clocks or WHY. So each category now gets its own
   * sentence, naming what this date actually starts for HIM.
   */
  q_date_help_returned: {
    he: 'חודש ושנה מספיקים. מכאן נספרות חמש השנים שבהן מותר להגיש את בקשת ההמרה. ⚠️ זהו תנאי נפרד מהשהייה בחו״ל, ולפי ס׳ 1(ב) שניהם נדרשים.',
    en: 'Month and year is enough. This starts the five years during which the conversion may be submitted. ⚠️ It is a separate condition from the time spent abroad, and clause 1(b) requires both.',
  },
  q_date_help_aliyah: {
    he: 'חודש ושנה מספיקים. מכאן נספרות חמש השנים שבהן מותר להגיש את בקשת ההמרה.',
    en: 'Month and year is enough. This starts the five years during which the conversion may be submitted.',
  },
  q_date_help_entered: {
    he: 'חודש ושנה מספיקים. מכאן נספרות חמש השנים להגשת הבקשה, וגם השנה שבה עוד מותר לנהוג כאן עם הרישיון הזר.',
    en: 'Month and year is enough. This starts the five years for submitting, and also the one year you may still drive here on the foreign licence.',
  },

  /**
   * ⭐⭐ THE QUESTION THAT WAS NEVER ASKED.
   *
   * ס' 1(ב) makes six consecutive months abroad a condition of conversion for a
   * returning resident, and the engine has carried the field, the fact and the
   * notice since 30.8 — with no screen anywhere collecting the answer. Half a
   * feature, reported as done. Found by Chaya inside ten minutes of using it.
   */
  q_six_months: {
    he: 'אחרי שקיבלת את הרישיון הזר, שהית בחו״ל שישה חודשים רצופים לפחות?',
    en: 'After you got the foreign licence, were you abroad for at least six consecutive months?',
  },
  q_six_months_help: {
    he: 'רצופים, לא במצטבר. ארבעה חודשים ועוד ארבעה אינם שמונה לעניין הזה.',
    en: 'Consecutive, not cumulative. Four months plus four months is not eight for this purpose.',
  },

  q_born: { he: 'באיזו שנה נולדת?', en: 'What year were you born?' },
  q_born_help: {
    he: 'מתחת לגיל 24 חלה תקופת ליווי, וזה משנה כמה עולה כל עיכוב.',
    en: 'Under 24 there is an accompanied-driving period, which changes what every delay costs you.',
  },

  q_years: {
    he: 'כמה שנים הרישיון שלך בתוקף כרישיון קבוע?',
    en: 'How many years have you held it as a permanent licence?',
  },
  q_years_help: {
    he: 'חמש שנים ומעלה יכולות לפטור אותך ממבחן שליטה ומבדיקת ראייה.',
    en: 'Five years or more can exempt you from the control test and the eye test.',
  },
  q_class: { he: 'לאיזו דרגה אתה רוצה להמיר?', en: 'Which grade do you want to convert to?' },
  q_record: {
    he: 'יש לך "רקורד" ממדינת המוצא?',
    en: 'Do you have a "record" from your home country?',
  },
  q_record_help: {
    he: 'אסמכתה מהרשות במדינת המוצא על מועד הוצאת הרישיון הקבוע. זה מה שקונה את הפטור.',
    en: 'A document from your home authority stating when your permanent licence was issued. This is what buys the exemption.',
  },

  q_visa_valid: { he: 'האשרה שלך בתוקף כרגע?', en: 'Is your visa currently valid?' },
  q_visa_valid_help: {
    he: 'הזכאות נבחנת ליום ההגשה, לא ליום הכניסה.',
    en: 'Eligibility is judged on the day you apply, not the day you entered.',
  },

  /* ⭐ ש4 is a CONFIRMATION, not a question. גיליון 11 שאלה 1 found that people
     do not know whether their 89 number counts as a teudat zehut, so asking
     directly produces confident wrong answers that misroute everything. */
  confirm_tz_title: { he: 'רגע אחד — נוודא', en: 'One moment — let us check' },
  confirm_tz_yes: {
    he: 'לפי המעמד שבחרת, כנראה יש לך תעודת זהות ישראלית. נכון?',
    en: 'Based on the status you chose, you probably have an Israeli teudat zehut. Is that right?',
  },
  confirm_tz_no: {
    he: 'לפי המעמד שבחרת, כנראה אין לך תעודת זהות ישראלית. נכון?',
    en: 'Based on the status you chose, you probably do not have an Israeli teudat zehut. Is that right?',
  },
  confirm_tz_explain: {
    he: 'תעודת זהות היא הכרטיס הכחול עם הספח. מספר מזהה שמתחיל ב-89 הוא לא תעודת זהות — הוא דף A4 מודפס שמשרד הרישוי מנפיק.',
    en: 'A teudat zehut is the blue card with the attached page. An identity number starting with 89 is not one — it is a printed A4 sheet issued by the licensing office.',
  },
  confirm_tz_have: { he: 'נכון, יש לי תעודת זהות', en: 'Correct, I have a teudat zehut' },
  confirm_tz_havent: { he: 'נכון, אין לי', en: 'Correct, I do not' },

  yes: { he: 'כן', en: 'Yes' },
  no: { he: 'לא', en: 'No' },
  unsure: { he: 'לא בטוח', en: 'Not sure' },
  country_no_record: {
    he: 'מדינת המוצא לא מנפיקה מסמך כזה',
    en: 'My home country does not issue one',
  },
  in_progress: { he: 'התחלתי לטפל בזה', en: 'I have started on it' },

  build: { he: 'בנה לי את מפת הדרכים', en: 'Build my roadmap' },
  build_hint: {
    he: 'צריך לענות על שתי השאלות הראשונות. את השאר אפשר לדלג.',
    en: 'Answer the first two questions. The rest can be skipped.',
  },
  loading: { he: 'רגע…', en: 'One moment…' },
  back: { he: 'לא נכון, תקן', en: 'Not right, fix it' },

  // ── the documents screen (ש7) ────────────────────────────────────────────
  //
  // ⭐ Chaya, 30.8: "don't drive the user crazy. Just tell them upload this,
  // this, this, and the system would realize itself what is not valid."
  //
  // So every label here asks him to READ something, never to judge anything.
  // He is never asked whether his documents agree. He is asked what they say.

  docs_title: {
    he: 'המסמכים שבידך',
    en: 'The documents you are holding',
  },
  docs_intro: {
    he: 'העתק מה שכתוב, בדיוק כפי שהוא מופיע. המערכת תשווה בין המסמכים ותגיד לך מה תקין ומה לא. אין חובה למלא הכול.',
    en: 'Copy what is written, exactly as it appears. The system compares the documents and tells you what is in order and what is not. Nothing here is required.',
  },
  docs_privacy: {
    // ⚠️ The promise the engine actually keeps: identity.ts compares and
    // discards, the API logs route and status only, and no message ever prints
    // a number back. Saying it here is the point of saying it at all.
    he: '🔒 המספרים משמשים להשוואה בלבד. הם לא נשמרים, לא נרשמים ביומן, ולא מוצגים חזרה בשום הודעה.',
    en: '🔒 The numbers are used for comparison only. They are not saved, not logged, and never printed back in any message.',
  },
  docs_skip: { he: 'דלג, המשך למפת הדרכים', en: 'Skip, go to the roadmap' },
  docs_check: { he: 'בדוק את המסמכים שלי', en: 'Check my documents' },

  d_89_title: { he: 'מסמך 89 ("הטופס הלבן")', en: 'The 89 document (the "white form")' },
  d_89_help: {
    // ⭐ The one line that explains why any of this matters, in his terms.
    he: 'מסמך ה-89 והדרכון הם יחד תעודת הזהות שלך בכל תהליך הרישוי. מספר הדרכון שמודפס על ה-89 הוא זה שהצגת ביום שהוצאת אותו.',
    en: 'Your 89 and your passport together are your identity for the whole licensing process. The passport number printed on the 89 is the one you showed on the day it was issued.',
  },
  d_89_number: { he: 'מספר המסמך (מתחיל ב-89)', en: 'Document number (starts with 89)' },
  d_89_passport: { he: 'מספר הדרכון המודפס על המסמך', en: 'The passport number printed on it' },
  d_89_name: { he: 'השם כפי שמופיע על המסמך', en: 'The name as it appears on it' },

  d_passport_title: { he: 'הדרכון', en: 'Your passport' },
  d_passport_help: {
    he: 'הדרכון שבידך עכשיו — לא זה שהיה לך כשהוצאת את ה-89.',
    en: 'The passport you hold now, not the one you had when the 89 was issued.',
  },
  d_passport_number: { he: 'מספר הדרכון', en: 'Passport number' },
  d_passport_expires: { he: 'תוקף עד', en: 'Valid until' },
  d_passport_name: { he: 'השם באותיות לטיניות, כפי שמופיע בדרכון', en: 'Name in Latin letters, as printed' },

  d_visa_title: { he: 'האשרה', en: 'Your visa' },
  d_visa_expires: { he: 'האשרה בתוקף עד', en: 'Visa valid until' },
  d_visa_help: {
    he: 'הזכאות נבחנת ליום ההגשה, ולכן התאריך הזה קובע יותר משנדמה.',
    en: 'Eligibility is judged on the day you submit, so this date matters more than it looks.',
  },

  d_licence_title: { he: 'רישיון הנהיגה הזר', en: 'Your foreign driving licence' },
  d_licence_expires: { he: 'תוקף עד', en: 'Valid until' },
  d_licence_name: { he: 'השם כפי שמופיע ברישיון', en: 'The name as it appears on the licence' },
  d_licence_lang: { he: 'באיזו שפה כתוב הרישיון?', en: 'What language is the licence written in?' },
  d_lang_he: { he: 'עברית', en: 'Hebrew' },
  d_lang_en: { he: 'אנגלית', en: 'English' },
  d_lang_other: { he: 'שפה אחרת', en: 'Another language' },
  start_over: { he: 'להתחיל מחדש', en: 'Start over' },

  diagnosis_title: { he: 'זה מה שהבנו', en: 'This is what we understood' },
  diagnosis_check: {
    he: 'תעבור על זה לפני שנמשיך. אבחון שגוי מייצר מפת דרכים שגויה לגמרי.',
    en: 'Check this before we go on. A wrong diagnosis produces an entirely wrong roadmap.',
  },
  d_track: { he: 'מסלול', en: 'Route' },
  d_category: { he: 'הקטגוריה שלך בנוהל', en: 'Your category in the procedure' },
  d_ceiling: { he: 'דרגות שאפשר להוציא', en: 'Grades available to you' },
  d_tz: { he: 'תעודת זהות', en: 'Teudat zehut' },
  track_conversion: { he: 'המרת רישיון זר', en: 'Converting a foreign licence' },
  track_from_zero: { he: 'הוצאת רישיון מאפס', en: 'Getting a licence from scratch' },
  looks_right: { he: 'נכון, המשך', en: 'Right, continue' },
  d_requested: { he: 'הדרגה שביקשת', en: 'The grade you asked for' },
  d_exemption: { he: 'פטור ממבחן שליטה ומבדיקת ראייה', en: 'Exempt from the control test and eye test' },
  exempt_yes: { he: 'כן — ותק וגם רקורד', en: 'Yes — seniority and a record' },
  exempt_no: { he: 'לא — תצטרך לעבור אותם', en: 'No — you will have to sit them' },
  exempt_unknown: { he: 'עוד לא ברור', en: 'Not clear yet' },
  d_window: { he: 'עד מתי אפשר להגיש', en: 'Deadline to apply' },
  d_open_questions: { he: 'שאלות שעוד יחדדו את התשובה', en: 'Answers that would sharpen this' },
  urgent_first: { he: 'קודם כול', en: 'First things first' },

  roadmap_title: { he: 'הדרך שלך', en: 'Your road' },
  steps_count: { he: 'שלבים', en: 'steps' },
  clocks_title: { he: 'שעונים שרצים', en: 'Clocks running' },
  standing_title: {
    he: 'חייב להתקיים לאורך כל הדרך',
    en: 'Must hold true the whole way',
  },
  standing_note: {
    he: 'שלב שכבר עברת יכול להתבטל בשקט אם אחד מאלה נשבר.',
    en: 'A step you have already passed can be quietly voided if one of these breaks.',
  },

  start_now: { he: 'להתחיל עכשיו', en: 'Start now' },
  start_now_why: {
    he: 'מגיע בהמשך, אבל לוקח זמן — התחל כבר היום',
    en: 'It comes later, but it takes time — begin today',
  },
  before: { he: 'לפני', en: 'before' },
  waiting_for: { he: 'ממתין ל', en: 'Waiting for' },
  check_first: { he: 'לבדוק לפני', en: 'Check before this' },
  bring: { he: 'לוודא', en: 'Make sure' },
  sources: { he: 'מקורות', en: 'sources' },
  show_sources: { he: 'הצג מקורות', en: 'Show sources' },
  hide_sources: { he: 'הסתר', en: 'Hide' },
  uncertain_step: {
    he: 'לא בטוח שהשלב הזה חל עליך',
    en: 'Not sure this step applies to you',
  },
  uncertain_answer: { he: 'כדי לדעת, צריך לענות על', en: 'To know, answer' },
  done: { he: 'הושלם', en: 'Done' },
  mark_done: { he: 'סמן שביצעת', en: 'Mark as done' },
  marked_done: { he: 'ביצעת', en: 'Done' },
  progress: { he: 'הושלמו', en: 'completed' },
  of: { he: 'מתוך', en: 'of' },
  updating: { he: 'מעדכן…', en: 'Updating…' },

  expired: { he: 'עבר', en: 'Passed' },
  days_left: { he: 'ימים נותרו', en: 'days left' },
  days_ago: { he: 'ימים אחורה', en: 'days ago' },
  not_started_clock: { he: 'עוד לא התחיל', en: 'Not started yet' },
  unknown_clock: { he: 'חסרה תשובה כדי להתחיל את הספירה', en: 'We need one answer to start counting' },

  blocked_orgs: { he: 'ארגונים שיכולים לעזור', en: 'Organisations that can help' },
  blocked_expected: { he: 'צפי הכרעה', en: 'Decision expected' },
  blocked_passed: {
    he: 'המועד המשוער חלף. כדאי לבדוק אם ניתן פסק דין.',
    en: 'The expected date has passed. Worth checking whether a ruling was given.',
  },

  error_title: { he: 'משהו השתבש', en: 'Something went wrong' },
  error_offline: {
    he: 'לא הצלחנו להגיע לשרת. ודא שהוא רץ על פורט 3001.',
    en: 'We could not reach the server. Check that it is running on port 3001.',
  },
} as const;
