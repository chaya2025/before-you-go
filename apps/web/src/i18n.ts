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
  /* Names the progress rail for a screen reader; the marks carry no text. */
  progress_label: { he: 'התקדמות בשאלון', en: 'Progress through the questions' },

  /* ⭐ The script kicker on the band each screen of the flow opens on, added
     23.9 with the colour pass. It is the product's own voice, one line, and it
     NEVER carries information: the heading or the lede under it says the same
     thing in plain words. Same rule the landing page's kickers follow. */
  band_kicker_intake: { he: 'מתחילים כאן', en: 'We start here' },
  band_kicker_diagnosis: { he: 'לפני שממשיכים', en: 'Before we go on' },
  band_kicker_documents: { he: 'כפי שכתוב', en: 'Exactly as written' },
  band_kicker_roadmap: { he: 'כל הדרך, לפי הסדר', en: 'The whole road, in order' },

  intro: {
    he: 'כמה שאלות קצרות, ואז מפת הדרכים שלך — כל השלבים לפי הסדר, מה נדרש בכל אחד, ומה כדאי להתחיל כבר עכשיו.',
    en: 'A few short questions, then your roadmap — every step in order, what each one needs, and what to start today.',
  },
  privacy: {
    he: 'אין צורך בהרשמה. בלי חשבון, שום דבר לא נשמר.',
    en: 'No sign-up needed. Without an account, nothing is saved.',
  },

  // ── the landing page ─────────────────────────────────────────────────────
  //
  // ⚠️ Professional and plain, per the founder's ruling on 31.8. No reassurance about
  // how hard bureaucracy is; the reassurance is knowing what you are in for.
  hero_eyebrow: {
    he: 'שירות עצמאי · אינו גוף ממשלתי',
    en: 'An independent service · not a government body',
  },
  hero_title: {
    he: 'חי בישראל בלי תעודת זהות ישראלית?',
    en: 'Living in Israel without an Israeli ID?',
  },
  /* ⭐ The second half of the headline, in amber. Kept as its own string so a
     translator can move it to where the sentence actually turns. */
  hero_title_em: { he: 'תגיע מוכן.', en: 'Arrive prepared.' },
  /**
   * ⚠️ Rewritten 22.9. The founder, reading the landing page cold: "the headline says
   * if you're not Israeli then come prepared — but someone who just opened the
   * site wouldn't even understand to what." So the first sentence now names the
   * processes; only then does it say what we do about them.
   */
  hero_lede: {
    he: 'תהליכים בירוקרטיים בישראל — רישיון נהיגה, חידוש אשרה, פתיחת חשבון בנק — בנויים למי שמחזיק תעודת זהות ישראלית. אנחנו ממפים עבורך את התהליך מול הרשות, שלב אחר שלב, ובודקים את המסמכים שברשותך מול הדרישות הרשמיות: מה תקין, מה חסר, ובמה לטפל ראשון.',
    en: 'Bureaucratic processes in Israel — a driving licence, a visa renewal, a bank account — are built for people who hold an Israeli ID. We map your process at the authority, step by step, and check the documents you hold against the official requirements: what is in order, what is missing, and what to handle first.',
  },
  hero_cta: { he: 'התחלת בדיקת מוכנות', en: 'Begin the readiness check' },
  hero_cta_secondary: { he: 'איך זה עובד', en: 'How it works' },
  hero_meta: { he: 'כ־4 דקות · ללא הרשמה', en: 'About 4 minutes · no registration' },

  // ── what the person receives ─────────────────────────────────────────────
  gets_kicker: { he: 'מה אנחנו מציעים', en: 'What we offer' },
  get_route: { he: 'התהליך המלא', en: 'The full route' },
  get_route_note: {
    he: 'כל שלב לפי הסדר, איפה מבצעים אותו, ומה לוח הזמנים.',
    en: 'Every step in order, where it is done, and its timing.',
  },
  get_docs: { he: 'בדיקת מסמכים', en: 'A document check' },
  get_docs_note: {
    he: 'הדרכון, האשרה והרישיון נבדקים זה מול זה ומול הדרישה.',
    en: 'Your passport, visa and licence checked against each other and against the requirement.',
  },
  get_first: { he: 'פעולה ראשונה אחת', en: 'One first action' },
  get_first_note: {
    he: 'מה לעשות ראשון, והסיבה שזה קודם לכל השאר.',
    en: 'What to do first, and the reason it comes before everything else.',
  },

  /* ⭐ the founder's call, 31.8, and the most important block on the page. This
     audience has learned to distrust official-looking things that are not
     official. Saying it plainly is what earns the right to ask about a visa. */
  not_gov_title: { he: 'זה אינו אתר ממשלתי', en: 'This is not a government website' },
  not_gov_body: {
    he: 'המערכת אינה מגישה בקשות ואינה מדברת עם אף רשות בשמך. היא מסבירה מה נדרש ובודקת מול מה שיש לך. אין הרשמה, ושום פרט שתזין אינו נשמר.',
    en: 'It does not submit applications and does not contact any authority on your behalf. It explains what is required and checks it against what you have. There is no sign-up, and nothing you enter is saved.',
  },

  how_kicker: { he: 'שלושה שלבים', en: 'Three stages' },
  how_title: { he: 'איך זה עובד', en: 'How it works' },
  how_note: {
    he: 'שלושה שלבים, ובסופם מפת הדרכים שלך. כל דרישה נושאת את הסעיף שממנו נלקחה.',
    en: 'Three stages, then your roadmap. Every requirement carries the clause it came from.',
  },
  beat_1: { he: 'המעמד שלך', en: 'Your status' },
  beat_1_note: {
    he: 'כמה שאלות קצרות: סוג האשרה, התאריכים, והרישיון שכבר ברשותך.',
    en: 'A few short questions: visa type, dates, and the licence you already hold.',
  },
  beat_2: { he: 'המסמכים שלך', en: 'Your documents' },
  beat_2_note: {
    he: 'מזינים את הפרטים בדיוק כפי שהם רשומים; המערכת משווה ביניהם ומול הדרישה.',
    en: 'You enter the details exactly as they appear; the system compares them against each other and against the requirement.',
  },
  beat_3: { he: 'מפת הדרכים', en: 'Your roadmap' },
  beat_3_note: {
    he: 'המסלול, כל השלבים לפי הסדר, ופעולה ראשונה אחת — כל דרישה עם הסעיף שממנו נלקחה.',
    en: 'The route, every step in order, and one first action, each requirement with the clause it came from.',
  },

  choose_kicker: { he: 'במה אנחנו מטפלים', en: 'What we cover' },
  choose_title: { he: 'התהליכים', en: 'The processes' },
  status_live: { he: 'פתוח כעת', en: 'Open now' },
  status_planned: { he: 'בפיתוח', en: 'In development' },
  process_cta: { he: 'לבדיקת המוכנות', en: 'Check my readiness' },
  process_closed: { he: 'טרם נפתח', en: 'Not yet open' },

  // ── the closing call ─────────────────────────────────────────────────────
  close_title: {
    he: 'ארבע דקות כאן, במקום יום עבודה מבוזבז שם.',
    en: 'Four minutes here, instead of a wasted day there.',
  },
  close_note: {
    he: 'ללא הרשמה, ללא שמירת פרטים, וכל דרישה נושאת את הסעיף שממנו נלקחה.',
    en: 'No registration, nothing stored, and every requirement carries the clause it came from.',
  },
  at_authority: { he: 'מול', en: 'With' },

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
   * ⚠️ the founder, 30.8, using the site: "it asks when he came back to Israel. What
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
   * feature, reported as done. Found by the founder inside ten minutes of using it.
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
  /**
   * ⭐⭐ ASKED FOR THE FIRST TIME ON 23.9, AND IT HAD BEEN MISSING ALL ALONG.
   *
   * `held_class` is one of the four conditions in EXEMPT_FROM_TESTS, it is in
   * the Profile schema, the audit personas set it, and `f_held_class` below has
   * been sitting here as a label for a question nothing ever asked. No screen
   * collected it, so the field arrived 'unknown' on every single request the
   * website ever made, `in` on an unknown is unknown, and the exemption could
   * therefore never resolve for anybody. Every converter was told "עוד לא ברור"
   * and carried מבחן שליטה and בדיקת ראייה on his road, however many years he
   * had been driving.
   *
   * ⚠️ It is the grade he HOLDS, which is not the grade he is asking for. ס' 2
   * requires the five years to be ON a grade in תקנות 176-180, so a man with
   * twenty years on a C1 is not exempt even though C1 is convertible. Two
   * different questions about two different documents, and collapsing them is
   * exactly the bug steps.conversion.ts records for 30.8.
   */
  q_held_class: { he: 'איזו דרגה כתובה ברישיון שלך היום?', en: 'Which grade is on your licence today?' },
  q_held_class_help: {
    he: 'כפי שמופיע על הרישיון הזר. יחד עם הוותק, זה מה שקובע אם מגיע לך פטור ממבחן שליטה ומבדיקת ראייה.',
    en: 'As printed on the foreign licence. Together with the seniority, this is what decides whether the exemption from the control test and eye test applies to you.',
  },
  q_class: { he: 'לאיזו דרגה אתה רוצה להמיר?', en: 'Which grade do you want to convert to?' },
  /* ⚠️ Says why it is worth answering, without making it compulsory. The
     exemption needs BOTH grades, so leaving this blank keeps the answer at
     "עוד לא ברור" — and until 23.9 nothing on the screen said so. */
  q_class_help: {
    he: 'אפשר לדלג, אבל בלי זה לא נוכל לומר לך אם אתה פטור ממבחן שליטה ומבדיקת ראייה.',
    en: 'You can skip this, but without it we cannot tell you whether the control test and eye test exemption applies.',
  },
  /**
   * ⭐⭐ 23.9. This question is asked ONLY of someone who has said five years or
   * more, because ס' 2 gives the exemption to nobody else — so for anyone else
   * the רקורד buys nothing and asking about it is pure confusion.
   *
   * The founder: "some people don't even know what it is. Say that it's only needed,
   * or it's an option. Don't make it complicated."
   */
  q_record: {
    he: 'יש לך "רקורד" ממדינת המוצא?',
    en: 'Do you have a "record" from your home country?',
  },
  q_record_help: {
    he: 'לא חובה. זה מסמך מהרשות שהנפיקה לך את הרישיון במדינת המוצא, שכתוב בו מתי קיבלת את הרישיון הקבוע. אם יש לך אותו — אתה פטור ממבחן שליטה ומבדיקת ראייה. אם אין — אתה עדיין ממיר, פשוט עובר את שתי הבדיקות.',
    en: 'Not required. It is a document from the authority that issued your licence abroad, stating when you received your permanent licence. With it you skip the control test and the eye test. Without it you still convert, you just sit those two.',
  },
  dont_know_record: { he: 'לא יודע מה זה', en: 'I do not know what that is' },
  record_optional_tag: { he: 'לא חובה', en: 'Optional' },

  /**
   * ⚠️ the founder, 30.8: "it asks some questions which the next step will be asking
   * anyway." The visa was asked TWICE — a yes/no here, and an expiry date on
   * the documents screen. Two questions about one fact.
   *
   * ⭐ The date wins, because it is strictly more informative: it settles
   * validity AND powers the reminder that renewal takes about a month. But the
   * yes/no had a real reason to exist too — it is answerable from memory while
   * standing in a queue, and a date is not.
   *
   * So: ask for the date, and let "I do not have it with me" fall back to the
   * question that needs no document. One question for most people, two only
   * for the person who genuinely cannot answer the first.
   */
  q_visa_expires: { he: 'עד מתי האשרה שלך בתוקף?', en: 'Until when is your visa valid?' },
  q_visa_expires_help: {
    he: 'הזכאות נבחנת ליום ההגשה, לא ליום הכניסה. חודש ושנה מספיקים.',
    en: 'Eligibility is judged on the day you apply, not the day you entered. Month and year is enough.',
  },
  q_visa_no_doc: { he: 'האשרה לא מולי כרגע', en: 'I do not have it with me' },
  q_visa_valid: { he: 'האם היא בתוקף, למיטב ידיעתך?', en: 'Is it valid, as far as you know?' },
  q_visa_valid_help: {
    he: 'בלי תאריך מדויק, זה מספיק כדי להתחיל.',
    en: 'Without an exact date, this is enough to get started.',
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
  /**
   * ⭐⭐ SPLIT IN TWO, 23.9 (the founder): "make sure nothing that doesn't need
   * mentioning is mentioned for no reason."
   *
   * The 89 clarification exists for a real reason — גיליון 11 שאלה 1 found that
   * people mistake their 89 for a teudat zehut and then answer this question
   * wrongly, which misroutes everything. But the 89 left the conversion road on
   * 23.9, and most converters have never held one. Naming an unfamiliar
   * document inside a question about a different document is exactly the noise
   * she is cutting.
   *
   * So: everyone gets the blue card. Only the FROM-ZERO road, where the 89 is
   * the first stop and the confusion is live, gets the second sentence.
   */
  confirm_tz_explain: {
    he: 'תעודת זהות היא הכרטיס הכחול עם הספח.',
    en: 'A teudat zehut is the blue card with the attached page.',
  },
  confirm_tz_explain_89: {
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

  /* ── the states nobody designs ─────────────────────────────────────────
     Waiting, failing, and being handed a sheet of paper. A product is judged
     on these far more than on the screen where everything went right. */
  loading_form: { he: 'טוענים את השאלות…', en: 'Loading the questions…' },
  updating_road: { he: 'מעדכנים את הדרך…', en: 'Updating the road…' },
  retry: { he: 'נסה שוב', en: 'Try again' },
  error_step: {
    he: 'לא הצלחנו לעדכן את השלב, והסימון בוטל. שום דבר לא נשמר.',
    en: 'We could not update the step, so the tick was undone. Nothing was saved.',
  },
  print_page: { he: 'הדפסה, לקחת איתך', en: 'Print it, take it with you' },
  printed_on: { he: 'הודפס בתאריך', en: 'Printed on' },
  printed_note: {
    he: 'הנהלים משתנים. אם עברו שבועות מאז ההדפסה, כדאי להיכנס שוב ולבדוק.',
    en: 'Procedures change. If weeks have passed since this was printed, come back and check.',
  },
  print_tick: { he: 'בוצע', en: 'Done' },
  back: { he: 'לא נכון, תקן', en: 'Not right, fix it' },

  // ── the documents screen (ש7) ────────────────────────────────────────────
  //
  // ⭐ the founder, 30.8: "don't drive the user crazy. Just tell them upload this,
  // this, this, and the system would realize itself what is not valid."
  //
  // So every label here asks him to READ something, never to judge anything.
  // He is never asked whether his documents agree. He is asked what they say.

  docs_title: {
    he: 'המסמכים שבידך',
    en: 'The documents you are holding',
  },
  docs_intro: {
    he: 'יש להעתיק את הפרטים כפי שהם מופיעים על המסמכים. המערכת משווה ביניהם ומדווחת מה תקין ומה לא. אין חובה למלא את כל השדות.',
    en: 'Enter the details exactly as they appear on the documents. The system compares them and reports what is in order and what is not. No field is mandatory.',
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
  /* ⚠️ Names what to do, not what went wrong. The field messages already say
     what went wrong; this says why the button will not move. */
  docs_fix_first: {
    he: 'יש שדה הדורש תיקון לפני המשך. הוא מסומן למעלה.',
    en: 'A field requires correction before continuing. It is marked above.',
  },

  /* ── "do you have it?", asked before any field ───────────────────────────
     ⭐ Added 22.9. The founder: an א/2 with no teudat zehut and no licence "gives him
     to fill in the 89 field which he doesn't even have one." The screen now
     asks first and shows the boxes only on a yes.

     ⚠️ The wording carries no blame and no alarm. Not having been issued a
     document yet is the ordinary state of a person at the start of his route,
     and it is precisely what step one of his roadmap is for. */
  d_have_it: {
    he: 'המסמך הזה ברשותך?',
    en: 'Do you have this document?',
  },
  d_have_it_yes: { he: 'כן, הוא מולי', en: 'Yes, it is in front of me' },
  d_have_it_no: { he: 'לא, טרם הוצאתי אותו', en: 'No, I have not been issued one' },
  d_have_it_no_note: {
    he: 'בסדר גמור. הוצאת המסמך מופיעה כשלב במפת הדרכים שלך, ולא נשאל עליו שום דבר נוסף.',
    en: 'That is fine. Obtaining it is a step on your roadmap, and nothing further is asked about it here.',
  },

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
  /**
   * ⭐ SPLIT 23.9, same reason as `confirm_tz_explain`. The 89 version exists
   * because the whole point of this field is catching a passport that was
   * renewed AFTER the 89 was printed — a real case. But the 89 left the
   * conversion road, so a converter was being told to distinguish his passport
   * from one issued with a document he has never held.
   */
  d_passport_help: {
    he: 'הדרכון שבידך עכשיו, כפי שהוא מודפס בו.',
    en: 'The passport you hold now, exactly as it is printed in it.',
  },
  d_passport_help_89: {
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

  // ── the readiness report ─────────────────────────────────────────────────
  //
  // ⚠️ Chrome only. Every sentence ABOUT his documents is written in the engine,
  // in both languages, next to the rule it came from — so the website cannot
  // soften a warning or harden a maybe.
  // ── the plain-language layer ─────────────────────────────────────────────
  plain_title: { he: 'במילים פשוטות', en: 'In plain words' },
  plain_intro: {
    he: 'סיכום קצר של כל מה שמופיע למטה. התשובה עצמה כבר חושבה; זהו ניסוח שלה.',
    en: 'A short summary of everything below. The answer itself is already determined; this is a wording of it.',
  },
  plain_offline: {
    // ⚠️ Says the layer is switched off, not that something broke. Different
    // sentence, different meaning, and the user deserves the true one.
    he: 'הניסוח האוטומטי אינו פעיל. יוצג סיכום המורכב מתוך הכללים עצמם.',
    en: 'Automatic wording is not active. A summary assembled from the rules themselves will be shown.',
  },
  plain_ask: { he: 'הצג סיכום במילים פשוטות', en: 'Show a plain-language summary' },
  /* ⚠️ Attribution, always. A person reading a government answer is entitled to
     know which sentences a language model wrote. */
  plain_by_model: {
    he: '✍️ הניסוח נכתב על ידי מודל שפה על בסיס התשובה שכבר חושבה. לא נוספו, הוסרו או שונו שלבים. הפירוט המדויק מופיע למטה.',
    en: '✍️ Worded by a language model from the answer already determined. No step was added, removed or changed. The exact detail appears below.',
  },
  plain_by_rules: {
    he: '📋 סיכום זה מורכב מהכללים עצמם, ללא מודל שפה.',
    en: '📋 This summary is assembled from the rules themselves, without a language model.',
  },

  readiness_title: { he: 'סטטוס המסמכים', en: 'Document status' },
  r_first_action: { he: 'הדבר הראשון לעשות', en: 'The first thing to do' },
  r_why: { he: 'למה דווקא הוא', en: 'Why this one' },
  r_needed_for: { he: 'נדרש ב', en: 'Needed for' },

  /* ⚠️ Four headings, never merged. "לא שאלנו" and "אין לך" are different facts
     about a person, and one heading over both makes the honest one frightening. */
  r_mismatched: { he: 'ברשותך, אך לא יתקבל במצבו הנוכחי', en: 'In your possession, but not acceptable as it is' },
  r_missing: { he: 'אינו ברשותך', en: 'Not in your possession' },
  r_unconfirmed: { he: 'טרם נבדק', en: 'Not yet checked' },
  r_ready: { he: 'ברשותך ותקין', en: 'In your possession and in order' },

  /* The road, cut into three named parts. "What do I do today" is the only
     question this screen exists to answer, so the parts say it out loud. */
  /* Where a step happens. The WHERE is what he plans his day around. */
  ch_online: { he: 'אונליין', en: 'Online' },
  ch_licensing_office: { he: 'במשרד הרישוי', en: 'At the licensing office' },
  ch_post_office: { he: 'בסניף דואר', en: 'At a post office' },
  ch_photo_station: { he: 'בתחנת צילום', en: 'At a photo station' },
  ch_driving_school: { he: 'בבית ספר לנהיגה', en: 'At a driving school' },
  ch_test_center: { he: 'במרכז בחינות', en: 'At a test centre' },
  ch_population_authority: { he: 'ברשות האוכלוסין', en: 'At the Population Authority' },
  ch_origin_country: { he: 'במדינת המוצא', en: 'In the country of origin' },
  ch_mail: { he: 'מגיע בדואר', en: 'Arrives by post' },
  ch_unknown: { he: 'לא ידוע היכן', en: 'Where is not known' },

  /* The figures at the top of the answer. Each one is a number he would
     otherwise have to work out by reading the whole page. */
  fig_steps_left: { he: 'שלבים שנותרו', en: 'Steps left' },
  fig_of: { he: 'מתוך', en: 'of' },
  fig_days_left: { he: 'ימים', en: 'days' },
  fig_no_clock: { he: 'אין שעון שרץ', en: 'No clock running' },
  fig_docs_ok: { he: 'מסמכים תקינים', en: 'Documents in order' },
  fig_docs_problem: { he: 'מסמכים לטפל בהם', en: 'Documents to deal with' },
  fig_problem_note: { he: 'חסר או לא תואם', en: 'Missing or mismatched' },

  /* Ask about your case. A chat, once it is one. */
  ask_open: { he: 'שאלה על התיק שלך', en: 'Ask about your case' },
  ask_close: { he: 'סגירה', en: 'Close' },
  ask_soon: {
    he: 'כרגע כאן אפשר לקבל סיכום במילים פשוטות. שאלות חופשיות יתווספו בהמשך.',
    en: 'For now this gives a summary in plain words. Free questions will come later.',
  },

  road_now: { he: 'עכשיו', en: 'Now' },
  road_now_note: {
    he: 'מה שאפשר להתחיל בו היום. השאר ממתין לזה.',
    en: 'What can be started today. The rest waits on it.',
  },
  road_next: { he: 'בהמשך הדרך', en: 'Further along' },
  road_next_note: {
    he: 'כל השלבים לפי הסדר, כדי שתדע למה לצפות.',
    en: 'Every step in order, so you know what is coming.',
  },
  road_done: { he: 'שכבר ביצעת', en: 'Already done' },
  road_empty_now: {
    he: 'אין שלב שאפשר להתחיל בו כרגע — פתח את השלבים שבהמשך כדי לראות במה זה תלוי.',
    en: 'Nothing can be started right now. Open the steps further along to see what it waits on.',
  },
  /**
   * ⚠️ The road with every step ticked. Until M5 it got road_empty_now, which
   * sends him to "the steps further along" — a part that is not on the page,
   * because there are none left. This is the one screen in the product that
   * gets to say a thing is finished, and it still has to say what to do if
   * the world changed, because these procedures do.
   */
  road_all_done: {
    he: 'סימנת את כל השלבים בדרך הזאת. אם משהו השתנה או לא יצא — בטל סימון של שלב והדרך תיבנה מחדש.',
    en: 'Every step on this road is ticked. If something changed or did not work out, untick a step and the road is rebuilt.',
  },

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

  /* ⚠️ "שווה לבדוק", not "שגיאה". The engine's cross-field checks warn and never
     block — F1 validation 2 — and the heading has to carry that or the quiet
     block below it reads as a rejection. See components/Warnings.tsx. */
  warn_title: { he: 'שתי תשובות שלא לגמרי מסתדרות', en: 'Two answers that do not quite agree' },
  warn_note: {
    he: 'זה לא עוצר כלום, והדרך למטה נכונה כפי שהיא. אם אחת מהתשובות לא מדויקת, שווה לחזור ולתקן.',
    en: 'Nothing here stops you, and the road below stands as it is. If one of these answers is not accurate, it is worth going back and correcting it.',
  },

  start_now: { he: 'להתחיל עכשיו', en: 'Start now' },
  start_now_why: {
    he: 'מגיע בהמשך, אבל לוקח זמן — התחל כבר היום',
    en: 'It comes later, but it takes time — begin today',
  },
  before: { he: 'לפני', en: 'before' },
  waiting_for: { he: 'ממתין ל', en: 'Waiting for' },
  /** On a step the order will not let him start yet, in place of the tick. */
  locked_until: { he: 'אפשר לסמן רק אחרי:', en: 'Can be ticked only after:' },
  check_first: { he: 'לבדוק לפני', en: 'Check before this' },
  /**
   * ⭐ Replaces the standing conditions that used to be reprinted in full
   * inside every step that they guard. It points at the list rather than
   * repeating it, so the wording of a rule lives in exactly one place.
   */
  standing_here: { he: 'חלים כאן תנאים קבועים', en: 'Standing conditions apply here' },
  /**
   * ⚠️ On screen the marker is a link and one tap takes him to the list. On
   * paper there is nothing to tap, so the sheet has to say where to look.
   */
  standing_on_paper: {
    he: 'ברשימה "חייב להתקיים לאורך כל הדרך", בסוף הדף',
    en: 'in the "must hold throughout" list, at the end of the sheet',
  },
  bring: { he: 'לוודא', en: 'Make sure' },
  sources: { he: 'מקורות', en: 'sources' },
  show_sources: { he: 'הצג מקורות', en: 'Show sources' },
  hide_sources: { he: 'הסתר', en: 'Hide' },
  uncertain_step: {
    he: 'לא בטוח שהשלב הזה חל עליך',
    en: 'Not sure this step applies to you',
  },
  uncertain_answer: { he: 'כדי לדעת, צריך לענות על', en: 'To know, answer' },

  /**
   * ⭐⭐ 23.9. Two places printed ENGINE FIELD NAMES straight at the reader —
   * the diagnosis ("שאלות שעוד יחדדו את התשובה: has_record_document,
   * held_class, requested_class") and the undecided-step line on the road.
   * Found by walking the real page.
   *
   * A person cannot answer `has_record_document`. He can answer "whether you
   * have a רקורד". Same rule as the raw step ids caught on 22.9: an internal
   * name that reaches the reader is a bug, not a detail.
   *
   * ⚠️ `fieldLabel` falls back to the raw name rather than hiding an unlabelled
   * field. Silence would be worse: he would be told to answer something and
   * not told what.
   */
  f_visa_type: { he: 'סוג האשרה שלך', en: 'your visa type' },
  f_has_teudat_zehut: { he: 'אם יש לך תעודת זהות', en: 'whether you have a teudat zehut' },
  f_visa_valid_now: { he: 'אם האשרה בתוקף', en: 'whether your visa is valid' },
  f_foreign_license_kind: { he: 'איזה רישיון זר יש לך', en: 'which foreign licence you hold' },
  f_foreign_license_valid: { he: 'אם הרישיון הזר בתוקף', en: 'whether your foreign licence is valid' },
  f_foreign_license_years: { he: 'כמה שנים הרישיון שלך בתוקף', en: 'how many years you have held your licence' },
  f_held_class: { he: 'איזו דרגה יש לך היום', en: 'the grade you hold today' },
  f_requested_class: { he: 'לאיזו דרגה אתה רוצה להמיר', en: 'the grade you want to convert to' },
  f_has_record_document: { he: 'אם יש לך "רקורד"', en: 'whether you have a "record"' },
  f_lived_abroad_6_months_continuous: { he: 'אם שהית חצי שנה רצופה בחו"ל', en: 'whether you spent six consecutive months abroad' },
  f_origin_country: { he: 'מדינת המוצא', en: 'your home country' },
  f_nohal_category: { he: 'הקטגוריה שלך בנוהל', en: 'your category in the procedure' },
  f_track: { he: 'המסלול שלך', en: 'your route' },
  f_months_since_anchor: { he: 'מתי נכנסת / עלית / שבת', en: 'when you entered, made aliyah, or returned' },
  f_age_years: { he: 'באיזו שנה נולדת', en: 'the year you were born' },
  f_months_until_visa_expiry: { he: 'עד מתי האשרה בתוקף', en: 'when your visa expires' },
  f_passport_valid_now: { he: 'אם הדרכון בתוקף', en: 'whether your passport is valid' },
  f_months_until_passport_expiry: { he: 'עד מתי הדרכון בתוקף', en: 'when your passport expires' },
  f_passport_89_number_match: { he: 'מספר הדרכון שעל מסמך ה-89', en: 'the passport number on your 89' },
  f_passport_89_name_match: { he: 'השם שעל מסמך ה-89', en: 'the name on your 89' },
  f_passport_license_name_match: { he: 'השם שעל הרישיון הזר', en: 'the name on your foreign licence' },
  f_months_until_license_expiry: { he: 'עד מתי הרישיון הזר בתוקף', en: 'when your foreign licence expires' },
  f_foreign_license_language: { he: 'באיזו שפה כתוב הרישיון', en: 'what language your licence is in' },
  f_holds_form_89: { he: 'אם מסמך ה-89 בידך', en: 'whether you hold your 89' },
  done: { he: 'הושלם', en: 'Done' },
  /* The state of a step, in a word. ⚠️ A word, never an emoji on its own: a
     screen reader reads an emoji out as its own name, and nobody translates it. */
  state_done: { he: 'בוצע', en: 'Done' },
  state_do_now: { he: 'עכשיו', en: 'Now' },
  state_uncertain: { he: 'לא ודאי', en: 'Not certain' },
  state_waiting_on: { he: 'ממתין', en: 'Waiting' },
  state_later: { he: 'בהמשך', en: 'Later' },

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
    he: 'לא הצלחנו להגיע לשרת. בדוק את החיבור לאינטרנט ונסה שוב. שום דבר שענית לא אבד.',
    en: 'We could not reach the server. Check your connection and try again. Nothing you answered was lost.',
  },

  // ── Accounts (M1). Optional: every screen works without one (D-146). ──
  acct_open: { he: 'התחברות / הרשמה', en: 'Log in / Sign up' },
  acct_open_short: { he: 'כניסה', en: 'Log in' },
  acct_menu: { he: 'החשבון שלי', en: 'My account' },
  acct_logout: { he: 'התנתקות', en: 'Log out' },
  acct_close: { he: 'סגירה', en: 'Close' },
  acct_login_title: { he: 'התחברות', en: 'Log in' },
  acct_signup_title: { he: 'יצירת חשבון', en: 'Create an account' },
  acct_why: {
    he: 'חשבון שומר את התשובות שלך, כדי שבפעם הבאה תמשיך מאיפה שעצרת. אפשר להשתמש באתר גם בלי חשבון.',
    en: 'An account keeps your answers, so next time you pick up where you left off. The site works without one too.',
  },
  acct_google: { he: 'המשך עם Google', en: 'Continue with Google' },
  acct_or: { he: 'או עם אימייל', en: 'or with email' },
  acct_email: { he: 'אימייל', en: 'Email' },
  acct_password: { he: 'סיסמה', en: 'Password' },
  acct_password_note: { he: 'לפחות 8 תווים.', en: 'At least 8 characters.' },
  acct_do_login: { he: 'התחברות', en: 'Log in' },
  acct_do_signup: { he: 'יצירת חשבון', en: 'Create account' },
  acct_to_signup: { he: 'אין לך חשבון? יצירת חשבון', en: 'No account? Create one' },
  acct_to_login: { he: 'כבר יש לך חשבון? התחברות', en: 'Already have an account? Log in' },
  acct_forgot: { he: 'שכחת סיסמה?', en: 'Forgot your password?' },
  acct_forgot_title: { he: 'איפוס סיסמה', en: 'Reset your password' },
  acct_forgot_note: {
    he: 'נשלח לכתובת הזו קישור לבחירת סיסמה חדשה.',
    en: "We'll send this address a link to choose a new password.",
  },
  acct_send_link: { he: 'שליחת קישור', en: 'Send the link' },
  acct_back_login: { he: 'חזרה להתחברות', en: 'Back to log in' },
  acct_sent_title: { he: 'בדוק את תיבת המייל', en: 'Check your email' },
  acct_sent_signup: {
    he: 'שלחנו לך מייל עם קישור לאישור החשבון. לא הגיע? ייתכן שכבר יש לך חשבון: נסה להתחבר.',
    en: "We sent you an email with a link to confirm the account. Nothing arrived? You may already have an account: try logging in.",
  },
  acct_sent_reset: {
    he: 'בדוק את תיבת המייל: אם יש חשבון עם הכתובת הזו, שלחנו אליה מייל לאיפוס הסיסמה.',
    en: 'Check your email: if this address has an account, we sent it a password reset email.',
  },
  acct_expired_title: { he: 'הקישור כבר לא בתוקף', en: 'This link no longer works' },
  acct_expired_body: {
    he: 'הקישור כבר נוצל או שפג תוקפו. כל קישור עובד פעם אחת בלבד, מטעמי אבטחה. אפשר לשלוח קישור חדש.',
    en: 'The link was already used or has expired. Each link works only once, for security. You can send a new one.',
  },
  acct_send_new: { he: 'שליחת קישור חדש', en: 'Send a new link' },
  acct_newpass_title: { he: 'בחירת סיסמה חדשה', en: 'Choose a new password' },
  acct_save_password: { he: 'שמירת הסיסמה', en: 'Save password' },
  acct_password_saved: { he: 'הסיסמה עודכנה, ואתה מחובר.', en: "Password updated. You're logged in." },
  acct_err_bad_login: { he: 'האימייל או הסיסמה לא נכונים.', en: 'The email or password is wrong.' },
  acct_err_not_confirmed: {
    he: 'החשבון עוד לא אושר. חפש את המייל שלנו עם קישור האישור.',
    en: "The account isn't confirmed yet. Look for our email with the confirmation link.",
  },
  acct_err_weak_password: { he: 'הסיסמה קצרה מדי. לפחות 8 תווים.', en: 'The password is too short. At least 8 characters.' },
  acct_err_bad_email: { he: 'כתובת האימייל לא נראית תקינה.', en: "That email address doesn't look right." },
  acct_err_rate_limited: { he: 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.', en: 'Too many tries. Try again in a few minutes.' },
  acct_err_network: { he: 'אין חיבור כרגע. נסה שוב.', en: 'No connection right now. Try again.' },
  acct_err_unknown: { he: 'משהו השתבש. נסה שוב.', en: 'Something went wrong. Try again.' },
} as const;

/**
 * ⭐⭐ An engine field name, in words a person can act on (23.9).
 *
 * The engine names the fact; this names the QUESTION. Falls back to the raw
 * id rather than hiding an unlabelled field — being told to answer something
 * and not told what is worse than seeing the id.
 */
export function fieldLabel(field: string, lang: Lang): string {
  const key = `f_${field}` as keyof typeof UI;
  const entry = UI[key];
  return entry ? pick(entry, lang) : field;
}
