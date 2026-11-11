#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Headless provisioning of the gafood backend's Documenso API token.
#
# Documenso has NO public UI in this deploy, so the token cannot be minted in
# the dashboard. Documenso v2 also made ApiToken.teamId REQUIRED (a token must
# belong to a Team → Organisation), so a raw "INSERT one row" no longer works.
#
# Instead we run seed-bridge-token.mjs INSIDE the documenso-app container, which
# reuses Documenso's own code to create the service user + personal org/team and
# then inserts an ApiToken whose hash = sha512hex(DOCUMENSO_API_TOKEN). The SAME
# raw token is the backend's DOCUMENSO_API_TOKEN, so the two sides match — the
# token is PRE-CHOSEN, not minted, so no redeploy/feedback loop is needed.
#
# Idempotent: safe to run on every deploy.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

: "${DOCUMENSO_API_TOKEN:?DOCUMENSO_API_TOKEN must be set (form: api_<random>)}"
DB_USER="${POSTGRES_USER:-documenso}"
DB_NAME="${POSTGRES_DB:-documenso}"
APP_CONTAINER="documenso-app"
DB_CONTAINER="documenso-db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Documenso runs its Prisma migrations on app startup. The "free" SubscriptionClaim
# (needed by createPersonalOrganisation) is seeded by those migrations, so wait
# for it before seeding.
echo "Waiting for Documenso to migrate the database..."
for i in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
       "SELECT 1 FROM \"SubscriptionClaim\" WHERE id = 'free'" 2>/dev/null | grep -q 1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Documenso migrations never completed — aborting seed." >&2
    exit 1
  fi
  sleep 5
done

# Copy the seed script into the app container (it has node + the compiled libs +
# the generated Prisma client) and run it. DOCUMENSO_API_TOKEN is passed via env,
# never interpolated into a command line.
docker cp "$SCRIPT_DIR/seed-bridge-token.mjs" "$APP_CONTAINER:/app/seed-bridge-token.mjs"
docker exec -e DOCUMENSO_API_TOKEN="$DOCUMENSO_API_TOKEN" "$APP_CONTAINER" \
  sh -c 'cd /app && node seed-bridge-token.mjs'

echo "Documenso API token provisioned."
