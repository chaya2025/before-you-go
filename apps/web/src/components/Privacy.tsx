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
 * Who to write to. Chaya's own Gmail for now (D-169, her call); swapped for a
 * site Gmail once the name is final.
 */
const CONTACT = 'reichmanchaya1@gmail.com';

type Section = { h: string; p?: string; li?: string[] };

const PAGE: Record<Lang, { title: string; updated: string; back: string; sections: Section[]; contact: string }> = {
  he: {
    title: 'פרטיות',
    updated: 'עודכן לאחרונה: 5.10.2026',
    back: 'חזרה',
    sections: [
      {
        h: 'בלי חשבון',
        p: 'אפשר להשתמש באתר בלי להירשם. בלי חשבון, שום דבר לא נשמר: התשובות נשארות בדפדפן שלך עד שסוגרים את הדף.',
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
          'הנתונים שמורים אצל Supabase, בשרתים באיחוד האירופי (פרנקפורט). רק אתה יכול לקרוא את התיק שלך: מסד הנתונים חוסם כל אחד אחר.',
          'האתר רץ על Render. השרת לא שומר את התשובות שלך ולא רושם אותן ביומנים.',
          'כשמבקשים הסבר במילים פשוטות, סיכום של ההחלטה (בלי שם ובלי מספרי מסמכים) נשלח ל-Claude של Anthropic כדי לנסח אותו.',
          'אנחנו לא מוכרים מידע, לא מציגים פרסומות ולא משתמשים בכלי מעקב.',
        ],
      },
      {
        h: 'מחיקה',
        p: 'בהגדרות החשבון יש "מחיקת החשבון". זה מוחק לצמיתות את הכניסה, את כל התיקים ואת השפה. אין דרך לשחזר.',
      },
    ],
    contact: 'שאלות על פרטיות:',
  },
  en: {
    title: 'Privacy',
    updated: 'Last updated: 5 October 2026',
    back: 'Back',
    sections: [
      {
        h: 'Without an account',
        p: 'You can use the site without signing up. Without an account nothing is saved: your answers stay in your browser until you close the page.',
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
        h: 'Who else sees anything',
        li: [
          'Data is kept by Supabase, on servers in the EU (Frankfurt). Only you can read your case: the database blocks everyone else.',
          'The site runs on Render. The server does not keep your answers and does not write them to its logs.',
          'When you ask for a plain-words explanation, a summary of the decision (no name, no document numbers) is sent to Anthropic’s Claude to word it.',
          'We do not sell data, show ads, or use tracking tools.',
        ],
      },
      {
        h: 'Deleting',
        p: 'Account settings has "Delete my account". It permanently deletes your login, every saved case and your language. It cannot be undone.',
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
