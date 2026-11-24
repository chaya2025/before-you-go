import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * Site refresh (2026-11-24): our own month picker
 * ============================================================================
 *
 * WHY: `<input type="month">` opens the browser's own popup (grey, blue, 2009),
 * and no CSS can reach it. Her words: "make these bars more updated with design".
 *
 * ⭐ A DROP-IN. Same value as the native input ("YYYY-MM", "" when empty), same
 * min/max fence, same aria-invalid, so every check and calculation that read
 * the old input reads this one unchanged. Only the look and the popup are new.
 *
 * The language comes from <html lang>, which App sets, so no screen has to
 * pass it down.
 */
type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-label'?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const ym = (y: number, m: number) => `${y}-${pad(m)}`;

export function MonthInput({ value, onChange, min, max, id, className, style, ...aria }: Props) {
  const lang: Lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'he';
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';

  const now = new Date();
  const thisMonth = ym(now.getFullYear(), now.getMonth() + 1);
  const minY = min ? Number(min.slice(0, 4)) : 1900;
  const maxY = max ? Number(max.slice(0, 4)) : 2100;

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((value || thisMonth).slice(0, 4)));
  const wrap = useRef<HTMLDivElement>(null);
  const popId = useId();

  // Opening shows the year of the chosen month (or this year).
  useEffect(() => {
    if (open) setYear(Number((value || thisMonth).slice(0, 4)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A press anywhere else closes it, like any popup.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const monthName = (m: number, style: 'long' | 'short') =>
    new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2000, m - 1, 1));
  const label = value
    ? `${monthName(Number(value.slice(5, 7)), 'long')} ${value.slice(0, 4)}`
    : t('month_pick');
  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max);

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
        id={id}
        className={`month-trigger${value ? '' : ' month-empty'}${className ? ` ${className}` : ''}`}
        style={style}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-invalid={aria['aria-invalid']}
        aria-label={aria['aria-label'] ? `${aria['aria-label']}: ${label}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="month-pop" id={popId} role="dialog" aria-label={t('month_pick')}>
          <div className="month-head">
            {/* In Hebrew the page runs right to left, so "earlier" sits on the right. */}
            <button
              type="button"
              className="month-nav"
              aria-label={t('month_prev_year')}
              disabled={year <= minY}
              onClick={() => setYear((y) => y - 1)}
            >
              ‹
            </button>
            <strong className="num">{year}</strong>
            <button
              type="button"
              className="month-nav"
              aria-label={t('month_next_year')}
              disabled={year >= maxY}
              onClick={() => setYear((y) => y + 1)}
            >
              ›
            </button>
          </div>

          <div className="month-grid">
            {Array.from({ length: 12 }, (_, i) => {
              const v = ym(year, i + 1);
              return (
                <button
                  key={v}
                  type="button"
                  className={`month-cell${v === value ? ' is-picked' : ''}${v === thisMonth ? ' is-now' : ''}`}
                  aria-pressed={v === value}
                  disabled={!allowed(v)}
                  onClick={() => choose(v)}
                >
                  {monthName(i + 1, 'short')}
                </button>
              );
            })}
          </div>

          <div className="month-foot">
            <button type="button" className="month-link" onClick={() => choose('')}>
              {t('month_clear')}
            </button>
            <button
              type="button"
              className="month-link"
              disabled={!allowed(thisMonth)}
              onClick={() => choose(thisMonth)}
            >
              {t('month_this')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
