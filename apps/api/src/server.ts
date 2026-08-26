import { buildApp } from './app';

/**
 * Starts the API. The only job of this file.
 *
 * Everything about WHAT the API does lives in app.ts, which can be built and
 * exercised in memory. This file adds the one thing tests must not do: bind a
 * real port.
 */
const PORT = Number(process.env.PORT ?? 3001);

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: '127.0.0.1' });
  app.log.info(`Before You Go API · http://127.0.0.1:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
