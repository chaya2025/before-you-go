import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Profile, evaluate, ALL_VISA_PROFILES, ALL_PROCESSES, LicenseClass } from '@byg/engine';
import { explain, modelIsConfigured, type Lang } from './explain';

/**
 * ============================================================================
 * THE API
 * ============================================================================
 *
 * Deliberately thin. It validates the request, calls the engine, and returns
 * what the engine said. No rule, no threshold, no date arithmetic lives here.
 *
 * ⭐ Why that matters: if the server were allowed to interpret anything, the
 * same person could get a different answer from the website than from the
 * tests. Everything that decides lives in @byg/engine, tested on its own.
 *
 * ⚠️ Privacy (hard rule 1). Nothing is stored. Nothing is logged beyond the
 * route and the status code. The body carries someone's immigration status, so
 * it never reaches a disk, a database, or an error report.
 *
 * ⚠️ This file BUILDS the server; it does not start it. Starting is a side
 * effect and lives in server.ts. Splitting them is what lets the tests run the
 * whole API in memory, with no port and no network — the same edge-versus-core
 * separation the engine and the CLI already use.
 */

/**
 * The dev servers Vite might pick. A list, not a wildcard.
 *
 * In production the website is served by this same server, so requests are
 * same-origin and CORS never comes into it. `WEB_ORIGIN` exists only for the
 * day the website moves to its own domain: set it and that origin is allowed,
 * without ever loosening this to `*`. The body carries someone's immigration
 * status, so a wildcard is not an option.
 */
export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  ...(process.env.WEB_ORIGIN ? [process.env.WEB_ORIGIN] : []),
];

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false
      ? false
      : {
          level: 'info',
          // ⚠️ Route and status only. Never the body.
          serializers: {
            req: (req) => ({ method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
        },
  });

  await app.register(cors, { origin: ALLOWED_ORIGINS });

  app.get('/health', async () => ({ ok: true }));

  /**
   * Everything the intake form needs in order to ask ש1 and ש4.
   *
   * ⭐ The website holds NO domain knowledge. It does not keep a list of visa
   * types, and does not know which ones usually come with a teudat zehut. It
   * asks. A change to the data file then reaches the screen without the website
   * being touched at all.
   */
  app.get('/api/v1/statuses', async () => ({
    statuses: ALL_VISA_PROFILES.map((v) => ({
      value: v.visa_type,
      label: v.label,
      /**
       * ⭐ Added 30.8 so the website stops guessing. It needs to know which
       * date to ask for, and that follows from the CATEGORY, not from the visa
       * code. Sending the category means the mapping lives in the data, where
       * it can be corrected once — גיליון 14 has already moved תושב קבע once.
       */
      nohal_category: v.nohal_category,
      /** Powers the ש4 confirmation: "לפי המעמד שבחרת כנראה אין לך ת״ז. נכון?" */
      usually_has_teudat_zehut: v.usually_has_teudat_zehut,
      /** The physical document he carries, so the question can be concrete. */
      identity_document: v.identity_document,
      caveat: v.caveat ?? null,
    })),
    license_classes: LicenseClass.options,
  }));

  /**
   * ⭐ What this system can check you are ready for.
   *
   * ⚠️ Served rather than hardcoded in the website, for exactly the reason the
   * visa list is: apps/web holds no domain knowledge. When a second process
   * becomes real, the landing page changes without the website being touched.
   *
   * `status` is honest — a 'planned' process is rendered as not-yet-available
   * and is not clickable.
   */
  app.get('/api/v1/processes', async () => ({ processes: ALL_PROCESSES }));

  /**
   * The one endpoint that matters. A profile in, a readiness answer out.
   *
   * `today` is accepted from the caller so answers are reproducible and so the
   * UI can ask "what will this look like in six months". It is arithmetic
   * input, not a security boundary.
   */
  app.post('/api/v1/readiness', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'expected a JSON object' });
    }

    const { today, ...profileInput } = body as { today?: string };

    const parsed = Profile.safeParse(profileInput);
    if (!parsed.success) {
      // Field-level errors, so the form can point at the offending question
      // instead of saying "something went wrong".
      return reply.status(422).send({
        error: 'invalid profile',
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join('.') || '(root)',
          message: i.message,
        })),
      });
    }

    const asOf =
      typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
        ? today
        : new Date().toISOString().slice(0, 10);

    return evaluate(parsed.data, asOf);
  });

  /**
   * ⭐ THE LANGUAGE LAYER. The finished decision, said in plain words.
   *
   * ⚠️ ITS OWN ENDPOINT, and that is a cost decision as much as a design one.
   * Ticking a step on the roadmap re-runs the whole engine; folding this into
   * /readiness would fire a paid model call on every checkbox click. The
   * deterministic path stays free, and this is asked for once, on purpose.
   *
   * ⚠️ It takes a PROFILE and evaluates it here rather than accepting a Result
   * from the browser. A Result posted by a client is a Result a client could
   * have edited, and this endpoint would then be putting friendly words around
   * a decision the engine never made.
   *
   * ⚠️ Never returns an error for a model failure. No key, no credit, no
   * network — all of them come back 200 with the deterministic text and
   * `source: "deterministic"`, because the product has to work with the model
   * switched off.
   */
  app.post('/api/v1/explain', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'expected a JSON object' });
    }

    const { today, lang, ...profileInput } = body as { today?: string; lang?: string };

    const parsed = Profile.safeParse(profileInput);
    if (!parsed.success) {
      return reply.status(422).send({
        error: 'invalid profile',
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join('.') || '(root)',
          message: i.message,
        })),
      });
    }

    const asOf =
      typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
        ? today
        : new Date().toISOString().slice(0, 10);

    const result = evaluate(parsed.data, asOf);
    return explain(result, lang === 'en' ? 'en' : ('he' as Lang));
  });

  /**
   * So the website can tell the difference between "the plain-language layer is
   * switched off here" and "it failed". Different sentences belong on screen.
   */
  app.get('/api/v1/capabilities', async () => ({ plain_language: modelIsConfigured() }));

  return app;
}
