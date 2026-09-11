#!/usr/bin/env bash
# Post-deploy smoke test for apps/api — TAPS-1.22.
#
# Exercises three things against the REAL deployed URL, not a mock:
#   1. GET  /health              — liveness
#   2. POST /user-auth/register  then POST /user-auth/login  — user auth, end-to-end
#   3. POST /auth/login          — admin auth, end-to-end
#
# Written this way deliberately: a passing /health alone previously gave false confidence
# while user registration and admin auth were both silently broken in production (see
# docs/sprints/sprint-04-summary.md and docs/adr/017-api-ci-deploy-pipeline.md). Any
# unexpected status code fails the script loudly (exit 1) with the response body printed —
# never a silent skip.
#
# Required env:
#   API_URL              e.g. https://taps-api.fly.dev
#   SMOKE_ADMIN_PASSWORD  real admin plaintext password (GitHub Actions secret)
#
# Usage: .github/scripts/smoke-test-api.sh

set -euo pipefail

if [[ -z "${API_URL:-}" ]]; then
  echo "FAIL: API_URL is not set" >&2
  exit 1
fi
if [[ -z "${SMOKE_ADMIN_PASSWORD:-}" ]]; then
  echo "FAIL: SMOKE_ADMIN_PASSWORD is not set — see docs/runbooks/deploy-api.md" >&2
  exit 1
fi

fail() {
  echo "FAIL: $1" >&2
  echo "--- response body ---" >&2
  echo "$2" >&2
  exit 1
}

# Splits a `curl -w` combined body+status response (status appended on its own last line)
# into BODY / STATUS variables.
split_response() {
  local raw="$1"
  STATUS="${raw##*$'\n'}"
  BODY="${raw%$'\n'"$STATUS"}"
}

echo "== 1/3: GET /health =="
raw=$(curl -sS -w '\n%{http_code}' "$API_URL/health")
split_response "$raw"
[[ "$STATUS" == "200" ]] || fail "expected 200 from /health, got $STATUS" "$BODY"
echo "$BODY" | grep -Eq '"status"\s*:\s*"ok"' || fail '/health body missing "status":"ok"' "$BODY"
echo "OK — $BODY"

echo "== 2/3: POST /user-auth/register + /user-auth/login =="
SMOKE_EMAIL="smoke-test+$(date +%s)-${RANDOM}@taps-smoke-test.invalid"
SMOKE_PASSWORD="Smoke-Test-$(date +%s)-${RANDOM}!"

raw=$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/user-auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\",\"name\":\"Smoke Test\"}")
split_response "$raw"
[[ "$STATUS" == "201" ]] || fail "expected 201 from /user-auth/register, got $STATUS" "$BODY"
echo "$BODY" | grep -q 'accessToken' || fail '/user-auth/register response missing accessToken' "$BODY"
echo "OK — registered $SMOKE_EMAIL"

raw=$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/user-auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}")
split_response "$raw"
[[ "$STATUS" == "200" ]] || fail "expected 200 from /user-auth/login, got $STATUS" "$BODY"
echo "$BODY" | grep -q 'accessToken' || fail '/user-auth/login response missing accessToken' "$BODY"
echo "OK — logged in as $SMOKE_EMAIL"

echo "== 3/3: POST /auth/login (admin) =="
raw=$(curl -sS -w '\n%{http_code}' -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$SMOKE_ADMIN_PASSWORD\"}")
split_response "$raw"
[[ "$STATUS" == "200" ]] || fail "expected 200 from admin /auth/login, got $STATUS" "$BODY"
echo "$BODY" | grep -q 'accessToken' || fail 'admin /auth/login response missing accessToken' "$BODY"
echo "OK — admin login succeeded"

echo
echo "PASS: all smoke tests passed against $API_URL"
