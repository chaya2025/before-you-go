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
 *
 * ⭐ REBUILT 22.9 to the design she approved after thirteen rounds:
 * personal-os/vault/projects/ai-readiness-agent/mvp-m0/mockup/. The page is a
 * sequence of full-width grounds rather than one column of identical cards,
 * and her note that decided the opening line: someone who just opened the site
 * "wouldn't even understand to what" — so the lede names the processes before
 * it says what we do about them.
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

  /* The photographs belong to the processes, so they are keyed by process id
     rather than by position: a new process appearing in the served list must
     never silently inherit the licence's photograph. */
  const PHOTO: Record<string, { src: string; alt: { he: string; en: string } }> = {
    driving_license: {
      src: '/images/service-licence.jpg',
      alt: { he: 'נהיגה ביום, ידיים על ההגה', en: 'Driving in daylight, hands on the wheel' },
    },
    visa: {
      src: '/images/service-visa.jpg',
      alt: { he: 'דרכון פתוח עם חותמות', en: 'An open passport with stamps' },
    },
    bank_account: {
      src: '/images/service-bank.jpg',
      alt: { he: 'ארנק, כרטיסים ושטרות', en: 'A wallet, cards and banknotes' },
    },
    national_insurance: {
      src: '/images/service-insurance.jpg',
      alt: { he: 'טפסים על שולחן', en: 'Forms on a desk' },
    },
  };

  const arrow = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  /**
   * ⭐ Chaya, 4.10: the start buttons used to open the licence questions
   * directly, because the licence is the only live process. With more
   * processes coming that sends everyone down one road. So "start" now means
   * "go choose": it scrolls to the processes below, where the live one starts
   * and the planned ones say so.
   *
   * ⚠️ That section only exists when the list loaded. If it did not, the
   * button falls back to starting the licence, so it never points at nothing.
   */
  const start = (label: string, className: string) =>
    processes.length > 0 ? (
      <a className={className} href="#services">
        {label}
        {arrow}
      </a>
    ) : (
      <button type="button" className={className} onClick={onStart}>
        {label}
        {arrow}
      </button>
    );

  return (
    <>
      <section className="hero">
        {/* ⚠️ Decorative: it carries no information the words do not. Empty alt
            so a screen reader walks straight to the headline. */}
        <div className="hero-photo">
          <img src="/images/hero-jerusalem.jpg" alt="" />
        </div>

        <div className="hero-in">
          <p className="eyebrow rise">{t('hero_eyebrow')}</p>
          <h2 className="rise rise-1">
            {t('hero_title')}
            <br />
            <em>{t('hero_title_em')}</em>
          </h2>
          <div className="hero-rule rise rise-1" />
          <p className="hero-lede rise rise-2">{t('hero_lede')}</p>
          <div className="hero-acts rise rise-3">
            {start(t('hero_cta'), 'btn btn-primary')}
            <a className="btn btn-quiet" href="#how">
              {t('hero_cta_secondary')}
            </a>
            <span className="hero-meta">{t('hero_meta')}</span>
          </div>
        </div>
      </section>

      {/* ⭐ What he actually walks away with, said before anything is asked of
          him. Three things, because the product does exactly three. */}
      <section className="band gets" style={{ paddingBlock: 'clamp(1.8rem,4vw,2.6rem)' }}>
        <div className="band-in">
          <p className="kicker rise">{t('gets_kicker')}</p>
          <div className="gets-grid">
            <div className="get rise">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 19V7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v10a1 1 0 01-1 1H5a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 13h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <div>
                <b>{t('get_route')}</b>
                <span>{t('get_route_note')}</span>
              </div>
            </div>
            <div className="get rise rise-1">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M9 12l2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <b>{t('get_docs')}</b>
                <span>{t('get_docs_note')}</span>
              </div>
            </div>
            <div className="get rise rise-2">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              <div>
                <b>{t('get_first')}</b>
                <span>{t('get_first_note')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⚠️ Deliberately early, and deliberately plain. */}
      <div className="decl">
        <div className="decl-in">
          <span className="decl-mark">{t('not_gov_title')}</span>
          <p>{t('not_gov_body')}</p>
        </div>
      </div>

      <section className="band ground-sage-band" id="how">
        <div className="band-in">
          <div className="band-head rise">
            <p className="kicker">{t('how_kicker')}</p>
            <h2>{t('how_title')}</h2>
            <p>{t('how_note')}</p>
          </div>

          {/* ⭐ Numbered because it genuinely IS a sequence — you cannot do
              these in another order. Numbering something that is not a
              sequence is decoration. */}
          <div className="track">
            <ol className="beats">
              <li className="beat rise">
                <span className="beat-mark">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 13a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M5 20c.9-3 3.6-4.6 7-4.6s6.1 1.6 7 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <em>01</em>
                </span>
                <div className="beat-card">
                  <h3>{t('beat_1')}</h3>
                  <p>{t('beat_1_note')}</p>
                </div>
              </li>

              <li className="beat rise rise-1">
                <span className="beat-mark">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M14 3v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <em>02</em>
                </span>
                <div className="beat-card">
                  <h3>{t('beat_2')}</h3>
                  <p>{t('beat_2_note')}</p>
                </div>
              </li>

              <li className="beat rise rise-2">
                <span className="beat-mark">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 18c3-1 4-9 8-9s4 5 8 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="4" cy="18" r="2" fill="currentColor" />
                    <circle cx="20" cy="13" r="2" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <em>03</em>
                </span>
                <div className="beat-card">
                  <h3>{t('beat_3')}</h3>
                  <p>{t('beat_3_note')}</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ⚠️ No heading without rows under it. The list is served, not
          hardcoded, so when the API is unreachable this section simply is not
          there — better than a title over a void, which reads as broken. */}
      {processes.length > 0 && (
      <section className="band services" id="services" style={{ paddingBlockEnd: 0 }}>
        <div className="band-in">
          <div className="band-head rise">
            <p className="kicker">{t('choose_kicker')}</p>
            <h2>{t('choose_title')}</h2>
          </div>
        </div>

        {processes.map((process, i) => {
          const live = process.status === 'live';
          const photo = PHOTO[process.id];

          return (
            <div className={`svc${i % 2 === 1 ? ' svc-flip' : ''}`} key={process.id}>
              <div className="svc-in">
                <div className="svc-copy rise">
                  <p className={`svc-state${live ? '' : ' svc-state-soon'}`}>
                    {live ? t('status_live') : t('status_planned')}
                  </p>
                  <h3>{pick(process.name, lang)}</h3>
                  <p>{pick(process.summary, lang)}</p>
                  <div className="svc-where">
                    {t('at_authority')} {pick(process.authority, lang)}
                  </div>

                  <div className="svc-cta">
                    {/**
                     * ⚠️ A planned process is NOT a button you can press. A
                     * landing page that lets you press something leading
                     * nowhere is a small lie, and this product's entire
                     * argument is that it does not tell them.
                     */}
                    {live ? (
                      <button type="button" className="btn btn-amber" onClick={onStart}>
                        {t('process_cta')}
                        {arrow}
                      </button>
                    ) : (
                      <button type="button" className="btn" disabled>
                        {t('process_closed')}
                      </button>
                    )}
                  </div>
                </div>

                {/* ⚠️ No photograph, no plate. A process added to the served
                    list before anyone chose a picture for it would otherwise
                    render as an empty tinted box, which reads as broken. */}
                {photo && (
                  <div className="svc-art rise rise-1">
                    <figure className={`svc-photo${live ? '' : ' svc-photo-soon'}`}>
                      <img src={photo.src} alt={pick(photo.alt, lang)} loading="lazy" />
                      {!live && <span className="svc-tag">{t('status_planned')}</span>}
                    </figure>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
      )}

      <section className="close">
        <div className="close-in">
          <div className="rise">
            <span className="script">{t('tagline')}</span>
            <h2>{t('close_title')}</h2>
            <p>{t('close_note')}</p>
          </div>
          <div className="rise rise-1">
            {start(t('hero_cta'), 'btn')}
          </div>
        </div>
      </section>
    </>
  );
}
