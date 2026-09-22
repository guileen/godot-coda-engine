@tool
class_name GSEOS_AssetStore
extends RefCounted

const ASSET_EXTENSION := ".gse.json"

func load_asset(path: String) -> Dictionary:
	if FileAccess.file_exists(ProjectSettings.globalize_path(path + ".bak")) or FileAccess.file_exists(ProjectSettings.globalize_path(path + ".ownership.json.bak")):
		return {"asset": {}, "receipt": _receipt("ASSET_TRANSACTION_RECOVERY_REQUIRED", "检测到未完成的资产/owner 替换；恢复备份前拒绝读取。"), "ownership": {}, "ownership_receipt": _receipt("ASSET_TRANSACTION_RECOVERY_REQUIRED", "检测到未完成的资产/owner 替换。"), "ownership_persisted": true}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {"asset": {}, "receipt": _receipt("ASSET_NOT_FOUND", "无法读取 EventAsset：" + path)}
	var raw := file.get_as_text()
	var parsed = JSON.parse_string(raw.replace("\uFEFF", ""))
	if not parsed is Dictionary:
		return {"asset": {}, "receipt": _receipt("INVALID_JSON", "EventAsset JSON 无效，原文件保持不变。")}
	var asset := GSEOS_EventAsset.new()
	var receipt: Dictionary = asset.from_dictionary(parsed)
	if not receipt.ok:
		return {"asset": asset.data, "receipt": receipt, "raw": raw, "ownership": {}, "ownership_receipt": receipt, "ownership_persisted": false}
	var ownership := load_ownership(path, asset.data)
	if not ownership.receipt.ok:
		return {"asset": {}, "receipt": ownership.receipt, "raw": raw, "ownership": ownership.record, "ownership_receipt": ownership.receipt, "ownership_persisted": ownership.persisted}
	return {"asset": asset.data, "receipt": receipt, "raw": raw, "ownership": ownership.record, "ownership_receipt": ownership.receipt, "ownership_persisted": ownership.persisted}

func load_ownership(path: String, asset: Dictionary) -> Dictionary:
	var ownership_path := path + ".ownership.json"
	if not FileAccess.file_exists(ownership_path):
		return {"record": _make_ownership(path, asset, "graph_owned", 0), "receipt": {"ok": true, "diagnostics": []}, "persisted": false}
	var file := FileAccess.open(ownership_path, FileAccess.READ)
	if file == null:
		return {"record": {}, "receipt": _receipt("AUTHORING_OWNERSHIP_UNREADABLE", "无法读取 AuthoringOwnership sidecar。"), "persisted": true}
	var parsed = JSON.parse_string(file.get_as_text().replace("\uFEFF", ""))
	if not parsed is Dictionary or parsed.get("contract_type") != "AuthoringOwnership" or parsed.get("schema_version") != 1:
		return {"record": {}, "receipt": _receipt("INVALID_AUTHORING_OWNERSHIP", "AuthoringOwnership sidecar 类型或版本无效。"), "persisted": true}
	var source: Variant = parsed.get("source", {})
	var node_identity: Variant = parsed.get("node_identity", {})
	var owner_revision: Variant = parsed.get("owner_revision", null)
	var revision_valid: bool = owner_revision is int or (owner_revision is float and is_finite(owner_revision) and floor(owner_revision) == owner_revision)
	var authoring_mode := String(parsed.get("authoring_mode", ""))
	if authoring_mode not in ["graph_owned", "text_owned"] or not revision_valid or owner_revision < 0 or not parsed.get("derived_projections", null) is Array:
		return {"record": parsed, "receipt": _receipt("INVALID_AUTHORING_OWNERSHIP", "EventAsset owner sidecar revision、mode 或 projections 无效。"), "persisted": true}
	var expected_source_type := "event_asset" if authoring_mode == "graph_owned" else "coda_source"
	if not source is Dictionary or source.get("source_type") != expected_source_type or parsed.get("asset_id", "") != _asset_id(asset):
		return {"record": parsed, "receipt": _receipt("AUTHORING_OWNERSHIP_SOURCE_MISMATCH", "owner sidecar 与当前 EventAsset 不匹配；拒绝写入。"), "persisted": true}
	if authoring_mode == "graph_owned":
		if source.get("source_ref") != path.trim_prefix("res://") or source.get("fingerprint", "") != _fingerprint(asset):
			return {"record": parsed, "receipt": _receipt("AUTHORING_OWNERSHIP_SOURCE_MISMATCH", "owner sidecar 与当前 EventAsset 不匹配；拒绝写入。"), "persisted": true}
	else:
		var source_ref := String(source.get("source_ref", ""))
		if source_ref.is_empty() or source_ref.begins_with("/") or source_ref.split("/").has("..") or source_ref.contains("\\"):
			return {"record": parsed, "receipt": _receipt("INVALID_AUTHORING_SOURCE_REF", "text_owned source_ref 必须是项目内相对路径。"), "persisted": true}
		var owned_source_path := "res://" + source_ref
		if FileAccess.file_exists(ProjectSettings.globalize_path(owned_source_path + ".bak")) or not FileAccess.file_exists(owned_source_path):
			return {"record": parsed, "receipt": _receipt("TEXT_OWNERSHIP_SOURCE_MISSING", "text_owned 源缺失或处于备份中间态；拒绝读取派生资产。"), "persisted": true}
		var owned_source := FileAccess.get_file_as_string(owned_source_path)
		if source.get("fingerprint", "") != _fingerprint(owned_source):
			return {"record": parsed, "receipt": _receipt("AUTHORING_OWNERSHIP_SOURCE_MISMATCH", "owner sidecar 与 CODA 源不匹配；拒绝读取派生资产。"), "persisted": true}
		var projection_found := false
		for projection in parsed.derived_projections:
			if projection is Dictionary and projection.get("artifact_type") == "event_asset" and projection.get("authority") == "derived" and projection.get("writable") == false and projection.get("fingerprint") == _fingerprint(asset): projection_found = true
		if not projection_found:
			return {"record": parsed, "receipt": _receipt("AUTHORING_DERIVED_PROJECTION_MISMATCH", "text_owned EventAsset projection 与 owner sidecar 不匹配。"), "persisted": true}
	if not node_identity is Dictionary or node_identity.get("policy") != "stable_node_id@1" or node_identity.get("mapping_digest", "") != _make_ownership(path, asset, "graph_owned", int(parsed.owner_revision)).node_identity.mapping_digest:
		return {"record": parsed, "receipt": _receipt("AUTHORING_NODE_IDENTITY_MISMATCH", "owner sidecar 中的 stable node identity 与当前 EventAsset 不匹配。"), "persisted": true}
	return {"record": parsed, "receipt": {"ok": true, "diagnostics": []}, "persisted": true}

func save_asset(path: String, asset: Dictionary, expected_asset: Variant = null, expected_owner_revision: int = -1, authoring_mode: String = "graph_owned") -> Dictionary:
	var checker := GSEOS_EventAsset.new()
	var receipt: Dictionary = checker.from_dictionary(asset)
	if not receipt.ok:
		return {"receipt": receipt, "saved": false}
	var absolute_path := ProjectSettings.globalize_path(path)
	var ownership_path := path + ".ownership.json"
	var absolute_ownership_path := ProjectSettings.globalize_path(ownership_path)
	var existed_before := FileAccess.file_exists(absolute_path)
	var create_expected: bool = expected_asset is Dictionary and expected_asset.is_empty() and not existed_before
	var previous_asset: Dictionary = {}
	var previous_ownership: Dictionary = {}
	if expected_asset != null:
		if not create_expected:
			var current_loaded := load_asset(path)
			if not current_loaded.receipt.ok or current_loaded.asset != expected_asset:
				return {"receipt": _receipt("ASSET_SOURCE_CHANGED", "EventAsset 自预览后已变化；本次事务未写入。"), "saved": false}
			if not current_loaded.ownership_receipt.ok:
				return {"receipt": current_loaded.ownership_receipt, "saved": false}
			previous_asset = current_loaded.asset
			previous_ownership = current_loaded.ownership
		elif FileAccess.file_exists(absolute_ownership_path):
			return {"receipt": _receipt("ORPHAN_AUTHORING_OWNERSHIP", "新资产路径已存在 owner sidecar；拒绝覆盖。"), "saved": false}
	else:
		if existed_before:
			var current_loaded := load_asset(path)
			if not current_loaded.receipt.ok or not current_loaded.ownership_receipt.ok:
				return {"receipt": current_loaded.ownership_receipt if not current_loaded.ownership_receipt.ok else current_loaded.receipt, "saved": false}
			previous_asset = current_loaded.asset
			previous_ownership = current_loaded.ownership
		elif FileAccess.file_exists(absolute_ownership_path):
			return {"receipt": _receipt("ORPHAN_AUTHORING_OWNERSHIP", "资产缺失但 owner sidecar 存在；拒绝覆盖。"), "saved": false}
	if expected_owner_revision >= 0 and int(previous_ownership.get("owner_revision", -1)) != expected_owner_revision:
		return {"receipt": _receipt("AUTHORING_OWNER_REVISION_CHANGED", "owner revision 与预览时不同；本次事务未写入。"), "saved": false}
	if authoring_mode != "graph_owned" or String(previous_ownership.get("authoring_mode", "graph_owned")) != "graph_owned":
		return {"receipt": _receipt("AUTHORING_MODE_SOURCE_MISMATCH", "EventAsset store 只允许 graph_owned；text_owned 必须写入 CODA 源事务。"), "saved": false}
	var owner_mode := String(previous_ownership.get("authoring_mode", authoring_mode))
	var next_revision := int(previous_ownership.get("owner_revision", -1)) + 1
	var owner := _make_ownership(path, checker.data, owner_mode, next_revision)
	var temp_path := path + ".tmp"
	var owner_temp_path := ownership_path + ".tmp"
	var asset_file := FileAccess.open(temp_path, FileAccess.WRITE)
	if asset_file == null:
		return {"receipt": _receipt("ASSET_WRITE_FAILED", "无法写入临时 EventAsset。"), "saved": false}
	asset_file.store_string(JSON.stringify(checker.data, "  ") + "\n")
	asset_file.close()
	var owner_file := FileAccess.open(owner_temp_path, FileAccess.WRITE)
	if owner_file == null:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(temp_path))
		return {"receipt": _receipt("AUTHORING_OWNERSHIP_WRITE_FAILED", "无法暂存 AuthoringOwnership sidecar。"), "saved": false}
	owner_file.store_string(JSON.stringify(owner, "  ") + "\n")
	owner_file.close()
	var absolute_temp_path := ProjectSettings.globalize_path(temp_path)
	var absolute_owner_temp_path := ProjectSettings.globalize_path(owner_temp_path)
	var backup_path := absolute_path + ".bak"
	var owner_backup_path := absolute_ownership_path + ".bak"
	if FileAccess.file_exists(backup_path) or FileAccess.file_exists(owner_backup_path):
		DirAccess.remove_absolute(absolute_temp_path)
		DirAccess.remove_absolute(absolute_owner_temp_path)
		return {"receipt": _receipt("ASSET_BACKUP_EXISTS", "检测到未完成的 EventAsset/ownership 替换；请先恢复或移走 .bak。"), "saved": false}
	if expected_asset != null and create_expected:
		if FileAccess.file_exists(absolute_path) or FileAccess.file_exists(absolute_ownership_path):
			DirAccess.remove_absolute(absolute_temp_path)
			DirAccess.remove_absolute(absolute_owner_temp_path)
			return {"receipt": _receipt("ASSET_SOURCE_CHANGED", "新 EventAsset 路径已被占用；本次事务未写入。"), "saved": false}
	elif expected_asset != null:
		var latest := load_asset(path)
		if not latest.receipt.ok or latest.asset != expected_asset or not latest.ownership_receipt.ok or int(latest.ownership.get("owner_revision", -1)) != int(previous_ownership.get("owner_revision", -1)):
			DirAccess.remove_absolute(absolute_temp_path)
			DirAccess.remove_absolute(absolute_owner_temp_path)
			return {"receipt": _receipt("ASSET_SOURCE_CHANGED", "EventAsset 或 owner revision 在事务准备期间已变化；本次事务未写入。"), "saved": false}
	if existed_before:
		var latest_state := load_asset(path)
		if not latest_state.receipt.ok or not latest_state.ownership_receipt.ok or latest_state.asset != previous_asset or int(latest_state.ownership.get("owner_revision", -1)) != int(previous_ownership.get("owner_revision", -1)):
			DirAccess.remove_absolute(absolute_temp_path)
			DirAccess.remove_absolute(absolute_owner_temp_path)
			return {"receipt": _receipt("AUTHORING_SOURCE_CHANGED", "EventAsset 或 owner revision 已变化；本次事务未写入。"), "saved": false}
	var had_owner := FileAccess.file_exists(absolute_ownership_path)
	if existed_before and DirAccess.rename_absolute(absolute_path, backup_path) != OK:
		DirAccess.remove_absolute(absolute_temp_path)
		DirAccess.remove_absolute(absolute_owner_temp_path)
		return {"receipt": _receipt("ASSET_BACKUP_FAILED", "无法保护原始 EventAsset，未执行替换。"), "saved": false}
	if had_owner and DirAccess.rename_absolute(absolute_ownership_path, owner_backup_path) != OK:
		if existed_before:
			DirAccess.rename_absolute(backup_path, absolute_path)
		DirAccess.remove_absolute(absolute_temp_path)
		DirAccess.remove_absolute(absolute_owner_temp_path)
		return {"receipt": _receipt("AUTHORING_OWNERSHIP_BACKUP_FAILED", "无法保护原 owner sidecar，资产已恢复。"), "saved": false}
	if DirAccess.rename_absolute(absolute_temp_path, absolute_path) != OK or DirAccess.rename_absolute(absolute_owner_temp_path, absolute_ownership_path) != OK:
		if FileAccess.file_exists(absolute_path): DirAccess.remove_absolute(absolute_path)
		if FileAccess.file_exists(absolute_ownership_path): DirAccess.remove_absolute(absolute_ownership_path)
		if existed_before and FileAccess.file_exists(backup_path): DirAccess.rename_absolute(backup_path, absolute_path)
		if had_owner and FileAccess.file_exists(owner_backup_path): DirAccess.rename_absolute(owner_backup_path, absolute_ownership_path)
		DirAccess.remove_absolute(absolute_temp_path)
		DirAccess.remove_absolute(absolute_owner_temp_path)
		return {"receipt": _receipt("ASSET_RENAME_FAILED", "无法完成 EventAsset/ownership 替换；已尝试恢复原版本。"), "saved": false}
	var cleanup_ok := true
	if existed_before and DirAccess.remove_absolute(backup_path) != OK: cleanup_ok = false
	if had_owner and DirAccess.remove_absolute(owner_backup_path) != OK: cleanup_ok = false
	if not cleanup_ok:
		return {"receipt": receipt, "saved": true, "ownership": owner, "asset": checker.data, "cleanup_pending": true}
	return {"receipt": receipt, "saved": true, "ownership": owner, "asset": checker.data}

func save_text_owned_asset(asset_path: String, source_path: String, source_text: String, asset: Dictionary, expected_owner_revision: int, expected_source_fingerprint: String) -> Dictionary:
	if asset_path == source_path or asset_path + ".ownership.json" == source_path:
		return {"receipt": _receipt("AUTHORING_SOURCE_PATH_COLLISION", "派生资产、CODA 源与 ownership sidecar 必须使用不同路径。"), "saved": false}
	var source_ref := source_path.trim_prefix("res://")
	if not source_path.begins_with("res://") or source_ref.is_empty() or source_ref.begins_with("/") or source_ref.split("/").has("..") or source_ref.contains("\\"):
		return {"receipt": _receipt("INVALID_AUTHORING_SOURCE_REF", "text_owned 源必须位于项目内并使用相对路径。"), "saved": false}
	var checker := GSEOS_EventAsset.new()
	var receipt: Dictionary = checker.from_dictionary(asset)
	if not receipt.ok: return {"receipt": receipt, "saved": false}
	if source_text.is_empty(): return {"receipt": _receipt("TEXT_AUTHORING_SOURCE_EMPTY", "text_owned 源不能为空。"), "saved": false}
	var source_temp := source_path + ".validate.tmp"
	var source_file := FileAccess.open(source_temp, FileAccess.WRITE)
	if source_file == null: return {"receipt": _receipt("TEXT_AUTHORING_SOURCE_WRITE_FAILED", "无法暂存 text_owned 源进行 parse-check。"), "saved": false}
	source_file.store_string(source_text)
	source_file.close()
	var parse_output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var parse_exit := OS.execute("node", [cli, "parse", ProjectSettings.globalize_path(source_temp)], parse_output, true)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(source_temp))
	var parsed = JSON.parse_string("\n".join(parse_output))
	if parse_exit != 0 or not parsed is Dictionary or not parsed.get("receipt", {}).get("ok", false) or not parsed.get("asset") is Dictionary:
		return {"receipt": _receipt("TEXT_AUTHORING_SOURCE_INVALID", "text_owned 源未通过 GSE parse；本次事务未写入。"), "saved": false}
	var parsed_checker := GSEOS_EventAsset.new()
	var parsed_asset_receipt: Dictionary = parsed_checker.from_dictionary(parsed.asset)
	if not parsed_asset_receipt.ok or _fingerprint(parsed_checker.data) != _fingerprint(checker.data):
		return {"receipt": _receipt("TEXT_AUTHORING_PROJECTION_MISMATCH", "候选 EventAsset 与 text_owned 源解析结果不一致。"), "saved": false}
	var owner_path := asset_path + ".ownership.json"
	var previous_owner: Dictionary = {}
	if FileAccess.file_exists(ProjectSettings.globalize_path(asset_path)):
		var current := load_asset(asset_path)
		if not current.receipt.ok or not current.ownership_receipt.ok:
			return {"receipt": current.receipt if not current.receipt.ok else current.ownership_receipt, "saved": false}
		previous_owner = current.ownership
		if int(previous_owner.get("owner_revision", -1)) != expected_owner_revision or String(previous_owner.get("source", {}).get("fingerprint", "")) != expected_source_fingerprint:
			return {"receipt": _receipt("AUTHORING_SOURCE_CHANGED", "owner revision 或 source fingerprint 已变化；本次事务未写入。"), "saved": false}
	else:
		if expected_owner_revision != -1 or not expected_source_fingerprint.is_empty() or FileAccess.file_exists(ProjectSettings.globalize_path(owner_path)):
			return {"receipt": _receipt("AUTHORING_SOURCE_CHANGED", "预期的 authoring source 不存在或 owner sidecar 孤立；拒绝创建。"), "saved": false}
	if not previous_owner.is_empty() and previous_owner.get("authoring_mode", "graph_owned") == "graph_owned" and FileAccess.file_exists(ProjectSettings.globalize_path(source_path)):
		return {"receipt": _receipt("AUTHORING_MIGRATION_TARGET_EXISTS", "迁移目标 CODA 源已存在；为避免覆盖，显式迁移已拒绝。"), "saved": false}
	if previous_owner.get("authoring_mode", "graph_owned") == "text_owned" and String(previous_owner.get("source", {}).get("source_ref", "")) != source_path.trim_prefix("res://"):
		return {"receipt": _receipt("AUTHORING_SOURCE_PATH_CHANGED", "text_owned 编辑不得隐式迁移 source_ref。"), "saved": false}
	var next_revision := int(previous_owner.get("owner_revision", -1)) + 1
	var ids: Array[String] = []
	_collect_node_ids(checker.data.get("root", []), ids)
	ids.sort()
	var owner := {
		"contract_type": "AuthoringOwnership", "schema_version": 1,
		"asset_id": _asset_id(checker.data), "authoring_mode": "text_owned", "owner_revision": next_revision,
		"source": {"source_type": "coda_source", "source_ref": source_path.trim_prefix("res://"), "fingerprint": _fingerprint(source_text)},
		"node_identity": {"policy": "stable_node_id@1", "mapping_digest": _fingerprint({"node_ids": ids})},
		"derived_projections": [{"artifact_type": "event_asset", "fingerprint": _fingerprint(checker.data), "authority": "derived", "writable": false}]
	}
	var writes := _commit_file_set(
		[asset_path, source_path, owner_path],
		[JSON.stringify(checker.data, "  ") + "\n", source_text, JSON.stringify(owner, "  ") + "\n"],
	)
	if not writes.ok: return {"receipt": writes.receipt, "saved": false}
	return {"receipt": receipt, "saved": true, "ownership": owner, "asset": checker.data, "cleanup_pending": writes.cleanup_pending}

func _commit_file_set(paths: Array[String], contents: Array[String]) -> Dictionary:
	var targets: Array[String] = []
	var temporaries: Array[String] = []
	var backups: Array[String] = []
	var existed: Array[bool] = []
	for index in paths.size():
		var absolute_target := ProjectSettings.globalize_path(paths[index])
		var absolute_temp := ProjectSettings.globalize_path(paths[index] + ".tmp")
		var absolute_backup := absolute_target + ".bak"
		if FileAccess.file_exists(absolute_backup):
			for temp in temporaries: DirAccess.remove_absolute(temp)
			return {"ok": false, "receipt": _receipt("ASSET_TRANSACTION_RECOVERY_REQUIRED", "检测到待恢复备份；三文件事务未启动。")}
		var file := FileAccess.open(paths[index] + ".tmp", FileAccess.WRITE)
		if file == null:
			for temp in temporaries: DirAccess.remove_absolute(temp)
			return {"ok": false, "receipt": _receipt("AUTHORING_STAGE_WRITE_FAILED", "无法暂存 text_owned 三文件事务。")}
		file.store_string(contents[index])
		file.close()
		targets.append(absolute_target)
		temporaries.append(absolute_temp)
		backups.append(absolute_backup)
		existed.append(FileAccess.file_exists(absolute_target))
	for index in targets.size():
		if existed[index] and DirAccess.rename_absolute(targets[index], backups[index]) != OK:
			for restore_index in range(index - 1, -1, -1):
				if existed[restore_index]: DirAccess.rename_absolute(backups[restore_index], targets[restore_index])
			for temp in temporaries: DirAccess.remove_absolute(temp)
			return {"ok": false, "receipt": _receipt("AUTHORING_BACKUP_FAILED", "无法备份三文件事务的旧版本；已尝试恢复。")}
	for index in targets.size():
		if DirAccess.rename_absolute(temporaries[index], targets[index]) != OK:
			for rollback_index in targets.size():
				if FileAccess.file_exists(targets[rollback_index]): DirAccess.remove_absolute(targets[rollback_index])
				if existed[rollback_index] and FileAccess.file_exists(backups[rollback_index]): DirAccess.rename_absolute(backups[rollback_index], targets[rollback_index])
			for temp in temporaries: DirAccess.remove_absolute(temp)
			return {"ok": false, "receipt": _receipt("AUTHORING_RENAME_FAILED", "无法提交完整的 text_owned 事务；已尝试恢复旧版本。")}
	var cleanup_pending := false
	for index in backups.size():
		if existed[index] and DirAccess.remove_absolute(backups[index]) != OK: cleanup_pending = true
	return {"ok": true, "cleanup_pending": cleanup_pending, "receipt": {"ok": true, "diagnostics": []}}

func _make_ownership(path: String, asset: Dictionary, mode: String, revision: int) -> Dictionary:
	var ids: Array[String] = []
	_collect_node_ids(asset.get("root", []), ids)
	ids.sort()
	return {
		"contract_type": "AuthoringOwnership", "schema_version": 1,
		"asset_id": _asset_id(asset), "authoring_mode": mode, "owner_revision": revision,
		"source": {"source_type": "coda_source" if mode == "text_owned" else "event_asset", "source_ref": path.trim_prefix("res://"), "fingerprint": _fingerprint(asset)},
		"node_identity": {"policy": "stable_node_id@1", "mapping_digest": _fingerprint({"node_ids": ids})},
		"derived_projections": []
	}

func _asset_id(asset: Dictionary) -> String:
	return "%s@%d" % [asset.get("event_id", "invalid"), asset.get("schema_version", 1)]

func _collect_node_ids(nodes: Array, ids: Array[String]) -> void:
	for node in nodes:
		if not node is Dictionary: continue
		if node.get("node_id", null) is String: ids.append(node.node_id)
		for children in node.get("children", {}).values():
			if children is Array: _collect_node_ids(children, ids)

func _fingerprint(value: Variant) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(_stable_json(value).to_utf8_buffer())
	return "sha256:" + context.finish().hex_encode()

func _stable_json(value: Variant) -> String:
	if value is Dictionary:
		var keys: Array = value.keys()
		keys.sort()
		var fields: Array[String] = []
		for key in keys: fields.append(JSON.stringify(String(key)) + ":" + _stable_json(value[key]))
		return "{" + ",".join(fields) + "}"
	if value is Array:
		var items: Array[String] = []
		for item in value: items.append(_stable_json(item))
		return "[" + ",".join(items) + "]"
	if value is float and is_finite(value) and value == floor(value): return str(int(value))
	return JSON.stringify(value)

func _receipt(code: String, message: String) -> Dictionary:
	return {"ok": false, "diagnostics": [{"code": code, "severity": "error", "message": message, "path": "/"}]}
