@tool
class_name CODA_CapabilityManifest
extends RefCounted

var capabilities: Dictionary = {}
var topics: Dictionary = {}

func load_from_file(path := "res://contracts/coda/capabilities.json") -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return _error("MANIFEST_NOT_FOUND", "无法读取 capability manifest。")
	var parsed = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary or parsed.get("schema_version") != 1:
		return _error("UNSUPPORTED_MANIFEST_VERSION", "只支持 capability manifest @1。")
	capabilities.clear()
	for item in parsed.get("capabilities", []):
		capabilities["%s@%d" % [item.id, item.version]] = item
	topics.clear()
	for item in parsed.get("topics", []):
		topics["%s@%d" % [item.id, item.version]] = item
	return {"ok": true, "diagnostics": []}

func get_capability(target: String) -> Dictionary:
	return capabilities.get(target, {})

func _error(code: String, message: String) -> Dictionary:
	return {"ok": false, "diagnostics": [{"code": code, "severity": "error", "message": message, "path": "/"}]}
