import { useState } from 'react';
import type { Result } from '@byg/engine';
import type { StatusOption } from '../api';
import { UI, pick, type Lang } from '../i18n';
import { applyRenewal, readExpiry, type Change, type DocField, type StaleDoc, type Watched } from '../stale';

/**
 * M1 milestone 3: the screens for stale answers (D-127). The logic lives in
 * stale.ts and is tested there; these only ask and show.
 */

type T = (k: keyof typeof UI) => string;
const useT = (lang: Lang): T => (k) => pick(UI[k], lang);

/** '2026-09' → '9/2026'. Months only: that is all he ever gave us. */
export const ym = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}$/.test(v)) return null;
  const [y, m] = v.split('-');
  return `${Number(m)}/${y}`;
};

/** '2026-10-05T…' → '5.10.2026'. */
export const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

const MONTH_MIN = '1950-01';
const MONTH_MAX = String(new Date().getFullYear() + 20) + '-12';

const docName = (t: T, f: DocField) =>
  t(f === 'visa_expires' ? 'st_doc_visa' : f === 'passport_expires' ? 'st_doc_passport' : 'st_doc_license');

/**
 * ⭐ Asked BEFORE the road. One document at a time, so a person whose visa AND
 * passport both lapsed is not handed a form; he answers one plain question,
 * then the next. Every answer is applied to the answers; the road is rebuilt
 * once, at the end, by the caller.
 */
export function StaleAsk({
  docs,
  answers,
  lang,
  busy,
  onDone,
}: {
  docs: StaleDoc[];
  answers: Record<string, unknown>;
  lang: Lang;
  busy: boolean;
  onDone: (next: Record<string, unknown>) => void;
}) {
  const t = useT(lang);
  const [i, setI] = useState(0);
  const [working, setWorking] = useState(answers);
  const [renewed, setRenewed] = useState(false);
  const [until, setUntil] = useState('');
  const doc = docs[i];
  if (!doc) return null;

  const next = (renewedUntil: string | null) => {
    const updated = applyRenewal(working, doc.field, renewedUntil);
    setRenewed(false);
    setUntil('');
    if (i + 1 < docs.length) {
      setWorking(updated);
      setI(i + 1);
    } else onDone(updated);
  };

  const name = docName(t, doc.field);
  return (
    <section className="card stale-ask stack" aria-labelledby="st-title">
      <p className="kicker">{t('st_kicker')}{docs.length > 1 ? ` · ${i + 1}/${docs.length}` : ''}</p>
      <h3 id="st-title">
        {doc.kind === 'expired'
          ? `${name} ${t('st_expired_in')}${ym(doc.expires)}. ${t('st_renewed_q')}`
          : `${name} ${t('st_expires_in')}${ym(doc.expires)}. ${t('st_renewed_already_q')}`}
      </h3>
      <p className="muted small">{t(doc.kind === 'expired' ? 'st_why_expired' : 'st_why_soon')}</p>

      {!renewed ? (
        <div className="row-btns">
          <button className="btn btn-primary" onClick={() => setRenewed(true)} disabled={busy}>
            {t('st_yes_renewed')}
          </button>
          <button className="btn btn-quiet" onClick={() => next(null)} disabled={busy}>
            {t('st_not_yet')}
          </button>
        </div>
      ) : (
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (until > doc.expires) next(until);
          }}
        >
          <div className="field">
            <label htmlFor="st-until">{t('st_valid_until')}</label>
            <input
              id="st-until"
              type="month"
              className="num"
              min={MONTH_MIN}
              max={MONTH_MAX}
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              aria-invalid={until !== '' && until <= doc.expires ? true : undefined}
            />
            {until !== '' && until <= doc.expires && <p className="field-error">{t('st_until_after')}</p>}
          </div>
          <div className="row-btns">
            <button className="btn btn-primary" type="submit" disabled={busy || !until || until <= doc.expires}>
              {t('st_save_continue')}
            </button>
            <button className="btn btn-quiet" type="button" onClick={() => setRenewed(false)}>
              {t('st_back')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * ⭐ On every return: the facts the road stands on, on one card, with one
 * button for the usual case. "Something changed" opens the three fields in
 * place; saving rebuilds the road and the caller says what moved.
 */
export function QuickCheck({
  answers,
  statuses,
  lang,
  busy,
  onConfirm,
  onUpdate,
}: {
  answers: Record<string, unknown>;
  statuses: StatusOption[];
  lang: Lang;
  busy: boolean;
  onConfirm: () => void;
  onUpdate: (next: Record<string, unknown>) => void;
}) {
  // ⭐ Sits INSIDE the welcome-back card (D-160, Chaya): one card on return,
  // with "nothing changed" and "change details", not two cards to read.
  const t = useT(lang);
  const [editing, setEditing] = useState(false);
  const [visaType, setVisaType] = useState(String(answers.visa_type ?? ''));
  const [visaExp, setVisaExp] = useState(readExpiry(answers, 'visa_expires') ?? '');
  const [passExp, setPassExp] = useState(readExpiry(answers, 'passport_expires') ?? '');
  const label = (v: unknown) => {
    const s = statuses.find((x) => x.value === v);
    return s ? pick(s.label, lang) : t('st_not_given');
  };

  if (!editing)
    return (
      <div className="quick-check stack-sm">
        <p className="qc-title" id="qc-title">{t('qc_title')}</p>
        <dl className="qc-facts">
          <div><dt>{t('qc_visa_type')}</dt><dd>{label(answers.visa_type)}</dd></div>
          <div><dt>{t('qc_visa_until')}</dt><dd className="num">{ym(answers.visa_expires) ?? t('st_not_given')}</dd></div>
          <div><dt>{t('qc_passport_until')}</dt><dd className="num">{ym(answers.passport_expires) ?? t('st_not_given')}</dd></div>
        </dl>
        <div className="row-btns">
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>{t('qc_nothing_changed')}</button>
          <button className="btn btn-quiet" onClick={() => setEditing(true)} disabled={busy}>{t('qc_something_changed')}</button>
        </div>
      </div>
    );

  return (
    <div className="quick-check stack-sm">
      <p className="qc-title" id="qc-title">{t('qc_edit_title')}</p>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, unknown> = { ...answers, visa_type: visaType };
          if (visaExp) next.visa_expires = visaExp;
          if (passExp) next.passport_expires = passExp;
          onUpdate(next);
        }}
      >
        <div className="field">
          <label htmlFor="qc-type">{t('qc_visa_type')}</label>
          <select id="qc-type" value={visaType} onChange={(e) => setVisaType(e.target.value)}>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{pick(s.label, lang)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qc-visa">{t('qc_visa_until')}</label>
          <input id="qc-visa" type="month" className="num" min={MONTH_MIN} max={MONTH_MAX} value={visaExp} onChange={(e) => setVisaExp(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="qc-pass">{t('qc_passport_until')}</label>
          <input id="qc-pass" type="month" className="num" min={MONTH_MIN} max={MONTH_MAX} value={passExp} onChange={(e) => setPassExp(e.target.value)} />
        </div>
        <div className="row-btns">
          <button className="btn btn-primary" type="submit" disabled={busy}>{t('qc_save')}</button>
          <button className="btn btn-quiet" type="button" onClick={() => setEditing(false)}>{t('st_back')}</button>
        </div>
      </form>
    </div>
  );
}

/**
 * ⭐ "Your route changed because your visa type is now א/5." The why first
 * (the answers he changed), then what moved on the road. Titles of removed
 * steps come from the road BEFORE, since they are no longer on it.
 */
export function ChangedNote({
  change,
  before,
  after,
  statuses,
  lang,
  onClose,
}: {
  change: Change;
  before: Result;
  after: Result;
  statuses: StatusOption[];
  lang: Lang;
  onClose: () => void;
}) {
  const t = useT(lang);
  const fieldName: Record<Watched, keyof typeof UI> = {
    visa_type: 'qc_visa_type',
    visa_valid_now: 'ch_visa_valid',
    visa_expires: 'qc_visa_until',
    passport_expires: 'qc_passport_until',
    license_expires: 'ch_license_until',
  };
  const value = (f: Watched, v: unknown): string => {
    if (f === 'visa_type') {
      const s = statuses.find((x) => x.value === v);
      return s ? pick(s.label, lang) : String(v ?? t('st_not_given'));
    }
    if (f === 'visa_valid_now') return t(v === true ? 'ch_yes' : v === false ? 'ch_no' : 'st_not_given');
    return ym(v) ?? t('st_not_given');
  };
  const titleIn = (r: Result, id: string) => {
    const s = r.roadmap.find((x) => x.step.id === id);
    return s ? pick(s.step.title, lang) : id;
  };
  const urgentIn = (r: Result, id: string) => {
    const u = r.urgent.find((x) => x.id === id);
    return u ? pick(u.title, lang) : id;
  };
  const track = (v: string | null) =>
    v === 'conversion' ? t('track_conversion') : v === 'from_zero' ? t('track_from_zero') : t('st_not_given');

  return (
    <section className="card changed-note stack-sm" role="status" aria-labelledby="ch-title">
      <div className="acct-head">
        <h3 id="ch-title">{t('ch_title')}</h3>
        <button className="btn btn-quiet" onClick={onClose} aria-label={t('acct_close')}>✕</button>
      </div>
      {change.causes.length > 0 && (
        <>
          <p className="muted small">{t('ch_because')}</p>
          <ul className="ch-list">
            {change.causes.map((c) => (
              <li key={c.field}>
                {t(fieldName[c.field])}: <strong>{value(c.field, c.to)}</strong>{' '}
                <span className="muted">({t('ch_was')} {value(c.field, c.from)})</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">{t('ch_so')}</p>
      <ul className="ch-list">
        {change.trackTo && (
          <li>{t('ch_route')} <strong>{track(change.trackTo)}</strong> <span className="muted">({t('ch_was')} {track(change.trackFrom)})</span></li>
        )}
        {change.blockedNow && <li>{t('ch_blocked')}</li>}
        {change.unblocked && <li>{t('ch_unblocked')}</li>}
        {change.urgentAdded.map((id) => <li key={`u+${id}`}>{t('ch_urgent_added')} <strong>{urgentIn(after, id)}</strong></li>)}
        {change.urgentCleared.map((id) => <li key={`u-${id}`}>{t('ch_urgent_cleared')} {urgentIn(before, id)}</li>)}
        {change.stepsAdded.map((id) => <li key={`s+${id}`}>{t('ch_step_added')} <strong>{titleIn(after, id)}</strong></li>)}
        {change.stepsRemoved.map((id) => <li key={`s-${id}`}>{t('ch_step_removed')} {titleIn(before, id)}</li>)}
      </ul>
    </section>
  );
}
