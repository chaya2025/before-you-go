import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { buildApp } from './app';

/**
 * Starts the API. The only job of this file.
 *
 * Everything about WHAT the API does lives in app.ts, which can be built and
 * exercised in memory. This file adds the things tests must not do: bind a real
 * port, and touch the file system.
 *
 * ⭐ Serving the website also lives here, NOT in app.ts. app.ts stays a pure
 * "requests in, engine answers out" object with no idea a website exists. Where
 * the HTML comes from is a deployment concern, and deployment concerns live at
 * the edge — the same reason the engine knows nothing about HTTP.
 */

const PORT = Number(process.env.PORT ?? 3001);

/**
 * ⚠️ THE CONTAINER TRAP. `127.0.0.1` means "only accept connections from this
 * same machine". Inside a container that is the container itself, so the
 * outside world — including the health check that decides whether the deploy
 * succeeded — gets refused, and the platform reports a mysterious failure.
 * `0.0.0.0` means "accept from any network interface".
 *
 * Local dev stays on 127.0.0.1 so nothing on the café wifi can reach your
 * laptop. Production sets HOST=0.0.0.0.
 */
const HOST = process.env.HOST ?? '127.0.0.1';

const app = await buildApp();

/**
 * The built website, if it has been built. `npm run build --workspace @byg/web`
 * produces apps/web/dist; in development it usually does not exist, because
 * Vite serves the site itself on 5173. So this is conditional: present in
 * production, absent locally, and neither case is an error.
 */
const WEB_DIST = join(import.meta.dirname, '../../web/dist');

if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST });
  app.log.info(`serving the website from ${WEB_DIST}`);
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Before You Go API · http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
