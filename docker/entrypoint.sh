#!/bin/sh
set -e

SEED_FILE="/strapi-seed/.seeded"
EXPORT_FILE="/app/seed/strapi-export.tar.gz.enc"

if [ ! -f "$SEED_FILE" ] && [ -f "$EXPORT_FILE" ]; then
  if [ -z "$STRAPI_IMPORT_ENCRYPTION_KEY" ]; then
    echo "Error: STRAPI_IMPORT_ENCRYPTION_KEY is not set." >&2
    exit 1
  fi
  echo "Importing Strapi data..."
  npm run strapi import -- -f "$EXPORT_FILE" --force -k "$STRAPI_IMPORT_ENCRYPTION_KEY"
  touch "$SEED_FILE"
  echo "Import done."
elif [ -f "$SEED_FILE" ]; then
  echo "Skipping import: already seeded."
else
  echo "Skipping import: export file not found."
fi

exec "$@"
