#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding demo data (idempotent)..."
node dist/database/seed.js

exec node dist/main.js
