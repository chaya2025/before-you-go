import { useEffect, useState } from 'react';
import { UI, pick, type Lang } from '../i18n';
import { loadMyData, READ_LIMIT, type Account, type MyData } from '../account';
import type { StatusOption } from '../api';
import { dmy, ym } from './Stale';

/**
 * ⭐ SEC M3: "my data" (the right to see and fix, plan.md). One card in
 * Settings listing every field in the data inventory (definitions doc,
 * table 3), read live from the database with HIS login, so RLS (the database
 * rule "only your own rows") decides what comes back. No new endpoint, no
 * secret key.
 *
 *   email + how he logs in   → the login itself (Supabase Auth)
 *   preferred language       → profiles
 *   answers + marked steps   → cases
 *   documents read           → document_reads (asked through document_read,
 *                              the same counter the upload uses, without using one)
 *   document photos          → not kept: deleted right after reading (SEC M1)
 *
 * Each line that can be fixed says where: edit the answers, switch language,
 * change email (email logins; Google owns a Google login's address), delete.
 */

type Status = Pick<StatusOption, 'value' | 'label'>;
type Row = { label: string; value: string };

/** Answer keys in the order the questions ask them. Anything else goes after. */
const ORDER = [
  'language', 'visa_type', 'visa_valid_now', 'visa_expires', 'passport_expires', 'entered_israel',
  'made_aliyah', 'returned_to_israel', 'lived_abroad_6_months_continuous', 'has_teudat_zehut',
  'teudat_zehut_confirmed', 'born', 'requested_class', 'holds_form_89', 'has_record_document', 'foreign_license',
];

const has = (k: string): k is keyof typeof UI => k in UI;

/**
 * His saved answers as lines a person can read. Pure, so it is tested.
 * ⚠️ "unknown" means he never answered, so it is left out. A key with no
 * label still shows under its own name: nothing saved is ever hidden here.
 */
export function answerRows(answers: Record<string, unknown>, lang: Lang, statuses: Status[]): Row[] {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const value = (key: string, v: unknown): string => {
    if (v === true || v === 'yes') return t('my_yes');
    if (v === false || v === 'no') return t('my_no');
    if (key === 'visa_type') {
      const s = statuses.find((x) => x.value === v);
      if (s) return pick(s.label, lang);
    }
    if (v === 'he') return t('my_lang_he');
    if (v === 'en') return t('my_lang_en');
    const month = ym(v);
    if (month) return month;
    if (typeof v === 'string' && has(`my_v_${v}`)) return t(`my_v_${v}` as keyof typeof UI);
    return String(v);
  };
  const rows: Row[] = [];
  const add = (labelKey: string, key: string, v: unknown) => {
    if (v === undefined || v === null || v === '' || v === 'unknown') return;
    rows.push({ label: has(labelKey) ? t(labelKey) : key, value: value(key, v) });
  };
  const keys = [...ORDER.filter((k) => k in answers), ...Object.keys(answers).filter((k) => !ORDER.includes(k))];
  for (const k of keys) {
    const v = answers[k];
    if (k === 'foreign_license' && v && typeof v === 'object') {
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) add(`my_f_fl_${fk}`, fk, fv);
    } else add(`my_f_${k}`, k, v);
  }
  return rows;
}

/**
 * What the card shows. No hooks and plain elements only, so the tests can
 * render it and press its buttons without a browser.
 * `data`: null while loading, 'error' when the database could not be read.
 */
export function MyDataView({
  account,
  lang,
  data,
  statuses,
  onEditCase,
  onChangeLang,
}: {
  account: Account;
  lang: Lang;
  data: MyData | null | 'error';
  statuses: Status[];
  onEditCase: () => void;
  onChangeLang: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const head = <h3 id="my-data">{t('my_title')}</h3>;

  if (!account)
    return (
      <section className="card stack-sm my-data" aria-labelledby="my-data">
        {head}
        <p>{t('my_guest')}</p>
      </section>
    );

  const fix = (name: string, label: string, onClick: () => void) => (
    <button type="button" className="my-fix" data-fix={name} onClick={onClick}>{label}</button>
  );

  const ready = data && data !== 'error' ? data : null;
  const langName = !ready ? '' : ready.lang === 'he' ? t('my_lang_he') : ready.lang === 'en' ? t('my_lang_en') : t('my_lang_none');

  return (
    <section className="card stack-sm my-data" aria-labelledby="my-data">
      {head}
      <dl className="qc-facts my-facts">
        <div>
          <dt>{t('my_email')}</dt>
          <dd className="ltr">{account.email}</dd>
          {!account.google && <a className="my-fix" data-fix="email" href="#set-acct">{t('my_fix_email')}</a>}
        </div>
        <div>
          <dt>{t('my_method')}</dt>
          <dd>{t(account.google ? 'my_method_google' : 'my_method_email')}</dd>
        </div>
        {ready && (
          <div>
            <dt>{t('my_lang')}</dt>
            <dd>{langName}</dd>
            {fix('lang', t('my_fix_lang'), onChangeLang)}
          </div>
        )}
        {ready && (
          <div>
            <dt>{t('my_reads')}</dt>
            <dd>
              {ready.reads === null ? t('my_error') : (
                <>
                  <span className="num">{ready.reads}</span> / <span className="num">{READ_LIMIT}</span>
                </>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt>{t('my_uploads')}</dt>
          <dd>{t('my_uploads_body')}</dd>
        </div>
      </dl>

      {data === null && <p className="small muted" role="status">{t('my_loading')}</p>}
      {data === 'error' && <p className="field-error" role="alert">{t('my_error')}</p>}

      {ready && (
        <div className="stack-sm my-case">
          <h4>{t('my_case')}</h4>
          {ready.cases.length === 0 && <p className="small muted">{t('my_no_case')}</p>}
          {ready.cases.map((c) => (
            <dl key={c.id} className="qc-facts">
              {answerRows(c.answers, lang, statuses).map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
              <div>
                <dt>{t('my_steps_done')}</dt>
                <dd><span className="num">{c.done.length}</span></dd>
              </div>
              <div>
                <dt>{t('my_confirmed')}</dt>
                <dd className="num">{dmy(c.confirmedAt)}</dd>
              </div>
            </dl>
          ))}
          <div className="row-btns">{fix('edit-case', t('my_fix_case'), onEditCase)}</div>
        </div>
      )}

      <p>
        <a className="my-fix my-delete" data-fix="delete" href="#set-del">{t('my_delete')}</a>
      </p>
    </section>
  );
}

/** Loads the data with his login, then draws it. Reloads after a language switch. */
export function MyDataCard({
  account,
  lang,
  statuses,
  onEditCase,
  onChangeLang,
}: {
  account: Account;
  lang: Lang;
  statuses: Status[];
  onEditCase: () => void;
  onChangeLang: () => Promise<void>;
}) {
  const [data, setData] = useState<MyData | null | 'error'>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!account) return;
    let live = true;
    loadMyData()
      .then((d) => live && setData(d))
      .catch(() => live && setData('error'));
    return () => {
      live = false;
    };
  }, [account?.email, tick]);
  return (
    <MyDataView
      account={account}
      lang={lang}
      data={data}
      statuses={statuses}
      onEditCase={onEditCase}
      onChangeLang={() => {
        onChangeLang().finally(() => setTick((n) => n + 1));
      }}
    />
  );
}
