@tool
class_name CODA_EventAsset
extends RefCounted

const SCHEMA_VERSION := 1

var data: Dictionary = {}

func from_dictionary(source: Dictionary) -> Dictionary:
	data = source.duplicate(true)
	data["asset_type"] = data.get("asset_type", "EventAsset")
	data["schema_version"] = data.get("schema_version", SCHEMA_VERSION)
	data["args"] = data.get("args", [])
	data["root"] = _normalize_nodes(data.get("root", []), String(data.get("event_id", "event")))
	return validate()

func validate() -> Dictionary:
	var diagnostics: Array[Dictionary] = []
	if data.get("asset_type") != "EventAsset":
		diagnostics.append(_diagnostic("INVALID_ASSET_TYPE", "asset_type 必须为 EventAsset。", "/asset_type"))
	if int(data.get("schema_version", -1)) != SCHEMA_VERSION:
		diagnostics.append(_diagnostic("UNSUPPORTED_ASSET_VERSION", "首发只支持 EventAsset@1。", "/schema_version"))
	var event_id_pattern := RegEx.new()
	event_id_pattern.compile("^[a-z][a-z0-9]*(?:\\.[a-z0-9]+)*$")
	if event_id_pattern.search(String(data.get("event_id", ""))) == null:
		diagnostics.append(_diagnostic("INVALID_EVENT_ID", "event_id 必须是稳定的小写 ID。", "/event_id"))
	if not data.get("root") is Array:
		diagnostics.append(_diagnostic("INVALID_ROOT", "root 必须是数组。", "/root"))
	else:
		var seen := {}
		_validate_nodes(data.root, "/root", seen, diagnostics)
	return {"ok": diagnostics.is_empty(), "diagnostics": diagnostics}

func _normalize_nodes(nodes: Array, prefix: String) -> Array:
	var result: Array = []
	for index in nodes.size():
		var node: Dictionary = nodes[index].duplicate(true)
		node["node_id"] = node.get("node_id", "%s.%d" % [prefix, index + 1])
		var children: Dictionary = node.get("children", {})
		for slot in children.keys():
			children[slot] = _normalize_nodes(children[slot], "%s.%s" % [node.node_id, slot])
		node["children"] = children
		result.append(node)
	return result

func _validate_nodes(nodes: Array, path: String, seen: Dictionary, diagnostics: Array[Dictionary]) -> void:
	for index in nodes.size():
		var node: Dictionary = nodes[index]
		var node_path := "%s/%d" % [path, index]
		var node_id := String(node.get("node_id", ""))
		if node_id.is_empty():
			diagnostics.append(_diagnostic("INVALID_NODE_ID", "node_id 不能为空。", node_path + "/node_id"))
		elif seen.has(node_id):
			diagnostics.append(_diagnostic("DUPLICATE_NODE_ID", "节点 ID 重复。", node_path + "/node_id"))
		seen[node_id] = true
		if String(node.get("command_id", "")).is_empty():
			diagnostics.append(_diagnostic("INVALID_COMMAND_ID", "command_id 不能为空。", node_path + "/command_id"))
		for slot in node.get("children", {}).keys():
			_validate_nodes(node.children[slot], node_path + "/children/" + slot, seen, diagnostics)

func _diagnostic(code: String, message: String, path: String) -> Dictionary:
	return {"code": code, "severity": "error", "message": message, "path": path}
