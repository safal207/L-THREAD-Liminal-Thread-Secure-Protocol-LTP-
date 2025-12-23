node scripts/generate-golden-trace.js
node packages/inspect/bin/ltp.js inspect artifacts/traces/fintech/golden.auditlog.jsonl   --compliance fintech   --format json | grep -q '"verdict": "PASS"'
