import { randomUUID } from 'node:crypto';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { DocKind } from './read-document';

/**
 * ============================================================================
 * DOCUMENT STORAGE — the S3 bucket (M3.2)
 * ============================================================================
 *
 * ⭐ THE UPLOAD LINK IS A ONE-TIME TICKET. The browser never gets an AWS key.
 * It asks us for a ticket ("presigned POST"): good for ONE file, at ONE name
 * we chose, of ONE file type, under a size cap, for 5 minutes. S3 itself
 * checks every one of those conditions and refuses anything else.
 *
 * ⭐ WHY A POST AND NOT A PUT. A presigned PUT cannot cap the file size; a
 * presigned POST can (`content-length-range`). Without a cap, one ticket
 * could fill the bucket. (M3 D-20)
 *
 * ⚠️ FILES ARE DELETED AFTER A GOOD READ (D-202, replaces M3 D-13). Once
 * Claude has read the file and the reading passed our checks, we delete it.
 * A FAILED read keeps it (SEC D-1): the bucket's lifecycle rule deletes every
 * file 1 day after upload (infra/s3-lifecycle.json). That same rule covers
 * abandoned uploads and deleted accounts (SEC D-5). The bucket is private,
 * blocks all public access, and is encrypted by AWS by default.
 *
 * ⚠️ Locally the key comes from .env (an IAM user that can only put, get and
 * delete in this one bucket, see infra/iam-docs-bucket-policy.json). On Lambda there is no key: the function's role
 * carries the permission. Same code, the SDK finds whichever is there.
 */

export const UPLOAD_LINK_SECONDS = 5 * 60;

/** Claude reads images up to 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** PDFs: S3 has no 6 MB Lambda limit; 20 MB keeps the request to Claude under its 32 MB. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export const maxBytesFor = (mediaType: string) =>
  mediaType === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;

const bucket = process.env.BYG_DOCS_BUCKET;
const s3 = bucket ? new S3Client({ region: process.env.AWS_REGION ?? 'eu-central-1' }) : null;

export const storageIsConfigured = () => s3 !== null;

/**
 * ⚠️ Only names WE made are ever read back: uploads/{kind}/{user id}/{random id}.
 * A browser cannot send "../" or another path, or another user's file, and
 * have us fetch it.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^uploads/(form_89|passport|visa|licence)/${UUID}/${UUID}$`);
export const isOurKey = (key: unknown, kind: DocKind, userId: string): key is string =>
  typeof key === 'string' && KEY.test(key) && key.startsWith(`uploads/${kind}/${userId}/`);

export async function createUploadLink(kind: DocKind, mediaType: string, userId: string, expires = UPLOAD_LINK_SECONDS) {
  if (!s3 || !bucket) return null;
  const key = `uploads/${kind}/${userId}/${randomUUID()}`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, maxBytesFor(mediaType)],
      ['eq', '$Content-Type', mediaType],
    ],
    Fields: { 'Content-Type': mediaType },
    Expires: expires,
  });
  return { url, fields, key };
}

/** The stored file as base64, with the type S3 recorded for it. null if missing. */
export async function fetchDocument(key: string): Promise<{ media_type: string; data: string } | null> {
  if (!s3 || !bucket) return null;
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await obj.Body?.transformToByteArray();
    if (!bytes || !obj.ContentType) return null;
    return { media_type: obj.ContentType, data: Buffer.from(bytes).toString('base64') };
  } catch {
    // ⚠️ Nothing logged: the key names a person's document.
    return null;
  }
}

/**
 * ⭐ Delete the file after a good read. Never throws: if S3 refuses, he still
 * gets his reading and the 1-day lifecycle rule removes the file anyway.
 */
export async function deleteDocument(key: string): Promise<void> {
  if (!s3 || !bucket) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // ⚠️ Nothing logged: the key names a person's document.
  }
}
