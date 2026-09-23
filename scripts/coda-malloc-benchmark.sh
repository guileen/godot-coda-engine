#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COUNTER="$(mktemp /tmp/coda-malloc-counter.XXXXXX.dylib)"
REPORT="$(mktemp /tmp/coda-malloc-report.XXXXXX.json)"
trap 'rm -f -- "$COUNTER" "$REPORT"' EXIT INT TERM

clang -dynamiclib -O2 "$ROOT_DIR/scripts/coda-malloc-counter.c" -o "$COUNTER"
DYLD_INSERT_LIBRARIES="$COUNTER" CODA_MALLOC_REPORT="$REPORT" godot --headless --path "$ROOT_DIR" --script res://tests/integration/benchmark.gd >"$REPORT.stdout" 2>&1
cat "$REPORT"
printf '%s\n' "--- benchmark output ---" >&2
tail -20 "$REPORT.stdout" >&2
rm -f -- "$REPORT.stdout"
