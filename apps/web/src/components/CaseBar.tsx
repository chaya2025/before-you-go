import type { Result } from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';

/**
 * M1 milestone 2: what sits at the top of the answer about saving.
 *   - a guest gets "save your case" (D-146), which asks him to sign up;
 *   - a logged-in user gets a quiet "saved" mark (auto-save, D-150);
 *   - someone who came back gets the welcome-back summary first (D-150).
 */

export type SaveState = 'saving' | 'saved' | 'error';

export type Summary = {
  done: number;
  total: number;
  /** The first step he can act on today. Where "lands on the next step" lands. */
  next: Result['roadmap'][number] | null;
  /** The running clock with the fewest days left, if any has a known date. */
  nearest: Result['clocks'][number] | null;
};

/** Read off the result, never recomputed. Pure, so it is tested. */
export function summarize(result: Result): Summary {
  const road = result.roadmap;
  const nearest =
    result.clocks
      .filter((c) => c.status === 'running' && c.days_left !== null && c.deadline)
      .sort((a, b) => (a.days_left as number) - (b.days_left as number))[0] ?? null;
  return {
    done: road.filter((s) => s.state === 'done').length,
    total: road.length,
    next: road.find((s) => s.state === 'do_now') ?? null,
    nearest,
  };
}

/** "3.10.2026": the date format the rest of the site uses for a person. */
const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

export function WelcomeBack({
  result,
  name,
  lang,
  onNext,
  children,
}: {
  result: Result;
  name: string | null;
  lang: Lang;
  onNext: () => void;
  /** The document check (D-160), inside this card rather than beside it. */
  children?: React.ReactNode;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const s = summarize(result);
  return (
    <section className="card welcome-back stack-sm" aria-labelledby="wb-title">
      <h3 id="wb-title">{name ? `${t('wb_hello_name')}${name}` : t('wb_hello')}</h3>
      <p className="wb-progress">
        <span className="num">{s.done}</span> {t('wb_of')} <span className="num">{s.total}</span> {t('wb_steps_done')}
      </p>
      {s.next && (
        <p>
          <span className="muted">{t('wb_next')}</span> <strong>{pick(s.next.step.title, lang)}</strong>
        </p>
      )}
      {s.nearest && s.nearest.deadline && (
        <p className={s.nearest.warning ? 'wb-urgent' : undefined}>
          <span className="muted">{t('wb_nearest')}</span> {pick(s.nearest.clock.name, lang)},{' '}
          <span className="num">{day(s.nearest.deadline)}</span> ({t('wb_in')}{' '}
          <span className="num">{s.nearest.days_left}</span> {t('wb_days')})
        </p>
      )}
      {children}
      {s.next && !children && (
        <button className="btn btn-primary" onClick={onNext}>
          {t('wb_go_next')}
        </button>
      )}
    </section>
  );
}

export function SavedMark({ state, lang }: { state: SaveState; lang: Lang }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  return (
    <p className={`saved-mark small saved-${state}`} role="status" aria-live="polite">
      {state === 'saved' && (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {t(state === 'saving' ? 'save_saving' : state === 'saved' ? 'save_saved' : 'save_error')}
    </p>
  );
}

export function GuestSave({ lang, onSave }: { lang: Lang; onSave: () => void }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  return (
    <div className="guest-save">
      <p className="small">{t('save_guest_note')}</p>
      <button className="btn btn-amber" onClick={onSave}>
        {t('save_guest_btn')}
      </button>
    </div>
  );
}
