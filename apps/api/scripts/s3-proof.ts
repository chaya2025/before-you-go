/**
 * M3.2 proof, against the REAL bucket. Not part of `npm test`.
 *   1. a big PDF (over Lambda's 6 MB) goes up through a ticket and is read
 *   2. an expired ticket is refused by S3
 *   3. a file over the ticket's size cap is refused by S3
 * Run:  npx tsx apps/api/scripts/s3-proof.ts <path-to-big.pdf>
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
} catch {}

const { buildApp } = await import('../src/app');
const { createUploadLink } = await import('../src/storage');

const app = await buildApp({ logger: false });
const api = async (url: string, payload: object) => (await app.inject({ method: 'POST', url, payload })).json();

const upload = async (link: { url: string; fields: Record<string, string> }, bytes: Uint8Array, type: string) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(link.fields)) form.append(k, v);
  form.append('file', new Blob([bytes], { type }));
  const res = await fetch(link.url, { method: 'POST', body: form });
  const code = /<Code>(.*?)<\/Code>/.exec(await res.text())?.[1] ?? '';
  return `${res.status}${code ? ` ${code}` : ''}`;
};

// 1. Big PDF, the whole real path.
const big = readFileSync(process.argv[2]!);
const link = await api('/api/v1/upload-link', { kind: 'passport', media_type: 'application/pdf' });
console.log(`1. big PDF ${(big.length / 1024 / 1024).toFixed(1)} MB → S3: ${await upload(link, big, 'application/pdf')}`);
console.log(`   stored as: ${link.key}`);
console.log(`   read:`, JSON.stringify(await api('/api/v1/read-document', { kind: 'passport', key: link.key })));

// 2. A ticket that lived 1 second, used after 3.
const expired = await createUploadLink('passport', 'image/png', 1);
await new Promise((r) => setTimeout(r, 3000));
console.log(`2. expired ticket: ${await upload(expired!, new Uint8Array(100), 'image/png')}`);

// 3. 6 MB on an image ticket (cap 5 MB).
const small = await api('/api/v1/upload-link', { kind: 'passport', media_type: 'image/png' });
console.log(`3. 6 MB on a 5 MB ticket: ${await upload(small, new Uint8Array(6 * 1024 * 1024), 'image/png')}`);

await app.close();
