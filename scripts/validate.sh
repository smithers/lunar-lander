#!/usr/bin/env bash
# Single quality gate: type-check, lint, unit tests. Stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== typecheck =="; npm run --silent typecheck
echo "== lint ==";      npm run --silent lint
echo "== unit tests =="; npm run --silent test
echo "validate: OK"
