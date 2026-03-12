#!/usr/bin/env bash
set -u

verify_body_file="/tmp/lensically_verify_body.$$"
reset_body_file="/tmp/lensically_reset_body.$$"

cleanup() {
  rm -f "$verify_body_file" "$reset_body_file"
}

trap cleanup EXIT

verify_code="$(curl -s -o "$verify_body_file" -w "%{http_code}" "https://api.lensically.com/api/auth/verify-email?token=not-a-uuid")"
reset_code="$(curl -s -o "$reset_body_file" -w "%{http_code}" -X POST "https://api.lensically.com/api/auth/reset-password" -H "Content-Type: application/json" -d '{"token":"bad-token","password":"new-password-123"}')"

verify_body="$(tr -d '\n' < "$verify_body_file")"
reset_body="$(tr -d '\n' < "$reset_body_file")"

if [[ "$verify_code" == "400" ]] \
  && [[ "$reset_code" == "400" ]] \
  && grep -q "Invalid or expired verification token." "$verify_body_file" \
  && grep -q "Invalid or expired reset token." "$reset_body_file"; then
  echo "[SMOKE] verify=$verify_code reset=$reset_code"
  result=0
else
  echo "[SMOKE] verify=$verify_code reset=$reset_code"
  echo "[SMOKE] verify_body=$verify_body"
  echo "[SMOKE] reset_body=$reset_body"
  result=1
fi

echo
if [[ "$result" -eq 0 ]]; then
  echo "RESULT: SUCCESS"
else
  echo "RESULT: FAIL"
fi

exit "$result"
