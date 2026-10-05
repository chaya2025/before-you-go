import { defineConfig } from 'vitest/config';

/**
 * Config for the RLS attack test only (`npm run test:rls`). It talks to the
 * real Supabase project over the internet.
 *
 * ⚠️ This machine's network checks HTTPS through the Windows certificate store,
 * which Node ignores by default ("unable to get issuer cert"). The test workers
 * are separate processes started after this file runs, so setting this here
 * reaches them and makes Node use the system's certificates.
 */
process.env.NODE_USE_SYSTEM_CA = '1';

export default defineConfig({
  test: { include: ['src/rls.attack.test.ts'], pool: 'forks', testTimeout: 20_000 },
});
