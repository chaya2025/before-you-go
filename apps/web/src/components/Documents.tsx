import { useState } from 'react';
import { UI, pick, type Lang } from '../i18n';
import type { Answers } from './Intake';

/**
 * ============================================================================
 * The documents — ש7, between the diagnosis and the road
 * ============================================================================
 *
 * ⭐ the founder's design, 30.8, and it replaced a worse one of mine.
 *
 * I was going to ask "have you renewed your passport since you got your 89?" —
 * a question that only works if the user already understands that the two are
 * connected. Hers:
 *
 *   "don't drive the user crazy. Just tell them upload this, this, this, and
 *    the system would realize itself what is not valid. It would then report
 *    back to the user and say this is fine, this is expiring, whatever it is."
 *
 * So every field on this screen asks him to READ something. Not one of them
 * asks him to judge anything. He transcribes what is printed in front of him;
 * the engine notices that two documents disagree.
 *
 * ⚠️ WHY THIS SCREEN SITS HERE. After the diagnosis, because we only ask for
 * documents his route actually needs. Before the roadmap, because a document
 * that is wrong BECOMES the first step of that roadmap — it is not a note
 * printed beside it. The founder: "they realize that he has to change his name. That
 * should be the next step for him."
 *
 * ⚠️ PRIVACY (hard rule 1). Numbers are posted, compared in the engine, and
 * discarded. Never stored, never logged, and never echoed back in any message —
 * a mismatch says "the numbers do not match", never "12345678 does not match",
 * because that text ends up in a screenshot.
 *
 * At MVP these same fields become the output of a scan. The typing is replaced,
 * not the model behind it.
 */

type Props = {
  lang: Lang;
  /** Conversion only. There is no foreign licence to ask about otherwise. */
  converting: boolean;
  onSubmit: (documents: Answers) => void;
  onSkip: () => void;
  busy: boolean;
};

/** Matches Intake's Question, so the two screens read as one form. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="stack-sm" style={{ display: 'block' }}>
      <span className="small">{label}</span>
      {children}
    </label>
  );
}

function Group({
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

export function Documents({ lang, converting, onSubmit, onSkip, busy }: Props) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  // ⚠️ The 89 first, deliberately. It is the document that carries the number
  // everything else gets checked against, and the founder named this order.
  const [form89Number, setForm89Number] = useState('');
  const [form89Passport, setForm89Passport] = useState('');
  const [form89Name, setForm89Name] = useState('');

  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpires, setPassportExpires] = useState('');
  const [passportName, setPassportName] = useState('');

  const [visaExpires, setVisaExpires] = useState('');

  const [licenceExpires, setLicenceExpires] = useState('');
  const [licenceName, setLicenceName] = useState('');
  const [licenceLang, setLicenceLang] = useState<'he' | 'en' | 'other' | null>(null);

  /**
   * ⚠️ Only fields he actually filled are sent. An empty box is not an answer,
   * and a blank must never reach the engine as a value — numbersAgree and
   * namesAgree both return 'unknown' unless BOTH sides are present, which is
   * what stops a half-filled form inventing a mismatch.
   */
  function submit() {
    const trimmed = (v: string) => (v.trim() ? v.trim() : undefined);
    const documents: Answers = {
      ...(trimmed(form89Number) ? { form_89_number: trimmed(form89Number) } : {}),
      ...(trimmed(form89Passport) ? { form_89_passport_number: trimmed(form89Passport) } : {}),
      ...(trimmed(form89Name) ? { form_89_name_latin: trimmed(form89Name) } : {}),
      ...(trimmed(passportNumber) ? { passport_number: trimmed(passportNumber) } : {}),
      ...(passportExpires ? { passport_expires: passportExpires } : {}),
      ...(trimmed(passportName) ? { passport_name_latin: trimmed(passportName) } : {}),
      ...(visaExpires ? { visa_expires: visaExpires } : {}),
      ...(converting
        ? {
            foreign_license: {
              ...(licenceExpires ? { expires: licenceExpires } : {}),
              ...(trimmed(licenceName) ? { name_latin: trimmed(licenceName) } : {}),
              ...(licenceLang ? { language: licenceLang } : {}),
            },
          }
        : {}),
    };
    onSubmit(documents);
  }

  return (
    <div className="stack">
      <div className="stack-sm">
        <h2>{t('docs_title')}</h2>
        <p className="muted">{t('docs_intro')}</p>
        <p className="small">{t('docs_privacy')}</p>
      </div>

      {/* ── the 89 ───────────────────────────────────────────────────────── */}
      <Group title={t('d_89_title')} help={t('d_89_help')}>
        <Field label={t('d_89_number')}>
          <input
            className="ltr"
            inputMode="numeric"
            placeholder="89123456"
            value={form89Number}
            onChange={(e) => setForm89Number(e.target.value)}
          />
        </Field>
        {/* ⭐ The field this whole screen exists for. */}
        <Field label={t('d_89_passport')}>
          <input
            className="ltr"
            placeholder="AB1234567"
            value={form89Passport}
            onChange={(e) => setForm89Passport(e.target.value)}
          />
        </Field>
        <Field label={t('d_89_name')}>
          <input
            className="ltr"
            value={form89Name}
            onChange={(e) => setForm89Name(e.target.value)}
          />
        </Field>
      </Group>

      {/* ── the passport ─────────────────────────────────────────────────── */}
      <Group title={t('d_passport_title')} help={t('d_passport_help')}>
        <Field label={t('d_passport_number')}>
          <input
            className="ltr"
            placeholder="AB1234567"
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
          />
        </Field>
        <Field label={t('d_passport_expires')}>
          <input
            type="month"
            value={passportExpires}
            onChange={(e) => setPassportExpires(e.target.value)}
          />
        </Field>
        <Field label={t('d_passport_name')}>
          <input
            className="ltr"
            value={passportName}
            onChange={(e) => setPassportName(e.target.value)}
          />
        </Field>
      </Group>

      {/* ── the visa ─────────────────────────────────────────────────────── */}
      <Group title={t('d_visa_title')} help={t('d_visa_help')}>
        <Field label={t('d_visa_expires')}>
          <input type="month" value={visaExpires} onChange={(e) => setVisaExpires(e.target.value)} />
        </Field>
      </Group>

      {/* ── the foreign licence, conversion only ─────────────────────────── */}
      {converting && (
        <Group title={t('d_licence_title')}>
          <Field label={t('d_licence_expires')}>
            <input
              type="month"
              value={licenceExpires}
              onChange={(e) => setLicenceExpires(e.target.value)}
            />
          </Field>
          <Field label={t('d_licence_name')}>
            <input
              className="ltr"
              value={licenceName}
              onChange={(e) => setLicenceName(e.target.value)}
            />
          </Field>
          {/* Drives doc.translation, which existed in the data with no way to
              know whether it applied to this person. */}
          <Field label={t('d_licence_lang')}>
            <div className="stack-sm">
              {(['he', 'en', 'other'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  className="option"
                  aria-pressed={licenceLang === code}
                  onClick={() => setLicenceLang(code)}
                >
                  <span>{t(code === 'he' ? 'd_lang_he' : code === 'en' ? 'd_lang_en' : 'd_lang_other')}</span>
                </button>
              ))}
            </div>
          </Field>
        </Group>
      )}

      <div className="stack-sm">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          {busy ? t('loading') : t('docs_check')}
        </button>
        {/* ⚠️ Skippable, and it has to be. F1 rule 6: the roadmap is built on
            ש1 and ש2 alone. A man standing in a queue without his documents
            still deserves his road. */}
        <button className="btn btn-quiet" disabled={busy} onClick={onSkip}>
          {t('docs_skip')}
        </button>
      </div>
    </div>
  );
}
