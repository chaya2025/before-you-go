# =============================================================================
# FALLBACK ONLY. The live deploy uses apprunner.yaml, not this file.
# =============================================================================
#
# Kept because App Runner's managed Node runtime is a convenience, not a
# guarantee. If it ever refuses this project, `docker build .` produces the same
# thing with no dependency on AWS at all, and runs identically on any host.
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
RUN npm run build --workspace @byg/web

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "@byg/api"]
