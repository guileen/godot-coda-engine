@tool
class_name GSEOS_TextTransaction
extends RefCounted

var original_asset: Dictionary
var draft_text := ""
var parsed_asset: Dictionary = {}

func begin(asset: Dictionary, text: String) -> void:
	original_asset = asset.duplicate(true)
	draft_text = text
	parsed_asset = {}

func preview(candidate_asset: Dictionary, diagnostics: Array = []) -> Dictionary:
	parsed_asset = candidate_asset.duplicate(true)
	var before_lines := JSON.stringify(original_asset, "  ").split("\n")
	var after_lines := JSON.stringify(parsed_asset, "  ").split("\n")
	var diff: Array[String] = []
	var limit: int = maxi(before_lines.size(), after_lines.size())
	for index in limit:
		var before := before_lines[index] if index < before_lines.size() else ""
		var after := after_lines[index] if index < after_lines.size() else ""
		if before != after:
			diff.append("- %s" % before)
			diff.append("+ %s" % after)
	return {"changed": JSON.stringify(original_asset) != JSON.stringify(parsed_asset), "asset": parsed_asset, "diagnostics": diagnostics, "diff": diff}

func commit() -> Dictionary:
	if parsed_asset.is_empty():
		return {"ok": false, "diagnostics": [{"code": "TEXT_NOT_PARSED", "message": "文本尚未通过 parse/bind/check transaction。", "path": "/"}]}
	original_asset = parsed_asset.duplicate(true)
	return {"ok": true, "asset": original_asset}

func cancel() -> Dictionary:
	parsed_asset = {}
	draft_text = ""
	return {"ok": true, "asset": original_asset.duplicate(true)}
