#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"

echo "Haymarket — Stripe test mode setup"
echo "=================================="
echo ""

if ! command -v stripe >/dev/null 2>&1; then
  echo "Stripe CLI not found. Install with:"
  echo "  brew install stripe/stripe-cli/stripe"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/server/.env.example" "$ENV_FILE"
  echo "Created server/.env from .env.example"
fi

echo "Step 1 — Log into Stripe (opens browser)"
echo "  stripe login"
echo ""
echo "Step 2 — Create test API keys at:"
echo "  https://dashboard.stripe.com/test/apikeys"
echo ""
echo "Step 3 — Add to server/.env:"
echo "  STRIPE_SECRET_KEY=sk_test_..."
echo "  STRIPE_WEBHOOK_SECRET=whsec_...   (from step 4)"
echo "  STRIPE_DEV_AUTO_PAY=false"
echo "  APP_URL=http://localhost:5173"
echo ""
echo "Step 4 — Forward webhooks locally (keep this running):"
echo "  npm run stripe:webhook"
echo "  Copy the whsec_... signing secret into STRIPE_WEBHOOK_SECRET, then restart the API."
echo ""
echo "Step 5 — Test a paid listing at http://localhost:5173/post-job"
echo "  Use card: 4242 4242 4242 4242 · any future expiry · any CVC"
echo ""
echo "Check configuration:"
echo "  curl http://localhost:3001/api/billing/status"
