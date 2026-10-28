# infra

AWS settings that live in AWS, written down here so they can be reviewed and re-applied. Nothing in this folder runs on its own.

## s3-lifecycle.json: every file in the documents bucket is deleted 1 day after upload
Safety net for failed reads (SEC D-1), abandoned uploads and deleted accounts (SEC D-5). A good read deletes the file at once (D-202, `apps/api/src/storage.ts`).

Run as the admin user (not the app's IAM user). It REPLACES any rules already on the bucket, so look first:

```
aws s3api get-bucket-lifecycle-configuration --bucket byg-documents-dev-s3 --region eu-central-1
aws s3api put-bucket-lifecycle-configuration --bucket byg-documents-dev-s3 --region eu-central-1 --lifecycle-configuration file://infra/s3-lifecycle.json
aws s3api get-bucket-lifecycle-configuration --bucket byg-documents-dev-s3 --region eu-central-1
```

S3 runs lifecycle rules once a day, so a file can live up to about 2 days in the worst case.

## iam-docs-bucket-policy.json: what the app may do in the bucket
Put, get and delete, only under `uploads/`. Attach it (or add `s3:DeleteObject` to the existing statement) on BOTH:
- the Lambda function's execution role (production)
- the local IAM user whose key is in `.env` (dev)

Without `s3:DeleteObject` the delete fails quietly and the 1-day rule cleans up instead.
