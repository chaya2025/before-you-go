import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { QuotaFn } from './quota';

/**
 * ============================================================================
 * SEC M1 · THE FILE IS DELETED AFTER A GOOD READ (D-202, D-1)
 * ============================================================================
 *
 * No network here. S3 is replaced by a stand-in ("mock") that remembers every
 * command it was sent, and the model by one that returns a fixed answer.
 * What these tests prove is OUR side: after a good read we ask S3 to delete
 * the file; after a failed read we leave it for the bucket's 1-day rule; a
 * failed delete never fails his request and never logs the file's name.
 */

// vi.hoisted runs before the imports below, so storage.ts sees a bucket.
const s3 = vi.hoisted(() => {
  process.env.BYG_DOCS_BUCKET = 'test-bucket';
  return { sent: [] as { cmd: string; input: { Bucket: string; Key: string } }[], failDelete: false };
});

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public input: { Bucket: string; Key: string }) {}
  }
  class GetObjectCommand extends Command {}
  class DeleteObjectCommand extends Command {}
  class S3Client {
    async send(command: Command) {
      const cmd = command.constructor.name;
      s3.sent.push({ cmd, input: command.input });
      if (cmd === 'GetObjectCommand') {
        return { ContentType: 'image/png', Body: { transformToByteArray: async () => new Uint8Array(10) } };
      }
      if (cmd === 'DeleteObjectCommand' && s3.failDelete) throw new Error(`AccessDenied on ${command.input.Key}`);
      return {};
    }
  }
  return { S3Client, GetObjectCommand, DeleteObjectCommand };
});

const { buildApp } = await import('./app');

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const FILE = '33333333-3333-4333-8333-333333333333';
const MY_KEY = `uploads/passport/${ME}/${FILE}`;

const quota: QuotaFn = async (token) =>
  token === 'good' ? { status: 'ok', user_id: ME, allowed: true, left: 5 } : { status: 'no_login' };

const goodRead = {
  messages: {
    create: async () => ({
      content: [{ type: 'tool_use', id: 't', name: 'report_document',
        input: { document_seen: 'passport', expiry_date: '2030-01-31', printed_language: null } }],
    }),
  },
} as unknown as Anthropic;
const claudeError = { messages: { create: async () => { throw new Error('boom'); } } } as unknown as Anthropic;
const wrongDocument = {
  messages: {
    create: async () => ({ content: [{ type: 'tool_use', id: 't', name: 'report_document', input: { document_seen: 'visa' } }] }),
  },
} as unknown as Anthropic;

const read = async (client: Anthropic, key = MY_KEY) => {
  const app = await buildApp({ logger: false, quota, readClient: client });
  const res = await app.inject({
    method: 'POST', url: '/api/v1/read-document',
    payload: { kind: 'passport', key }, headers: { authorization: 'Bearer good' },
  });
  await app.close();
  return { code: res.statusCode, body: res.json() };
};

const deletes = () => s3.sent.filter((c) => c.cmd === 'DeleteObjectCommand');

beforeEach(() => {
  s3.sent.length = 0;
  s3.failDelete = false;
});

describe('after a good read, the file is gone', () => {
  it('deletes exactly the file that was read, from our bucket', async () => {
    const { body } = await read(goodRead);
    expect(body.ok).toBe(true);
    expect(deletes()).toEqual([{ cmd: 'DeleteObjectCommand', input: { Bucket: 'test-bucket', Key: MY_KEY } }]);
  });

  it('a failed delete does not fail his request, and logs nothing', async () => {
    s3.failDelete = true;
    const log = vi.spyOn(console, 'log');
    const err = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const { code, body } = await read(goodRead);
    expect(code).toBe(200);
    expect(body.ok).toBe(true);
    expect(deletes()).toHaveLength(1);
    for (const spy of [log, err, warn]) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(FILE);
      spy.mockRestore();
    }
  });
});

describe('after a failed read, the file stays for the 1-day rule (D-1)', () => {
  it.each([
    ['Claude errors', claudeError],
    ['it is the wrong document', wrongDocument],
  ])('%s: nothing is deleted', async (_, client) => {
    const { body } = await read(client);
    expect(body.ok).toBe(false);
    expect(deletes()).toEqual([]);
  });
});

describe('someone else’s file is still refused', () => {
  it('400, never fetched, never deleted', async () => {
    const { code } = await read(goodRead, `uploads/passport/${OTHER}/${FILE}`);
    expect(code).toBe(400);
    expect(s3.sent).toEqual([]);
  });
});
