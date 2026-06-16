#!/usr/bin/env bash
# =============================================================================
# IOC Customer — Module CSKH: Production Smoke Test Script
# =============================================================================
# Chạy test toàn bộ 9 modules + webhooks qua Docker (production mode).
#
# Cách dùng:
#   ./scripts/smoke-test.sh                  # chạy đầy đủ
#   ./scripts/smoke-test.sh --no-auth        # bỏ qua auth, dùng cookie có sẵn
#   ./scripts/smoke-test.sh --json           # output JSON
#
# Yêu cầu:
#   - Docker stack đang chạy (docker-compose up -d)
#   - jq + curl + docker CLI
#
# Thoát: 0 = tất cả pass, 1 = có fail
# =============================================================================
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PG_CONTAINER="${PG_CONTAINER:-nestjs-ddd-postgres}"
PG_DB="${PG_DB:-nestjs_project}"
PG_USER="${PG_USER:-postgres}"
API_KEY="${INTER_SERVICE_API_KEY:-test-inter-service-key-2026}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/cskh-cookie.txt}"
JSON_MODE=false
SKIP_AUTH=false

# --- Colors ---
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BLUE=''; NC=''
fi

# --- Args ---
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    --no-auth) SKIP_AUTH=true ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

PASS=0; FAIL=0; ERRORS=()
declare -a RESULTS

record() {
  local label="$1" code="$2" expect="${3:-2xx}"
  local ok="false"
  case "$expect" in
    2xx) [ "$code" -ge 200 ] && [ "$code" -lt 300 ] && ok="true" ;;
    4xx) [ "$code" -ge 400 ] && [ "$code" -lt 500 ] && ok="true" ;;
  esac
  if [ "$ok" = "true" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); ERRORS+=("$label → HTTP $code (expected $expect)"); fi
  if [ "$JSON_MODE" = false ]; then
    local mark="✅"; [ "$ok" = "false" ] && mark="❌"
    printf "  ${mark} %-52s HTTP %s\n" "$label" "$code"
  else
    RESULTS+=("{\"label\":\"$label\",\"code\":$code,\"ok\":$ok}")
  fi
}

req() {  # req <label> <method> <path> [body] [extra-header]
  local label="$1" method="$2" path="$3" body="${4:-}" extra="${5:-}"
  local url="$BASE_URL$path"
  local args=(-s -m 12 -o /dev/null -w "%{http_code}" -X "$method")
  [ -f "$COOKIE_FILE" ] && args+=(-b "$COOKIE_FILE")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  [ -n "$extra" ] && args+=(-H "$extra")
  local code; code=$(curl "${args[@]}" "$url" 2>/dev/null || echo "000")
  record "$label ($method $path)" "$code" "2xx"
}

req_webhook() {  # req_webhook <label> <path> <body> [key|none]
  local label="$1" path="$2" body="$3" keymode="${4:-valid}"
  local url="$BASE_URL$path"
  local args=(-s -m 12 -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json")
  [ "$keymode" = "valid" ] && args+=(-H "x-api-key: $API_KEY")
  local code; code=$(curl "${args[@]}" -d "$body" "$url" 2>/dev/null || echo "000")
  if [ "$keymode" = "valid" ]; then record "$label" "$code" "2xx"; else record "$label (bad key)" "$code" "4xx"; fi
}

banner() { [ "$JSON_MODE" = false ] && printf "\n${BLUE}━━━ %s ━━━${NC}\n" "$1"; }

# =============================================================================
# 0. HEALTH CHECK
# =============================================================================
banner "0. HEALTH CHECK"
hc=$(curl -s -m 10 "$BASE_URL/health" 2>/dev/null || echo "")
if echo "$hc" | grep -q '"status":"up"'; then
  if [ "$JSON_MODE" = false ]; then
    echo "  ✅ App healthy | Ports: $(echo "$hc" | grep -o '"closed":[0-9]*' | cut -d: -f2) CB CLOSED"
  fi
  PASS=$((PASS+1))
else
  echo "  ❌ App NOT healthy hoặc không chạy. Chạy: docker-compose up -d" >&2
  FAIL=$((FAIL+1)); ERRORS+=("Health check failed")
  [ "$JSON_MODE" = false ] && { echo ""; exit 1; }
fi

# =============================================================================
# 1. AUTHENTICATION (phone OTP)
# =============================================================================
banner "1. AUTHENTICATION (better-auth phone OTP)"
if [ "$SKIP_AUTH" = true ] && [ -f "$COOKIE_FILE" ]; then
  [ "$JSON_MODE" = false ] && echo "  ⏭️  Bỏ qua auth (dùng cookie có sẵn)"
else
  PHONE="09$((RANDOM % 90000000 + 10000000))"
  sc=$(curl -s -m 15 -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/phone-number/send-otp" \
       -H "Content-Type: application/json" -d "{\"phoneNumber\":\"$PHONE\"}" 2>/dev/null || echo "000")
  record "Send OTP ($PHONE)" "$sc" "2xx"

  if [ "$sc" = "200" ]; then
    OTP=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc \
          "SELECT split_part(value, ':', 1) FROM verification WHERE identifier='$PHONE' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$OTP" ]; then
      vc=$(curl -s -m 15 -c "$COOKIE_FILE" -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/phone-number/verify" \
           -H "Content-Type: application/json" -d "{\"phoneNumber\":\"$PHONE\",\"code\":\"$OTP\"}" 2>/dev/null || echo "000")
      record "Verify OTP → session cookie" "$vc" "2xx"
    else
      echo "  ❌ Không đọc được OTP từ DB" >&2
      FAIL=$((FAIL+1)); ERRORS+=("Cannot read OTP from DB")
    fi
  fi
fi

# Validate cookie works
if [ -f "$COOKIE_FILE" ]; then
  mc=$(curl -s -m 10 -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/auth/me" 2>/dev/null || echo "000")
  record "GET /auth/me (session valid)" "$mc" "2xx"
fi

# =============================================================================
# 2-10. MODULE SMOKE TESTS
# =============================================================================
banner "2. CUSTOMER"
req "Profile"        GET "/customers/profile"
req "Timeline"       GET "/customers/timeline"
req "Related accts"  GET "/customers/related-accounts"

banner "3. CONTRACT"
req "List"           GET "/contracts"
req "Detail"         GET "/contracts/CTR-2024-0001"
req "Versions"       GET "/contracts/CTR-2024-0001/versions"
req "PDF"            GET "/contracts/CTR-2024-0001/pdf"

banner "4. METER"
req "List"           GET "/meters"
req "Consumption"    GET "/meters/consumption"
req "Comparison"     GET "/meters/consumption/comparison?current=2026-05&previous=2026-04"
req "Calibration"    GET "/meters/MT-001/calibration"
req "History"        GET "/meters/MT-001/history"

banner "5. BILLING"
req "Invoices"       GET "/billing/invoices?status=unpaid&page=1&limit=5"
req "Invoice detail" GET "/billing/invoices/INV-2026-001"
req "Invoice PDF"    GET "/billing/invoices/INV-2026-001/pdf"
req "Tariff plan"    GET "/billing/tariff/CTR-2024-0001"
req "Tariff fees"    GET "/billing/tariff/CTR-2024-0001/fees"

banner "6. PAYMENT"
req "Create payment" POST "/payments" '{"invoiceId":"INV-2026-001","method":"qr_code"}'
req "History"        GET  "/payments/history?page=1&limit=5"
req "Debt"           GET  "/payments/debt"
req "Debt history"   GET  "/payments/debt/history"
req "Auto-debit"     POST "/payments/auto-debit" '{"bankAccount":{"bankName":"VCB","accountNumber":"0123456789","accountHolder":"NGUYEN A"}}'

banner "7. TICKET + KB"
req "Create ticket"     POST "/tickets" '{"type":"water_outage","description":"Test","imageUrls":[]}'
req "Ticket history"    GET  "/tickets?page=1&pageSize=5"
req "Ticket status"     GET  "/tickets/TK-2026-002"
req "Upload URL"        POST "/tickets/upload-url" '{"fileName":"p.jpg","fileType":"image/jpeg"}'
req "CSAT feedback"     POST "/tickets/TK-2026-001/feedback" '{"score":4,"comment":"ok"}'
req "KB categories"     GET  "/knowledge-base/categories"
req "KB search"         GET  "/knowledge-base/search?q=hoa+don"
req "KB article"        GET  "/knowledge-base/articles/art-1"
req "KB rate"           POST "/knowledge-base/articles/art-1/rate" '{"helpful":true}'

banner "8. COMMUNICATION"
req "Active alerts"     GET   "/proactive-notifications/active"
req "Alert history"     GET   "/proactive-notifications/history"
req "Acknowledge"       POST  "/proactive-notifications/ALERT-2026-001/acknowledge"
req "Notif prefs"       GET   "/notifications/preferences"
req "Update prefs"      PATCH "/notifications/preferences" '{"channels":[{"channel":"push","enabled":true}]}'
req "Notif history"     GET   "/notifications/history?page=1&limit=5"

banner "9. SESSION"
req "My session"        GET "/sessions/me?channel=web"
req "Session events"    GET "/sessions/me/events?page=1&pageSize=5"

banner "10. WEBHOOKS"
req_webhook "Payment IPN (valid key)"  "/webhooks/payment/ipn" \
  '{"paymentId":"PAY-TEST","invoiceId":"INV-2026-001","customerId":"x","amount":100,"status":"success","timestamp":"2026-06-13T10:00:00Z"}' valid
req_webhook "Ticket status (valid key)" "/webhooks/ticket/status" \
  '{"ticketId":"TK1","trackingId":"TK-2026-002","customerId":"x","oldStatus":"submitted","newStatus":"in_progress","updatedAt":"2026-06-13T10:00:00Z"}' valid
req_webhook "Payment IPN (NO key)"      "/webhooks/payment/ipn" '{"paymentId":"X"}' none
req_webhook "Payment IPN (WRONG key)"   "/webhooks/payment/ipn" '{"paymentId":"X"}' wrong

banner "11. SWAGGER UI"
sc=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "$BASE_URL/api/docs" 2>/dev/null || echo "000")
record "Swagger HTML" "$sc" "2xx"
sc=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "$BASE_URL/api/docs/swagger-ui-bundle.js" 2>/dev/null || echo "000")
record "Swagger bundle.js" "$sc" "2xx"
sc=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "$BASE_URL/api/docs-json" 2>/dev/null || echo "000")
record "OpenAPI JSON spec" "$sc" "2xx"

# =============================================================================
# SUMMARY
# =============================================================================
if [ "$JSON_MODE" = true ]; then
  printf '{"total":%d,"pass":%d,"fail":%d,"results":[%s]}\n' \
    $((PASS+FAIL)) "$PASS" "$FAIL" "$(IFS=,; echo "${RESULTS[*]}")"
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$FAIL" -eq 0 ]; then
    printf "  ${GREEN}✅ TẤT CẢ PASS: %d/%d tests${NC}\n" "$PASS" $((PASS+FAIL))
  else
    printf "  ${RED}❌ %d FAIL / %d PASS (%d total)${NC}\n" "$FAIL" "$PASS" $((PASS+FAIL))
    echo ""
    for e in "${ERRORS[@]}"; do echo "  ${RED}•${NC} $e"; done
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
