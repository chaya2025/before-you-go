import type { Lang } from '../i18n';

/**
 * M1 milestone 4 (D-164): the privacy page, at /privacy. Google links to it
 * from the sign-in screen, so it has its own address and says plainly what
 * the site keeps, what it never keeps, who else sees anything, and how to
 * delete it all.
 *
 * ⚠️ Every line here is a promise the code keeps. If what is saved changes
 * (account.ts NEVER_STORED, the cases table, explain.ts), this page changes
 * in the same commit.
 */

/**
 * Who to write to. The founder's own Gmail for now (D-169, her call); swapped for a
 * site Gmail once the name is final.
 */
const CONTACT = 'reichmanchaya1@gmail.com';

type Section = { h: string; p?: string; li?: string[]; note?: string };

const PAGE: Record<Lang, { title: string; updated: string; back: string; sections: Section[]; contact: string }> = {
  he: {
    title: 'פרטיות',
    updated: 'עודכן לאחרונה: 3.11.2026',
    back: 'חזרה',
    sections: [
      {
        h: 'בלי חשבון',
        p: 'אפשר להשתמש באתר בלי להירשם. בלי חשבון, התשובות לא נשמרות: הן נשארות בדפדפן שלך עד שסוגרים את הדף.',
      },
      {
        h: 'צילומי מסמכים',
        li: [
          'צילום שהעלית נשלח ל-Claude של חברת Anthropic בארה״ב כדי לקרוא אותו.',
          'הצילום נמחק מיד אחרי קריאה מוצלחת. אם הקריאה נכשלה או שההעלאה לא הושלמה, הוא נמחק אוטומטית תוך יומיים לכל היותר.',
          'נשמר רק מספר המסמכים שהמערכת קראה בשבילך, כדי לשמור על מגבלת השימוש.',
        ],
      },
      {
        h: 'עם חשבון, מה נשמר',
        li: [
          'כתובת האימייל, ואם נכנסת עם Google גם השם והתמונה ש-Google מעביר.',
          'התשובות שנתת לשאלות (סוג האשרה, תאריכי תוקף, רישיון זר וכדומה).',
          'אילו שלבים סימנת כבוצעו, ומתי אישרת את הפרטים לאחרונה.',
          'השפה שבחרת.',
        ],
      },
      {
        h: 'מה לעולם לא נשמר',
        p: 'מספר דרכון, מספר טופס 89, והשם באותיות לטיניות. אלה לא נשמרים גם כשיש לך חשבון, ומסד הנתונים עצמו חוסם אותם.',
      },
      {
        h: 'מי עוד רואה',
        li: [
          'המידע שלך שמור אצל ספק ענן מאובטח באיחוד האירופי. רק לך יש גישה לתיק שלך.',
          'שרתי האתר לא שומרים את התשובות שלך ולא רושמים אותן.',
          'לקריאת מסמכים ולכתיבת הסברים, הפרטים הנדרשים נשלחים ל-Claude של חברת Anthropic בארה״ב. Anthropic לא משתמשת בהם לאימון המודלים שלה.',
          'אנחנו לא מוכרים מידע, לא מציגים פרסומות ולא משתמשים בכלי מעקב.',
        ],
        note: 'Storage: Supabase (EU, Frankfurt). Hosting and uploads: AWS (EU, Frankfurt). Document reading and explanations: Claude, Anthropic (USA).',
      },
      {
        h: 'מחיקה',
        p: 'בהגדרות החשבון יש "מחיקת החשבון". זה מוחק לצמיתות את הכניסה, את כל התיקים, את השפה ואת מונה המסמכים שנקראו. אין דרך לשחזר.',
      },
    ],
    contact: 'שאלות על פרטיות:',
  },
  en: {
    title: 'Privacy',
    updated: 'Last updated: 3 November 2026',
    back: 'Back',
    sections: [
      {
        h: 'Without an account',
        p: 'You can use the site without signing up. Without an account your answers are not saved: they stay in your browser until you close the page.',
      },
      {
        h: 'Document photos',
        li: [
          'A photo you upload is sent to Claude (Anthropic, USA) to be read.',
          "The photo is deleted right after a successful read. If the read fails or the upload isn't finished, it's deleted automatically within 2 days at most.",
          'Only the number of documents the system read for you is kept, to enforce the usage limit.',
        ],
      },
      {
        h: 'With an account, what is saved',
        li: [
          'Your email address, and if you log in with Google, the name and photo Google passes on.',
          'Your answers to the questions (visa type, expiry dates, foreign licence and so on).',
          'Which steps you marked done, and when you last confirmed your details.',
          'The language you chose.',
        ],
      },
      {
        h: 'What is never saved',
        p: 'Passport numbers, form 89 numbers, and your name in Latin letters. These are not saved even with an account, and the database itself refuses them.',
      },
      {
        h: 'Who else sees it',
        li: [
          'Your data is stored with a secure cloud provider in the EU. Only you can access your case.',
          'The site’s servers do not keep or log your answers.',
          'To read documents and write explanations, the details needed are sent to Claude (Anthropic, USA). Anthropic does not use them to train its models.',
          'We do not sell data, show ads, or use tracking tools.',
        ],
        note: 'Storage: Supabase (EU, Frankfurt). Hosting and uploads: AWS (EU, Frankfurt). Document reading and explanations: Claude, Anthropic (USA).',
      },
      {
        h: 'Deleting',
        p: 'Account settings has "Delete my account". It permanently deletes your login, every saved case, your language and the count of documents read. It cannot be undone.',
      },
    ],
    contact: 'Questions about privacy:',
  },
};

export function Privacy({ lang, onBack }: { lang: Lang; onBack: () => void }) {
  const p = PAGE[lang];
  return (
    <main className="page stack privacy">
      <button className="btn btn-quiet back-link" onClick={onBack}>{p.back}</button>
      <h2>{p.title}</h2>
      <p className="muted small">{p.updated}</p>
      {p.sections.map((s) => (
        <section key={s.h} className="stack-sm">
          <h3>{s.h}</h3>
          {s.p && <p>{s.p}</p>}
          {s.li && (
            <ul>
              {s.li.map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
          {s.note && <p className="muted small ltr">{s.note}</p>}
        </section>
      ))}
      {CONTACT && (
        <p>
          {p.contact} <a className="ltr" href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      )}
    </main>
  );
}
