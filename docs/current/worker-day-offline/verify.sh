#!/usr/bin/env bash
set -u
mkdir -p tests/reports/worker-day-offline
LOG=tests/reports/worker-day-offline
FAILED=0
run_check() {
  name="$1"; shift
  "$@" > "$LOG/$name.log" 2>&1
  code=$?
  printf '%s\t%s\n' "$name" "$code" | tee -a "$LOG/checks.tsv"
  if [ "$code" != 0 ]; then tail -60 "$LOG/$name.log"; FAILED=1; fi
}
: > "$LOG/checks.tsv"
git rev-parse HEAD > "$LOG/source-commit.txt"
run_check documentation python3 scripts/check-documentation.py
run_check requirements node scripts/audit-requirements.mjs --check
run_check catalogue node scripts/test.mjs --check-catalogue
run_check dependencies npm run install:ci
git diff -- pnpm-workspace.yaml > "$LOG/installer-workspace.diff"
git restore --source=HEAD -- pnpm-workspace.yaml
run_check lint npm run lint:baseline
run_check types npm run typecheck
run_check build npm run build
if [ -f dist/server/wrangler.json ]; then
  run_check chromium node_modules/.bin/playwright install --with-deps chromium
  run_check contracts node scripts/test.mjs unit --only unit/worker-day-offline-contract,unit/app-offline-contract --fast --guard
  run_check shell node tests/field-shell-current-assets.mjs
  run_check browser node scripts/test.mjs smoke --only smoke/worker-day-offline-browser,smoke/worker-day-browser --fast --guard
else
  printf 'chromium\tblocked\ncontracts\tblocked\nshell\tblocked\nbrowser\tblocked\n' >> "$LOG/checks.tsv"
  FAILED=1
fi
exit "$FAILED"
