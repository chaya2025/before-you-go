import { useEffect, useId, useRef, useState } from 'react';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * Site refresh (2026-11-24): a dropdown that matches the site
 * ============================================================================
 *
 * The browser's own <select> list can't be styled (same story as the month
 * popup). SelectPick looks like the other fields and opens the same card:
 *   - "grid" for short codes (licence grades: B, A1, C1...), tiles in rows;
 *   - "list" for longer labels (visa types), one per line.
 *
 * ⭐ A DROP-IN for <select>: same value string, "" for "nothing chosen" when
 * `placeholder` is given, and onChange gets the value, so the code that reads
 * it is untouched.
 */
type Opt = { value: string; label: string };
type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Opt[];
  layout?: 'grid' | 'list';
  /** Shown when the value is "" (the old "—" option). Omit if a value is required. */
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
};

export function SelectPick({ value, onChange, options, layout = 'list', placeholder, id, ...aria }: Props) {
  const lang: Lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'he';
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const current = options.find((o) => o.value === value);
  const label = current ? current.label : placeholder ?? t('num_pick');

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
        className={`month-trigger${current ? '' : ' month-empty'}`}
        aria-haspopup="listbox"
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
        <div className={`month-pop pick-pop pick-${layout}`} id={popId} role="listbox" aria-label={aria['aria-label']}>
          <div className={layout === 'grid' ? 'month-grid pick-grid' : 'pick-list'}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`month-cell${layout === 'list' ? ' pick-row' : ''}${o.value === value ? ' is-picked' : ''}`}
                onClick={() => choose(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {placeholder !== undefined && (
            <div className="month-foot">
              <button type="button" className="month-link" onClick={() => choose('')}>
                {t('month_clear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
