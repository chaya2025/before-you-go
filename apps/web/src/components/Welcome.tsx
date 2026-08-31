import type { Process } from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * The landing page
 * ============================================================================
 *
 * ⚠️ WHAT IT IS FOR. Until now the first thing a stranger saw was
 * "מה המעמד שלך בישראל?" — a question about his immigration status, asked by a
 * site he knew nothing about. For an audience the PRD describes as people who
 * have "כבר נדחו, כבר בזבזו יום עבודה", that is not merely confusing. This page
 * exists to earn the right to ask that question.
 *
 * ⭐ WELCOMING IN STRUCTURE, NOT IN PROSE. Chaya, 31.8, ruled out storytelling
 * copy across the whole system, and a welcome page is exactly where it creeps
 * back in. So there is no "we know bureaucracy is hard". The reassurance comes
 * from knowing what you are in for: what this is, what it is not, what happens
 * next, and how long it takes.
 *
 * ⚠️ AND THE LINE THAT MATTERS MOST IS THE DISCLAIMER. Her call, 31.8. These
 * users are legally vulnerable and have learned to distrust official-looking
 * things that are not official. Saying plainly that this is not a government
 * service, submits nothing and saves nothing is what buys the trust to ask
 * about a visa on the next screen.
 */
export function Welcome({
  processes,
  lang,
  onStart,
}: {
  processes: Process[];
  lang: Lang;
  onStart: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  return (
    <div className="stack-lg reveal">
      {/* ⭐ אור ראשון — "first light". The wash behind this block is the brand
          name taken literally, and the single amber point is the brand's own
          statement of itself: "נקודת אור אחת בענבר שמסמנת היכן אתה עומד."
          It is the one decorative moment in the entire product. */}
      {/* ⚠️ h2, not h1. The site wordmark in the header is already the page's
          h1, and two of them is a real accessibility fault rather than a
          stylistic one. It is styled at hero scale instead — Suez One gets its
          one large moment here either way.
          The tagline is not repeated; the header is showing it two lines up. */}
      <section className="hero">
        <h2>{t('hero_title')}</h2>
        <p className="hero-lede">{t('hero_lede')}</p>
      </section>

      {/* ⚠️ Deliberately early, and deliberately plain. */}
      <section className="card disclaimer">
        <h2 className="disclaimer-title">{t('not_gov_title')}</h2>
        <p className="small">{t('not_gov_body')}</p>
      </section>

      {/* Removes the fear of "how long is this form". Three beats, no more. */}
      <section className="stack-sm">
        <h2>{t('how_title')}</h2>
        <ol className="beats">
          <li>
            <strong>{t('beat_1')}</strong>
            <span className="muted small">{t('beat_1_note')}</span>
          </li>
          <li>
            <strong>{t('beat_2')}</strong>
            <span className="muted small">{t('beat_2_note')}</span>
          </li>
          <li>
            <strong>{t('beat_3')}</strong>
            <span className="muted small">{t('beat_3_note')}</span>
          </li>
        </ol>
      </section>

      <section className="stack-sm">
        <h2>{t('choose_title')}</h2>
        <p className="muted small">{t('choose_note')}</p>

        <div className="processes">
          {processes.map((process) => {
            const live = process.status === 'live';

            /**
             * ⚠️ A planned process is NOT a button. A landing page that lets
             * you press something leading nowhere is a small lie, and this
             * product's entire argument is that it does not tell them.
             */
            const Inner = (
              <>
                <span className="process-status">
                  {live ? t('status_live') : t('status_planned')}
                </span>
                <span className="process-name">{pick(process.name, lang)}</span>
                <span className="small muted">{pick(process.summary, lang)}</span>
                <span className="small process-authority">
                  {t('at_authority')}: {pick(process.authority, lang)}
                </span>
              </>
            );

            return live ? (
              <button
                key={process.id}
                type="button"
                className="process process-live"
                onClick={onStart}
              >
                {Inner}
              </button>
            ) : (
              <div key={process.id} className="process process-planned" aria-disabled="true">
                {Inner}
              </div>
            );
          })}
        </div>
      </section>

      <p className="muted small">{t('privacy')}</p>
    </div>
  );
}
