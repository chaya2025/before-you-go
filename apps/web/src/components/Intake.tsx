import { useState } from 'react';
import type { StatusOption } from '../api';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * The intake — ש1 through ש5, in F1's order
 * ============================================================================
 *
 * ⚠️ The order is a research finding, not a layout preference. From גיליון F0:
 *
 *   ש1 status   — "השאלה החזקה ביותר — מזיזה ארבעה דברים בבת אחת", and he
 *                 knows the answer because he is carrying the visa.
 *   ש2 licence  — "הפיצול המבני הגדול ביותר". After it, half the questions
 *                 stop being relevant.
 *   ש3 date     — conversion only. Meaningless without a foreign licence.
 *   ש4 ת"ז      — ⭐ a CONFIRMATION, never a bare question. See below.
 *   ש5 seniority — last, "כי היא הכי קשה לזכירה מדויקת, ואם המשתמש נחסם
 *                 קודם — לא הטרחנו אותו לחינם".
 *
 * Questions appear as earlier ones are answered, so nobody faces a wall of
 * fields on a phone while standing in a queue.
 */

export type Answers = Record<string, unknown>;

type Props = {
  lang: Lang;
  statuses: StatusOption[];
  licenseClasses: string[];
  onSubmit: (answers: Answers) => void;
  busy: boolean;
};

/** A question, with its own heading and optional explanation. */
function Question({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card stack-sm">
      <h3>{title}</h3>
      {help && <p className="muted small">{help}</p>}
      <div className="stack-sm">{children}</div>
    </section>
  );
}

/** One tappable answer. Amber when chosen — "you are here". */
function Option({
  selected,
  onClick,
  label,
  note,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  note?: string;
}) {
  return (
    <button type="button" className="option" aria-pressed={selected} onClick={onClick}>
      <span>
        {label}
        {note && <span className="option-note">{note}</span>}
      </span>
    </button>
  );
}

export function Intake({ lang, statuses, licenseClasses, onSubmit, busy }: Props) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  const [visaType, setVisaType] = useState<string | null>(null);
  const [licenceKind, setLicenceKind] = useState<'national' | 'idp_only' | 'none' | null>(null);
  const [tz, setTz] = useState<boolean | 'unknown' | null>(null);
  const [visaValid, setVisaValid] = useState<boolean | 'unknown' | null>(null);
  const [dateAnswer, setDateAnswer] = useState('');
  const [bornYear, setBornYear] = useState('');
  const [years, setYears] = useState('');
  const [requestedClass, setRequestedClass] = useState('');
  const [record, setRecord] = useState<string | null>(null);

  const chosen = statuses.find((s) => s.value === visaType);
  const converting = licenceKind === 'national';

  // F1 rule 6: the roadmap builds on ש1 and ש2 alone. Everything else is optional.
  const canBuild = Boolean(visaType) && Boolean(licenceKind);

  /**
   * ⭐ Which date question to ask depends on the category, because the clocks
   * count from different events — עלייה, שיבה, or כניסה. Asking "when did you
   * enter" of an עולה would collect the wrong date and compute the wrong
   * deadline, silently.
   */
  const dateKey =
    chosen?.value === 'a1'
      ? 'made_aliyah'
      : chosen?.value === 'citizen' || chosen?.value === 'permanent_resident'
        ? 'returned_to_israel'
        : 'entered_israel';

  const dateLabel =
    dateKey === 'made_aliyah' ? t('q_aliyah') : dateKey === 'returned_to_israel' ? t('q_returned') : t('q_entered');

  function submit() {
    const answers: Answers = {
      language: lang,
      visa_type: visaType,
      foreign_license: {
        kind: licenceKind,
        ...(years ? { years_held_permanent: Number(years) } : {}),
      },
      ...(tz !== null ? { has_teudat_zehut: tz, teudat_zehut_confirmed: true } : {}),
      ...(visaValid !== null ? { visa_valid_now: visaValid } : {}),
      ...(dateAnswer ? { [dateKey]: dateAnswer } : {}),
      ...(bornYear.length === 4 ? { born: `${bornYear}-06` } : {}),
      ...(requestedClass ? { requested_class: requestedClass } : {}),
      ...(record ? { has_record_document: record } : {}),
    };
    onSubmit(answers);
  }

  return (
    <div className="stack">
      {/* ── ש1 ─────────────────────────────────────────────────────────── */}
      <Question title={t('q_status')} help={t('q_status_help')}>
        {statuses.map((s) => (
          <Option
            key={s.value}
            selected={visaType === s.value}
            label={pick(s.label, lang)}
            note={pick(s.identity_document, lang)}
            onClick={() => {
              setVisaType(s.value);
              // The ש4 default comes from the data, and the user confirms it.
              setTz(s.usually_has_teudat_zehut);
            }}
          />
        ))}
      </Question>

      {/* ── ש2 ─────────────────────────────────────────────────────────── */}
      {visaType && (
        <Question title={t('q_license')}>
          <Option
            selected={licenceKind === 'national'}
            label={t('license_national')}
            onClick={() => setLicenceKind('national')}
          />
          <Option
            selected={licenceKind === 'idp_only'}
            label={t('license_idp')}
            note={licenceKind === 'idp_only' ? t('license_idp_note') : undefined}
            onClick={() => setLicenceKind('idp_only')}
          />
          <Option
            selected={licenceKind === 'none'}
            label={t('license_none')}
            onClick={() => setLicenceKind('none')}
          />
        </Question>
      )}

      {/* ── ש4 · a confirmation, not a question ────────────────────────── */}
      {visaType && licenceKind && chosen && (
        <Question title={t('confirm_tz_title')} help={t('confirm_tz_explain')}>
          <p>{chosen.usually_has_teudat_zehut === true ? t('confirm_tz_yes') : t('confirm_tz_no')}</p>
          <Option selected={tz === true} label={t('confirm_tz_have')} onClick={() => setTz(true)} />
          <Option selected={tz === false} label={t('confirm_tz_havent')} onClick={() => setTz(false)} />
          <Option selected={tz === 'unknown'} label={t('unsure')} onClick={() => setTz('unknown')} />
        </Question>
      )}

      {/* ── ש3 · conversion only ───────────────────────────────────────── */}
      {converting && (
        <Question title={dateLabel} help={t('q_date_help')}>
          <input
            type="month"
            value={dateAnswer}
            max="2026-12"
            onChange={(e) => setDateAnswer(e.target.value)}
            aria-label={dateLabel}
          />
        </Question>
      )}

      {/* ── visa validity — eligibility is judged at submission ─────────── */}
      {visaType && licenceKind && tz !== true && (
        <Question title={t('q_visa_valid')} help={t('q_visa_valid_help')}>
          <Option selected={visaValid === true} label={t('yes')} onClick={() => setVisaValid(true)} />
          <Option selected={visaValid === false} label={t('no')} onClick={() => setVisaValid(false)} />
          <Option
            selected={visaValid === 'unknown'}
            label={t('unsure')}
            onClick={() => setVisaValid('unknown')}
          />
        </Question>
      )}

      {/* ── age · the field that went missing twice ─────────────────────── */}
      {visaType && licenceKind && (
        <Question title={t('q_born')} help={t('q_born_help')}>
          <input
            type="number"
            inputMode="numeric"
            className="num"
            placeholder="1998"
            min={1900}
            max={2026}
            value={bornYear}
            onChange={(e) => setBornYear(e.target.value)}
            aria-label={t('q_born')}
          />
        </Question>
      )}

      {/* ── ש5 · conversion only, and last ─────────────────────────────── */}
      {converting && (
        <>
          <Question title={t('q_years')} help={t('q_years_help')}>
            <input
              type="number"
              inputMode="numeric"
              className="num"
              placeholder="5"
              min={0}
              max={80}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              aria-label={t('q_years')}
            />
          </Question>

          <Question title={t('q_class')}>
            <select
              value={requestedClass}
              onChange={(e) => setRequestedClass(e.target.value)}
              aria-label={t('q_class')}
            >
              <option value="">—</option>
              {licenseClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Question>

          <Question title={t('q_record')} help={t('q_record_help')}>
            <Option selected={record === 'yes'} label={t('yes')} onClick={() => setRecord('yes')} />
            <Option
              selected={record === 'in_progress'}
              label={t('in_progress')}
              onClick={() => setRecord('in_progress')}
            />
            <Option selected={record === 'no'} label={t('no')} onClick={() => setRecord('no')} />
            {/* ⚠️ Its own answer, never folded into "no". It is the biggest
                practical blocker in the conversion route and the נוהל says
                nothing about what to do. */}
            <Option
              selected={record === 'origin_country_does_not_issue'}
              label={t('country_no_record')}
              onClick={() => setRecord('origin_country_does_not_issue')}
            />
          </Question>
        </>
      )}

      <div className="stack-sm">
        <button className="btn btn-primary" disabled={!canBuild || busy} onClick={submit}>
          {busy ? t('loading') : t('build')}
        </button>
        {!canBuild && <p className="muted small">{t('build_hint')}</p>}
      </div>
    </div>
  );
}
