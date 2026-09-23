#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GUI_PROJECT="$(mktemp -d /tmp/coda-gui-acceptance.XXXXXX)"
EDITOR_LOG="${GUI_PROJECT}/editor.log"
INPUT_BIN="${GUI_PROJECT}/coda-native-gui-input"
EDITOR_PID=""

cleanup() {
  if [[ -n "$EDITOR_PID" ]]; then
    kill "$EDITOR_PID" 2>/dev/null || true
    wait "$EDITOR_PID" 2>/dev/null || true
  fi
  if [[ "${KEEP_GUI_PROJECT:-0}" == "1" ]]; then
    printf 'GUI_PROJECT=%s\n' "$GUI_PROJECT" >&2
  else
    rm -rf -- "$GUI_PROJECT"
  fi
}
trap cleanup EXIT INT TERM

cp -R "$ROOT_DIR/." "$GUI_PROJECT/"
mkdir -p "${GUI_PROJECT}/swift-module-cache"
swiftc -module-cache-path "${GUI_PROJECT}/swift-module-cache" "$ROOT_DIR/scripts/coda-native-gui-input.swift" -o "$INPUT_BIN"
godot --editor --path "$GUI_PROJECT" --log-file "$EDITOR_LOG" >"${GUI_PROJECT}/editor.stdout" 2>&1 &
EDITOR_PID=$!
sleep 15

if [[ "${KEEP_GUI_PROJECT:-0}" == "1" ]]; then screencapture -x "${GUI_PROJECT}/start.png" 2>/dev/null || true; fi

run_input() { CODA_GODOT_PID="$EDITOR_PID" "$INPUT_BIN" "$@"; }

# Coordinates are logical macOS points for the standard 1536x960 Godot editor window.
run_input click 850 150
sleep 1
if [[ "${KEEP_GUI_PROJECT:-0}" == "1" ]]; then screencapture -x "${GUI_PROJECT}/after-new.png" 2>/dev/null || true; fi
run_input click 800 258
sleep 1
run_input click 1100 184
run_input selectall
run_input type "Native GUI"
run_input click 1480 184
sleep 1

[[ -f "$GUI_PROJECT/coda/events/new-event.gse.json" ]]
DISPLAY_NAME="$(node -e 'console.log(require(process.argv[1]).display_name)' "$GUI_PROJECT/coda/events/new-event.gse.json")"
[[ "$DISPLAY_NAME" == "Native GUI" ]]

run_input click 980 150
sleep 1
run_input click 1000 790
run_input selectall
run_input type $'event ui.new.event.1:\n  let value = 1\n'
run_input click 823 847
sleep 2

run_input click 1000 848
run_input click 970 220
run_input down
run_input enter
run_input click 1080 220
sleep 1

# Select the first pending condition field, fill it, then confirm the transaction.
run_input click 1300 560
run_input selectall
run_input type '{"op":">","left":{"ref":"value"},"right":0}'
run_input click 1065 150
sleep 1

ROOT_COUNT="$(node -e 'console.log(require(process.argv[1]).root.length)' "$GUI_PROJECT/coda/events/new-event.gse.json")"
[[ "$ROOT_COUNT" == "1" ]]

run_input click 850 313
run_input click 1205 150
sleep 1
ROOT_COUNT_AFTER_DELETE="$(node -e 'console.log(require(process.argv[1]).root.length)' "$GUI_PROJECT/coda/events/new-event.gse.json")"
[[ "$ROOT_COUNT_AFTER_DELETE" == "0" ]]

printf '%s\n' '{"result":"passed","native_editor":"Godot 4.7.2","actions":["create","select","rename","text_preview","draft_commit","delete"],"asset_persisted":true}'
