import { useState } from 'react';
import { UI, pick, type Lang } from '../i18n';

/**
 * SEC M2: the notice and its one checkbox. "Continue" stays off until it is
 * ticked. Wording: hers in English (D-7), never "optional".
 *
 * ConsentView only draws; Consent holds the tick. Split so a test can draw
 * both states without a browser.
 */
type ViewProps = {
  lang: Lang;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onContinue: () => void;
};

export function ConsentView({ lang, checked, onCheck, onContinue }: ViewProps) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  return (
    <section className="notice notice-advisory consent" aria-labelledby="consent-title">
      <h3 id="consent-title">{t('consent_title')}</h3>
      <p>{t('consent_body')}</p>
      <label className="step-tick consent-tick">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
        <span>{t('consent_agree')}</span>
      </label>
      <div>
        <button className="btn btn-primary" disabled={!checked} onClick={onContinue}>
          {t('consent_continue')}
        </button>
      </div>
    </section>
  );
}

export function Consent({ lang, onAgree }: { lang: Lang; onAgree: () => void }) {
  const [checked, setChecked] = useState(false);
  return <ConsentView lang={lang} checked={checked} onCheck={setChecked} onContinue={onAgree} />;
}
