#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# run-migration.sh
# Runs the email draft system migration against your Supabase DB
# Usage: bash scripts/run-migration.sh
# ─────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env.local"
MIGRATION="$ROOT_DIR/supabase/migrations/005_email_drafts.sql"

# Load .env.local
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
else
  echo "❌ .env.local not found. Copy .env.local.example and fill in your values."
  exit 1
fi

# Build connection string from Supabase URL
# NEXT_PUBLIC_SUPABASE_URL = https://XXXX.supabase.co
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL not set in .env.local"
  exit 1
fi

PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co.*||')
DB_HOST="db.${PROJECT_REF}.supabase.co"

# Prompt for DB password if not set
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "Enter your Supabase database password (from Project Settings > Database):"
  read -s SUPABASE_DB_PASSWORD
fi

export PGPASSWORD="$SUPABASE_DB_PASSWORD"

echo ""
echo "🚀 Running migration against: $DB_HOST"
echo "   File: $MIGRATION"
echo ""

psql \
  -h "$DB_HOST" \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f "$MIGRATION" \
  --set ON_ERROR_STOP=1

echo ""
echo "✅ Migration complete!"
echo "   Visit /setup in your app to verify the configuration."
