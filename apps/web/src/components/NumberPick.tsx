import { useEffect, useId, useRef, useState } from 'react';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * Site refresh (2026-11-24): a number picked from a card, not typed in a box
 * ============================================================================
 *
 * Her ask, after the month picker: "make these dropdowns" (birth year, years
 * the licence was valid). Same look as MonthInput (it reuses its classes):
 * a field, and a card with twelve numbers per page and arrows between pages.
 *
 * ⭐ A DROP-IN for the old `<input type="number">`: the value is the same
 * string ("" when empty), and min/max are the same fence, so the code that
 * reads `bornYear` / `years` is untouched.
 */
type Props = {
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  /** Where the card opens when nothing is chosen yet (the old placeholder). */
  start: number;
  'aria-label'?: string;
};

const PAGE = 12;

export function NumberPick({ value, onChange, min, max, start, ...aria }: Props) {
  const lang: Lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'he';
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  // Pages start at `min`, so every page is a clean run of twelve.
  const pageOf = (n: number) => min + Math.floor((Math.min(Math.max(n, min), max) - min) / PAGE) * PAGE;
  const chosen = value === '' ? null : Number(value);

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => pageOf(chosen ?? start));
  const wrap = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (open) setFrom(pageOf(chosen ?? start));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const to = Math.min(from + PAGE - 1, max);
  const label = chosen === null ? t('num_pick') : String(chosen);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div
      className="month-field"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={`month-trigger num${chosen === null ? ' month-empty' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={aria['aria-label'] ? `${aria['aria-label']}: ${label}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="month-pop" id={popId} role="dialog" aria-label={aria['aria-label'] ?? t('num_pick')}>
          <div className="month-head">
            <button
              type="button"
              className="month-nav"
              aria-label={t('num_prev')}
              disabled={from <= min}
              onClick={() => setFrom((f) => Math.max(min, f - PAGE))}
            >
              ‹
            </button>
            <strong className="num">
              {from}–{to}
            </strong>
            <button
              type="button"
              className="month-nav"
              aria-label={t('num_next')}
              disabled={to >= max}
              onClick={() => setFrom((f) => f + PAGE)}
            >
              ›
            </button>
          </div>

          <div className="month-grid">
            {Array.from({ length: to - from + 1 }, (_, i) => {
              const n = from + i;
              return (
                <button
                  key={n}
                  type="button"
                  className={`month-cell num${n === chosen ? ' is-picked' : ''}`}
                  aria-pressed={n === chosen}
                  onClick={() => choose(String(n))}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="month-foot">
            <button type="button" className="month-link" onClick={() => choose('')}>
              {t('month_clear')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
