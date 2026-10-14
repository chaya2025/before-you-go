/**
 * Runs every fake document through the REAL model and checks the answer
 * against what is printed on it (fixtures/documents/expected.json).
 *
 * ⚠️ Costs a few cents per run: real calls, real key. Not part of `npm test`.
 * Run:  npx tsx apps/api/scripts/read-fake-set.ts [model]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');
try {
  process.loadEnvFile(join(root, '.env'));
} catch {}

// Imported after the key is loaded, because the module reads it once at load.
const { readDocument, READ_MODEL } = await import('../src/read-document');
const Anthropic = (await import('@anthropic-ai/sdk')).default;

const model = process.argv[2] ?? READ_MODEL;
const dir = join(import.meta.dirname, '../fixtures/documents');
const expected: Record<string, { kind: 'passport' | 'visa' | 'licence'; want: unknown }> = JSON.parse(
  readFileSync(join(dir, 'expected.json'), 'utf8'),
);

// Same reader, model swapped in for the measurement only.
const base = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const client = new Proxy(base, {
  get(target, prop) {
    if (prop !== 'messages') return Reflect.get(target, prop);
    return { create: (p: object) => target.messages.create({ ...p, model } as never) };
  },
}) as typeof base;

let pass = 0;
const rows: string[] = [];
for (const [file, { kind, want }] of Object.entries(expected)) {
  const media_type = file.endsWith('.pdf') ? 'application/pdf' : 'image/png';
  const data = readFileSync(join(dir, file)).toString('base64');
  const got = await readDocument({ kind, media_type, data }, { client });

  const ok =
    want === null
      ? !got.ok && got.reason === 'unreadable'
      : want === 'wrong_document'
        ? !got.ok && got.reason === 'wrong_document'
        : got.ok && JSON.stringify(got.fields) === JSON.stringify(want);
  if (ok) pass++;
  const shown = got.ok ? JSON.stringify(got.fields) : `${got.reason}${got.seen ? ` (${got.seen})` : ''}`;
  rows.push(`${ok ? 'PASS' : 'FAIL'}  ${file.padEnd(24)} ${shown}`);
}

console.log(`model: ${model}`);
console.log(rows.join('\n'));
console.log(`\n${pass}/${rows.length} correct`);
process.exit(pass === rows.length ? 0 : 1);
