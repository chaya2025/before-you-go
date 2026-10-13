# =============================================================================
# How Before You Go is packaged. GitHub Actions builds this file for AWS Lambda
# (aws-image workflow). Render's render.yaml can still run it if resumed.
# =============================================================================
#
# One container, one Node server serving both the website and the API. Nothing
# here depends on a particular host: `docker build .` runs the same anywhere.
#
# A Dockerfile is a recipe for a whole computer: which Linux, which Node, which
# files, which command. That is why "works on my machine" stops being a problem.

FROM node:22-slim
WORKDIR /app

# ⭐ Copy the manifests BEFORE the source code. Docker caches each step and
# re-runs a step only when its inputs changed. Dependencies change rarely and
# source changes constantly, so this ordering means editing a .tsx file does not
# reinstall node_modules. It is the difference between a 10s and a 3m rebuild.
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .
# ⭐ Accounts (M1). Vite writes these into the site WHILE BUILDING, so they must
# exist at build time, not just at run time. The aws-image workflow hands its
# secrets to the build as these ARGs (Render, if resumed, its dashboard). Both
# are public by design (the database's own rules, RLS, are the lock).
# Missing → the site builds without accounts.
# VITE_EMAIL_LOGIN is left unset on purpose: Google-only in public (D-154).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build --workspace @byg/web

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# ⭐ AWS Lambda (M2 part 2, D-182). Lambda does not send normal web requests,
# it sends "events". The Lambda Web Adapter is a small translator that Lambda
# starts next to the server: it turns each event into a normal request on PORT
# and the server's answer back into an event. Off Lambda (Render, a laptop) it
# is never started, so this line changes nothing there.
# It waits for /health to answer before letting traffic in.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_READINESS_CHECK_PATH=/health
# ⚠️ On Lambda every folder is read-only except /tmp, and npm writes a cache
# and logs when it starts. Pointing them at /tmp keeps the start from failing.
ENV npm_config_cache=/tmp/.npm

CMD ["npm", "run", "start", "--workspace", "@byg/api"]
