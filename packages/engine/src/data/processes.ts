import { z } from 'zod';
import { Text } from '../domain';

/**
 * ============================================================================
 * PROCESSES — what this system can check you are ready for
 * ============================================================================
 *
 * ⭐ Added 31.8, when the landing page needed something to offer. Until now the
 * first thing a stranger saw was "מה המעמד שלך בישראל?" — a question about his
 * immigration status, asked by a site he knew nothing about.
 *
 * ⚠️ THIS IS A LIST, NOT AN ARCHITECTURE, AND THAT IS DELIBERATE.
 *
 * The engine still knows exactly one process. Nothing here scopes a step, a
 * document or a rule; `evaluate()` is unchanged and still answers only about a
 * driving licence. What this adds is the SEAM — the website asks the server
 * which processes exist, exactly as it already asks which visa types exist, so
 * it holds no domain knowledge of its own.
 *
 * When a second process becomes real, this list grows and the engine gets
 * scoped THEN. Refactoring every rule to carry a process id today, for one
 * process, would be building the cathedral — the founder's own rule for this project:
 * "לא להתחיל בענק, כל דבר שאני עושה, לרשום ולחשוב."
 *
 * ⚠️ 'planned' means planned. It is rendered as not-yet-available and it is not
 * clickable. A landing page that lets you press a button leading nowhere is a
 * small lie, and this product's whole argument is that it does not tell them.
 */

export const Process = z.object({
  id: z.string().min(1),
  name: Text,
  /** One line. What the process is, in the user's terms, not the authority's. */
  summary: Text,
  /** Who you actually deal with. Concrete beats abstract for a nervous reader. */
  authority: Text,

  /**
   * 'live'    — the engine can answer about this today.
   * 'planned' — named honestly, offered to nobody.
   */
  status: z.enum(['live', 'planned']),
});
export type Process = z.infer<typeof Process>;
export type ProcessInput = z.input<typeof Process>;

export const PROCESSES: ProcessInput[] = [
  {
    id: 'driving_license',
    status: 'live',
    name: { he: "רישיון נהיגה ישראלי", en: 'Israeli driving licence' },
    summary: {
      he: "המרת רישיון מחו״ל או הוצאת רישיון מאפס, למי שאין לו תעודת זהות כחולה.",
      en: 'Converting a licence from abroad, or getting one from scratch, without a blue teudat zehut.',
    },
    authority: { he: "משרד הרישוי", en: 'The licensing office' },
  },

  /**
   * ⭐ the founder's, 31.8, and it is the obvious second one — the engine already
   * treats a lapsed visa as the step that blocks everything else, so the
   * product is effectively half-answering this question already.
   */
  {
    id: 'visa',
    status: 'planned',
    name: { he: "אשרת שהייה — הוצאה או חידוש", en: 'Residence visa — new or renewal' },
    summary: {
      he: "מה נדרש להוצאה או לחידוש מול רשות האוכלוסין, ומתי צריך להתחיל.",
      en: 'What a new visa or a renewal requires, and when it has to be started.',
    },
    authority: { he: "רשות האוכלוסין וההגירה", en: 'The Population and Immigration Authority' },
  },

  {
    id: 'bank_account',
    status: 'planned',
    name: { he: "פתיחת חשבון בנק", en: 'Opening a bank account' },
    summary: {
      he: "אילו מסמכים סניף מבקש ממי שאין לו תעודת זהות, ומה משתנה בין סניף לסניף.",
      en: 'Which documents a branch asks for without a teudat zehut, and what changes from branch to branch.',
    },
    authority: { he: "הסניף שבו נפתח החשבון", en: 'The branch where the account is opened' },
  },

  {
    id: 'national_insurance',
    status: 'planned',
    name: { he: "ביטוח לאומי — רישום וזכאות", en: 'National Insurance — registration and entitlement' },
    summary: {
      he: "מי חייב להירשם, מי זכאי, ואילו מסמכים נדרשים.",
      en: 'Who is required to register, who is entitled, and which documents are needed.',
    },
    authority: { he: "המוסד לביטוח לאומי", en: 'The National Insurance Institute' },
  },
];
