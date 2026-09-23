#!/bin/bash
set -euo pipefail

mode="${1:-}"
project_path="${2:-}"

if [[ -z "$project_path" || ! -f "$project_path/project.godot" ]]; then
  echo "找不到 CODA 体验所需的项目文件。"
  exit 2
fi

godot_app="/Applications/Godot.app"
if [[ ! -d "$godot_app" ]]; then
  osascript -e 'display dialog "体验 CODA 需要安装 Godot 4.7 或更新版本。安装后再双击这个入口即可。" buttons {"好"} default button "好" with title "CODA 体验"'
  exit 1
fi

godot_binary="$godot_app/Contents/MacOS/Godot"
if [[ ! -x "$godot_binary" ]]; then
  echo "已找到 Godot 应用，但缺少启动程序：$godot_binary"
  exit 2
fi

if [[ "$mode" == "editor" ]]; then
  godot_args=(--editor --path "$project_path")
else
  godot_args=(--path "$project_path")
fi

# Finder's Launch Services is preferred. Some restricted environments do not
# expose it, so fall back to launching the Godot executable directly.
if open -a "$godot_app" --args "${godot_args[@]}" >/dev/null 2>&1; then
  exit 0
fi

log_path="${TMPDIR:-/tmp}/coda-godot-launch.log"
nohup "$godot_binary" "${godot_args[@]}" </dev/null >"$log_path" 2>&1 &
echo "Godot 正在启动。若没有看到窗口，请联系观察者检查启动状态。"
