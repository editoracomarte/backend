#!/bin/sh
set -e

EXPORT_FILE="/app/seed/strapi-export.tar.gz.enc"

if [ "$SEED_ON_BOOT" != "true" ]; then
  echo "Seed: skipped (SEED_ON_BOOT is not 'true')."
  exec "$@"
fi

if [ "$NODE_ENV" = "production" ]; then
  echo "Seed: refusing to run with NODE_ENV=production." >&2
  echo "      To seed a fresh production database, run the import manually once." >&2
  exit 1
fi

if [ -z "$STRAPI_IMPORT_ENCRYPTION_KEY" ]; then
  echo "Seed: SEED_ON_BOOT=true but STRAPI_IMPORT_ENCRYPTION_KEY is not set." >&2
  exit 1
fi

if [ ! -f "$EXPORT_FILE" ]; then
  echo "Seed: SEED_ON_BOOT=true but $EXPORT_FILE was not found." >&2
  exit 1
fi

BOOKS=$(PGPASSWORD="$DATABASE_PASSWORD" psql \
  -h "$DATABASE_HOST" -p "${DATABASE_PORT:-5432}" \
  -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
  -tAc "SELECT count(*) FROM books" 2>/dev/null || echo 0)

# ${BOOKS:-0}: an empty value makes `[ "" -gt 0 ]` abort the script under `set -e`.
if [ "${BOOKS:-0}" -gt 0 ]; then
  echo "Seed: skipped (database already has $BOOKS books)."
  exec "$@"
fi

echo "Seed: importing into an empty database..."
npm run strapi import -- -f "$EXPORT_FILE" --force -k "$STRAPI_IMPORT_ENCRYPTION_KEY"
echo "Seed: done."

exec "$@"
