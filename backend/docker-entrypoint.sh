#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "$DEMO_MODE" = "true" ]; then
  echo "Seeding demo data (idempotent)..."
  node dist/database/seed.js
fi

exec node dist/main.js
