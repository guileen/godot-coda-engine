#!/bin/bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")" && pwd)"
exec "$repo_root/scripts/coda-open-godot-project.sh" runtime "$repo_root"
