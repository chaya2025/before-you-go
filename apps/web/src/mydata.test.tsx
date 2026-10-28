import { describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MyDataView, answerRows } from './components/MyData';
import type { MyData } from './account';
import { UI } from './i18n';

/**
 * ⭐ SEC M3: the "my data" section. Every field in the data inventory
 * (definitions doc, table 3) must show for a signed-in user, a guest gets one
 * line, and every "fix it" link goes where it says.
 *
 * Rendered to plain HTML (react-dom/server), so no browser is needed.
 */

const google = { email: 'dana@gmail.com', name: 'Dana', photo: null, google: true };
const emailUser = { email: 'yosef@example.com', name: null, photo: null, google: false };

const data: MyData = {
  lang: 'en',
  reads: 2,
  cases: [
    {
      id: 'c1',
      answers: { visa_type: 'a5', visa_expires: '2027-03', born: '1990-06', foreign_license: { kind: 'national', country: 'UA' } },
      done: ['s1', 's2', 's3'],
      confirmedAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-02T10:00:00Z',
    },
  ],
};
const statuses = [{ value: 'a5', label: { he: 'תושב ארעי א/5', en: 'Temporary resident A/5' } }];
const noop = () => {};

const html = (props: Partial<Parameters<typeof MyDataView>[0]> = {}) =>
  renderToStaticMarkup(
    <MyDataView account={google} lang="en" data={data} statuses={statuses} onEditCase={noop} onChangeLang={noop} {...props} />,
  );

/** Every element in the tree MyDataView returns (it uses plain elements only). */
function all(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  return [el, ...all(el.props.children as ReactNode)];
}
const tree = (props: Partial<Parameters<typeof MyDataView>[0]> = {}) =>
  all(MyDataView({ account: google, lang: 'en', data, statuses, onEditCase: noop, onChangeLang: noop, ...props }));
const fix = (els: ReturnType<typeof tree>, name: string) => els.filter((e) => e.props['data-fix'] === name);

describe('signed in: every inventory field shows', () => {
  it('email', () => expect(html()).toContain('dana@gmail.com'));
  it('sign-in method: Google, or email and password', () => {
    expect(html()).toContain(UI.my_method_google.en);
    expect(html({ account: emailUser })).toContain(UI.my_method_email.en);
  });
  it('preferred language, as saved in the profile', () => {
    expect(html()).toContain(UI.my_lang_en.en);
    expect(html({ data: { ...data, lang: 'he' } })).toContain(UI.my_lang_he.en);
    expect(html({ data: { ...data, lang: null } })).toContain(UI.my_lang_none.en);
  });
  it('case answers, in words (visa named, dates readable, licence fields included)', () => {
    const h = html();
    expect(h).toContain('Temporary resident A/5');
    expect(h).toContain('3/2027');
    expect(h).toContain(UI.my_f_born.en);
    expect(h).toContain(UI.my_f_fl_country.en);
    expect(h).toContain('UA');
    expect(h).not.toContain('visa_type'); // never a raw database key
  });
  it('the steps he marked', () => {
    expect(html()).toMatch(/3<\/span>/);
    expect(html()).toContain(UI.my_steps_done.en);
  });
  it('no saved case: says so', () => {
    expect(html({ data: { ...data, cases: [] } })).toContain(UI.my_no_case.en);
  });
  it('document read count', () => {
    const h = html();
    expect(h).toContain(UI.my_reads.en);
    expect(h).toMatch(/>2<\/span>/);
  });
  it('uploaded documents: deleted after reading', () => {
    expect(html()).toContain(UI.my_uploads_body.en);
  });
  it('Hebrew too', () => {
    const h = html({ lang: 'he' });
    expect(h).toContain(UI.my_title.he);
    expect(h).toContain(UI.my_uploads_body.he);
    expect(h).toContain('תושב ארעי א/5');
  });
  it('still loading / failed: says so, shows no made-up data', () => {
    expect(html({ data: null })).toContain(UI.my_loading.en);
    expect(html({ data: 'error' })).toContain(UI.my_error.en);
  });
});

describe('guest', () => {
  it('one line: nothing is saved without an account', () => {
    const h = html({ account: null, data: null });
    expect(h).toContain(UI.my_guest.en);
    expect(h).not.toContain(UI.my_reads.en);
    expect(h).not.toContain(UI.my_delete.en);
  });
});

describe('fix and delete links point to the right places', () => {
  it('"edit answers" opens the questions', () => {
    const onEditCase = vi.fn();
    const [btn] = fix(tree({ onEditCase }), 'edit-case');
    (btn!.props.onClick as () => void)();
    expect(onEditCase).toHaveBeenCalledOnce();
  });
  it('"change language" changes the saved language', () => {
    const onChangeLang = vi.fn();
    const [btn] = fix(tree({ onChangeLang }), 'lang');
    (btn!.props.onClick as () => void)();
    expect(onChangeLang).toHaveBeenCalledOnce();
  });
  it('email login: "change email" goes to the account form; Google login has none (Google owns it)', () => {
    expect(fix(tree({ account: emailUser }), 'email')[0]?.props.href).toBe('#set-acct');
    expect(fix(tree(), 'email')).toHaveLength(0);
  });
  it('"delete my account" goes to the delete section', () => {
    expect(fix(tree(), 'delete')[0]?.props.href).toBe('#set-del');
  });
});

describe('answerRows', () => {
  it('skips what he never answered ("unknown")', () => {
    expect(answerRows({ visa_valid_now: 'unknown', born: '1990-06' }, 'en', [])).toEqual([
      { label: UI.my_f_born.en, value: '6/1990' },
    ]);
  });
  it('a field with no label still shows, so nothing saved is hidden', () => {
    expect(answerRows({ some_new_field: 'x' }, 'en', [])).toEqual([{ label: 'some_new_field', value: 'x' }]);
  });
  it('yes/no answers in words', () => {
    expect(answerRows({ has_teudat_zehut: 'no' }, 'he', [])).toEqual([{ label: UI.my_f_has_teudat_zehut.he, value: UI.my_no.he }]);
  });
});
