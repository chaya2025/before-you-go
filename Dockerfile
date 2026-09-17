# =============================================================================
# How Before You Go is packaged. Render builds and runs this file (render.yaml).
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
RUN npm run build --workspace @byg/web

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "@byg/api"]
