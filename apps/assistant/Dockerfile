# The "ask your case" chat service (M6) as a Lambda container image.
#
# WHY a container and not a zip: the site's API already ships this way, so it
# is the same shelf (ECR), the same deploy step and the same thing to explain.
# AWS's own Python base image already knows how to run a Lambda handler.
#
# Built by .github/workflows/aws-image.yml (job "ask"), tagged ask-<commit>,
# on the same ECR shelf as the site. No secrets in here: the keys are the
# Lambda's environment variables, set in the AWS console.
FROM public.ecr.aws/lambda/python:3.12

# Dependencies first, pinned in pyproject.toml, so a code-only change reuses
# this layer. The knowledge items (app/data/*.json) ship inside the package.
COPY pyproject.toml ${LAMBDA_TASK_ROOT}/
COPY app ${LAMBDA_TASK_ROOT}/app
RUN pip install --no-cache-dir "${LAMBDA_TASK_ROOT}" && rm -rf "${LAMBDA_TASK_ROOT}/build"

# Mangum turns the API Gateway request into a FastAPI one (app/main.py).
CMD ["app.main.handler"]
