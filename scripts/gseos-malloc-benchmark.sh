#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/coda-malloc-benchmark.sh" "$@"
