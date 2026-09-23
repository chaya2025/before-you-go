import { useState } from 'react';
import {
  checkForm89Number,
  checkPassportNumber,
  checkLatinName,
  checkExpiryMonth,
  type FieldProblem,
} from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';
import type { Diagnosis, DocumentQuestion } from '@byg/engine';
import type { Answers } from './Intake';

/**
 * ============================================================================
 * The documents — ש7, between the diagnosis and the road
 * ============================================================================
 *
 * ⭐ Chaya's design, 30.8, and it replaced a worse one of mine.
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
 * printed beside it. Chaya: "they realize that he has to change his name. That
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
  /**
   * ⭐ WHICH SECTIONS TO SHOW, decided by the engine and not by this file.
   *
   * ⚠️ Added 31.8, found by Chaya: a returning Israeli resident converting a
   * licence was asked for his visa expiry, and for his 89 number. He has
   * neither. The screen was showing every section to everybody and scoping only
   * the foreign licence.
   *
   * The website is not allowed to know which documents belong to which person.
   * The engine reads each document's own `applies_when` and sends the answer.
   */
  questions: Diagnosis['document_questions'];
  onSubmit: (documents: Answers) => void;
  onSkip: () => void;
  busy: boolean;
};

/**
 * ⭐ Added 31.8, at Chaya's request: "a user can just input anything not
 * relevant and it will go through normally and give wrong result."
 *
 * ⚠️ THE RULE ITSELF IS NOT HERE. It lives in @byg/engine/fields, next to its
 * reasoning and in both languages, and the Profile schema enforces the same
 * expressions — so the API cannot be handed what this form refuses. This file
 * only decides how a problem LOOKS.
 *
 * ⭐ And it looks like the rest of the product, because it reuses her own
 * severity axis from 30.8:
 *   blocking  → red, announced to a screen reader, and the form will not submit
 *   advisory  → amber, says its piece, and never stops him
 */
function Problem({ problem, lang }: { problem: FieldProblem; lang: Lang }) {
  const blocking = problem.severity === 'blocking';
  return (
    <p
      className="small"
      role={blocking ? 'alert' : undefined}
      style={{
        margin: 0,
        color: blocking ? 'var(--uncertain)' : 'var(--amber)',
        fontWeight: 500,
      }}
    >
      {blocking ? '⚠️ ' : 'ℹ️ '}
      {pick(problem.message, lang)}
    </p>
  );
}

/** Matches Intake's Question, so the two screens read as one form. */
function Field({
  label,
  problem,
  lang,
  children,
}: {
  label: string;
  problem?: FieldProblem | null;
  lang?: Lang;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {problem && lang && <Problem problem={problem} lang={lang} />}
    </label>
  );
}

/**
 * ⚠️ Colour is never the only signal. A red border says nothing to a screen
 * reader or to a colour-blind user, and this is the one form where being
 * misunderstood costs somebody a day off work. So the border comes WITH
 * aria-invalid, and the message underneath carries the actual words.
 */
const invalid = (problem: FieldProblem | null) =>
  problem?.severity === 'blocking'
    ? ({ borderColor: 'var(--uncertain)' } as const)
    : undefined;

const invalidAttr = (problem: FieldProblem | null) =>
  problem?.severity === 'blocking' ? true : undefined;

/**
 * ⭐ Chaya, 31.8: "just automatically make what the user inputs upper case."
 *
 * Right, and for a better reason than tidiness: this is how the documents
 * themselves are printed, so the field ends up looking like the thing he is
 * copying from, and a mistyped character is easier to spot against the page.
 *
 * ⚠️ It changes NOTHING about the comparison. identity.ts has always lowercased
 * before comparing, so "ab1234567" and "AB1234567" already matched. This is
 * legibility, not a fix — worth knowing, so nobody later assumes the comparison
 * depends on it and removes the wrong one.
 *
 * ⚠️ Safe on a controlled input because upper-casing never changes the string
 * length, so React leaves the cursor where it was. A transform that grew or
 * shrank the value would jump the caret to the end on every keystroke.
 */
const upper = (value: string) => value.toUpperCase();

/**
 * The bounds `type="month"` never had. Deliberately generous: a passport that
 * expired years ago is a REAL answer and precisely what this product exists to
 * catch, so only the absurd ends are fenced off.
 */
const MONTH_MIN = '1950-01';
const MONTH_MAX = String(new Date().getFullYear() + 20) + '-12';

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
    <section className="card doc-group">
      <h3>{title}</h3>
      {help && <p className="doc-group-note">{help}</p>}
      <div className="stack-sm">{children}</div>
    </section>
  );
}

/**
 * ============================================================================
 * ⭐⭐ THE RULE OF THIS SCREEN, IN ONE COMPONENT
 * ============================================================================
 *
 * **A person is only ever asked for something he can actually provide.**
 *
 * ⚠️ Chaya, 22.9: an א/2 with no teudat zehut and no driving licence reached
 * this screen and was handed a box for his 89 number — while step one of the
 * roadmap printed on the very next screen told him to go to the licensing
 * office and OBTAIN an 89. The form asked him to copy a number off a document
 * that does not exist yet.
 *
 * Every document section now passes through here, and there are exactly three
 * outcomes. Both of the first two are decided by the ENGINE, never by this file:
 *
 *   ask === false            → the section does not exist for him. A citizen
 *                              has no visa and no 89. (Her 31.8 fix.)
 *   confirm_possession       → it is his kind of document, but his own route
 *                              still says GO AND GET ONE. So ask whether he has
 *                              it, and show the fields only on a yes.
 *   otherwise                → he is holding it. Straight to the fields, as
 *                              this screen has always worked.
 *
 * ⭐ Routing all four sections through one component is the point. The 89 is
 * the only one gated today; the day a step is written that issues another
 * document, the engine flips the flag and this screen already behaves.
 */
function Section({
  question,
  title,
  help,
  lang,
  held,
  onHeld,
  children,
}: {
  question: DocumentQuestion;
  title: string;
  help?: string;
  lang: Lang;
  /**
   * ⚠️ Only a section the engine gates needs these, so they are optional — but
   * a gated section without them would silently show its fields again, which is
   * the bug this component exists to kill. So a missing handler keeps the
   * fields HIDDEN rather than revealing them: if this is ever wired wrong, it
   * fails towards asking nothing, never towards asking the unanswerable.
   */
  held?: boolean | null;
  onHeld?: (held: boolean) => void;
  children: React.ReactNode;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  if (!question.ask) return null;
  if (!question.confirm_possession) {
    return (
      <Group title={title} help={help}>
        {children}
      </Group>
    );
  }
  return (
    <Group title={title} help={help}>
      <p className="muted small">{t('d_have_it')}</p>
      <div className="stack-sm">
        <button type="button" className="option" aria-pressed={held === true} onClick={() => onHeld?.(true)}>
          <span>{t('d_have_it_yes')}</span>
        </button>
        <button type="button" className="option" aria-pressed={held === false} onClick={() => onHeld?.(false)}>
          <span>{t('d_have_it_no')}</span>
        </button>
      </div>
      {held === true && <div className="stack-sm">{children}</div>}
      {/* ⚠️ Never a warning colour. Not yet holding a document he has not been
          issued is the ordinary state of somebody at the start of his route. */}
      {held === false && <p className="small muted">{t('d_have_it_no_note')}</p>}
    </Group>
  );
}

export function Documents({ lang, questions, onSubmit, onSkip, busy }: Props) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  /**
   * ⭐ "Do you have an 89 at all?" — null until he says. See Section: the
   * question is only put to him when the ENGINE says his own route still has a
   * step that issues one, so he can be holding nothing.
   */
  const [holdsForm89, setHoldsForm89] = useState<boolean | null>(null);

  // ⚠️ The 89 first, deliberately. It is the document that carries the number
  // everything else gets checked against, and Chaya named this order.
  const [form89Number, setForm89Number] = useState('');
  const [form89Passport, setForm89Passport] = useState('');
  const [form89Name, setForm89Name] = useState('');

  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpires, setPassportExpires] = useState('');
  const [passportName, setPassportName] = useState('');


  const [visaExpires, setVisaExpires] = useState('');
  const [visaValid, setVisaValid] = useState<boolean | 'unknown' | null>(null);
  const [noVisaDoc, setNoVisaDoc] = useState(false);

  const [licenceExpires, setLicenceExpires] = useState('');
  const [licenceName, setLicenceName] = useState('');
  const [licenceLang, setLicenceLang] = useState<'he' | 'en' | 'other' | null>(null);

  /**
   * ⭐ Checked as he types, in the engine, in his language.
   *
   * ⚠️ `today` comes from the browser here and that is fine: it feeds a
   * plausibility warning, not a rule. Everything that DECIDES anything takes
   * `today` from the server, so a wrong clock on a laptop can never change an
   * eligibility answer.
   */
  const today = new Date().toISOString().slice(0, 10);
  const problems = {
    form_89_number: checkForm89Number(form89Number),
    form_89_passport_number: checkPassportNumber(form89Passport),
    form_89_name_latin: checkLatinName(form89Name),
    passport_number: checkPassportNumber(passportNumber),
    passport_expires: checkExpiryMonth(passportExpires, today),
    passport_name_latin: checkLatinName(passportName),
    visa_expires: checkExpiryMonth(visaExpires, today),
    licence_expires: checkExpiryMonth(licenceExpires, today),
    licence_name: checkLatinName(licenceName),
  };

  /**
   * ⚠️ Only a BLOCKING problem stops him. An advisory has said its piece and
   * that is the end of its authority — F1 validation 2, "המערכת מבקשת אישור
   * במקום לחסום". A man whose passport really does expire in 2049 must still be
   * able to get his roadmap.
   */
  const blocked = Object.values(problems).some((p) => p?.severity === 'blocking');

  /**
   * ⚠️ Only fields he actually filled are sent. An empty box is not an answer,
   * and a blank must never reach the engine as a value — numbersAgree and
   * namesAgree both return 'unknown' unless BOTH sides are present, which is
   * what stops a half-filled form inventing a mismatch.
   */
  function submit() {
    // ⚠️ Refuses rather than sending something the engine would reject. The
    // button is already disabled; this is the second lock, for the Enter key.
    if (blocked) return;
    const trimmed = (v: string) => (v.trim() ? v.trim() : undefined);
    const documents: Answers = {
      /**
       * ⚠️ Sent ONLY when he was actually asked and actually answered. An
       * unanswered gate stays out of the payload entirely, so the engine sees
       * 'unknown' — which is what skipping this screen has always meant, and
       * the difference between "he told us he has none" and "nobody asked" is
       * the whole of principle 8.
       */
      ...(questions.form_89.confirm_possession && holdsForm89 !== null
        ? { holds_form_89: holdsForm89 }
        : {}),
      ...(trimmed(form89Number) ? { form_89_number: trimmed(form89Number) } : {}),
      ...(trimmed(form89Passport) ? { form_89_passport_number: trimmed(form89Passport) } : {}),
      ...(trimmed(form89Name) ? { form_89_name_latin: trimmed(form89Name) } : {}),
      ...(trimmed(passportNumber) ? { passport_number: trimmed(passportNumber) } : {}),
      ...(passportExpires ? { passport_expires: passportExpires } : {}),
      ...(trimmed(passportName) ? { passport_name_latin: trimmed(passportName) } : {}),
      ...(visaExpires ? { visa_expires: visaExpires } : {}),
      ...(visaValid !== null ? { visa_valid_now: visaValid } : {}),
      ...(questions.foreign_license.ask
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
      {/* ⚠️ The one section that is gated on possession today, and it is not
          gated HERE — the engine sets confirm_possession because fz.doc_89 /
          cv.doc_89 are still on his road. See Section. */}
      <Section
        question={questions.form_89}
        title={t('d_89_title')}
        help={t('d_89_help')}
        lang={lang}
        held={holdsForm89}
        onHeld={(has) => {
          setHoldsForm89(has);
          // ⚠️ Changing his mind to "no" clears what he typed. Otherwise a
          // number entered a moment ago would still be posted, still be read as
          // proof that he holds the document, and still overrule the answer.
          if (!has) {
            setForm89Number('');
            setForm89Passport('');
            setForm89Name('');
          }
        }}
      >
        <Field label={t('d_89_number')} problem={problems.form_89_number} lang={lang}>
          <input
            className="ltr"
            inputMode="numeric"
            maxLength={20}
            placeholder="891234567"
            aria-invalid={invalidAttr(problems.form_89_number)}
            style={invalid(problems.form_89_number)}
            value={form89Number}
            onChange={(e) => setForm89Number(e.target.value)}
          />
        </Field>
        {/* ⭐ The field this whole screen exists for. */}
        <Field label={t('d_89_passport')} problem={problems.form_89_passport_number} lang={lang}>
          <input
            className="ltr"
            maxLength={25}
            placeholder="AB1234567"
            aria-invalid={invalidAttr(problems.form_89_passport_number)}
            style={invalid(problems.form_89_passport_number)}
            value={form89Passport}
            onChange={(e) => setForm89Passport(upper(e.target.value))}
          />
        </Field>
        <Field label={t('d_89_name')} problem={problems.form_89_name_latin} lang={lang}>
          <input
            className="ltr"
            maxLength={60}
            aria-invalid={invalidAttr(problems.form_89_name_latin)}
            style={invalid(problems.form_89_name_latin)}
            value={form89Name}
            onChange={(e) => setForm89Name(upper(e.target.value))}
          />
        </Field>
      </Section>

      {/* ── the passport ─────────────────────────────────────────────────── */}
      <Section
        question={questions.passport}
        title={t('d_passport_title')}
        // ⚠️ The 89 wording only where the 89 is actually asked for: it left the
        // conversion road on 23.9, so a converter must not be asked to
        // distinguish his passport from one issued with a document he never had.
        help={questions.form_89.ask ? t('d_passport_help_89') : t('d_passport_help')}
        lang={lang}
      >
        <Field label={t('d_passport_number')} problem={problems.passport_number} lang={lang}>
          <input
            className="ltr"
            maxLength={25}
            placeholder="AB1234567"
            aria-invalid={invalidAttr(problems.passport_number)}
            style={invalid(problems.passport_number)}
            value={passportNumber}
            onChange={(e) => setPassportNumber(upper(e.target.value))}
          />
        </Field>
        <Field label={t('d_passport_expires')} problem={problems.passport_expires} lang={lang}>
          {/* ⚠️ min and max, which were missing entirely — "9999-12" used to be
              accepted in silence and every date calculation after it was wrong. */}
          <input
            type="month"
            min={MONTH_MIN}
            max={MONTH_MAX}
            aria-invalid={invalidAttr(problems.passport_expires)}
            style={invalid(problems.passport_expires)}
            value={passportExpires}
            onChange={(e) => setPassportExpires(e.target.value)}
          />
        </Field>
        <Field label={t('d_passport_name')} problem={problems.passport_name_latin} lang={lang}>
          <input
            className="ltr"
            maxLength={60}
            aria-invalid={invalidAttr(problems.passport_name_latin)}
            style={invalid(problems.passport_name_latin)}
            value={passportName}
            onChange={(e) => setPassportName(upper(e.target.value))}
          />
        </Field>
      </Section>

      {/* ── the visa ─────────────────────────────────────────────────────── */}
      {/*
        ⚠️ Asked ONCE, and here rather than in the intake. Chaya, 30.8: "person
        would have to enter the visa in the documents info anyway, so why does
        he even ask?" It used to be a yes/no on the intake AND a date here: two
        questions about one fact, on a screen built to remove friction.

        ⭐ The DATE is the primary question, because it is strictly more
        informative — it settles validity and it powers the reminder that
        renewal takes about a month. But the yes/no had a real reason to exist
        too: it can be answered from memory, and a date cannot. So it survives
        as a fallback for the man who does not have the document in front of
        him, and most people never see it.
      */}
      <Section
        question={questions.visa}
        title={t('d_visa_title')}
        help={t('d_visa_help')}
        lang={lang}
      >
        <Field label={t('d_visa_expires')} problem={problems.visa_expires} lang={lang}>
          <input
            type="month"
            min={MONTH_MIN}
            max={MONTH_MAX}
            aria-invalid={invalidAttr(problems.visa_expires)}
            style={invalid(problems.visa_expires)}
            value={visaExpires}
            onChange={(e) => {
              setVisaExpires(e.target.value);
              setNoVisaDoc(false);
            }}
          />
        </Field>
        <button
          type="button"
          className="option"
          aria-pressed={noVisaDoc}
          onClick={() => {
            setNoVisaDoc(true);
            setVisaExpires('');
          }}
        >
          <span>{t('q_visa_no_doc')}</span>
        </button>
        {noVisaDoc && (
          <div className="stack-sm">
            <p className="muted small">{t('q_visa_valid')}</p>
            {([true, false, 'unknown'] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                className="option"
                aria-pressed={visaValid === v}
                onClick={() => setVisaValid(v)}
              >
                <span>{t(v === true ? 'yes' : v === false ? 'no' : 'unsure')}</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* ── the foreign licence, conversion only ─────────────────────────── */}
      <Section
        question={questions.foreign_license}
        title={t('d_licence_title')}
        lang={lang}
      >
          <Field label={t('d_licence_expires')} problem={problems.licence_expires} lang={lang}>
            <input
              type="month"
              min={MONTH_MIN}
              max={MONTH_MAX}
              aria-invalid={invalidAttr(problems.licence_expires)}
              style={invalid(problems.licence_expires)}
              value={licenceExpires}
              onChange={(e) => setLicenceExpires(e.target.value)}
            />
          </Field>
          <Field label={t('d_licence_name')} problem={problems.licence_name} lang={lang}>
            <input
              className="ltr"
              maxLength={60}
              aria-invalid={invalidAttr(problems.licence_name)}
              style={invalid(problems.licence_name)}
              value={licenceName}
              onChange={(e) => setLicenceName(upper(e.target.value))}
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
      </Section>

      <div className="stack-sm">
        {/* ⚠️ Says WHY it is disabled. A greyed-out button with no explanation
            is the most frustrating thing a form can do — he can see the red
            message on the field, but not that it is what is stopping him. */}
        {blocked && (
          <p className="field-error" role="status">
            {t('docs_fix_first')}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy || blocked} onClick={submit}>
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
