import type { ProfileWarning } from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * "Two of your answers do not agree" — the engine's cross-field checks
 * ============================================================================
 *
 * ⭐⭐ WHY THIS FILE EXISTS, 23.9. `checkProfile` has been computing these since
 * 31.8 and `evaluate` has been putting them on every Result as `warnings`. The
 * website never read the field. Not once, on any screen. Every one of them was
 * computed, returned over the wire, and thrown away by the browser.
 *
 * So the engine already knew that a birth date came after an entry date, that a
 * passport expiry read 9999, that a licence seniority was impossible for the
 * age given — and the person was never told any of it.
 *
 * ⚠️ IT WARNS, IT NEVER BLOCKS. F1 validation 2: "המערכת מבקשת אישור במקום
 * לחסום". Somebody whose answers look contradictory is almost always
 * mis-remembering one date, not lying, and refusing to help him is the exact
 * behaviour this product exists to replace. So there is no alert role, no red,
 * and nothing here stops him reading his road.
 *
 * ⚠️ AND IT IS NOT AN URGENT NOTICE. An UrgentIssue is a fact about his case
 * that the road is built on. This is a doubt about an ANSWER, and the two must
 * not look alike: one says "deal with this", the other says "check you told us
 * the right thing". Quieter on purpose, same reasoning the founder applied on 30.8
 * when she took the advisory out of the red box.
 */
export function Warnings({ warnings, lang }: { warnings: ProfileWarning[]; lang: Lang }) {
  if (warnings.length === 0) return null;
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  return (
    <section className="note note-check" aria-live="polite">
      <h3>{t('warn_title')}</h3>
      <p className="muted small">{t('warn_note')}</p>
      <ul className="note-list">
        {warnings.map((w, i) => (
          /* ⚠️ The field name is NOT printed. "foreign_license.years_held_permanent"
             at the reader is the same mistake the road made with step ids until
             23.9. The message already names the answer in his own words. */
          <li key={`${w.field}-${i}`}>
            <span className="small">{lang === 'he' ? w.message_he : w.message_en}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
