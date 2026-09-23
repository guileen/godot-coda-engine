@tool
class_name GSEOS_AssetStore
extends RefCounted

const ASSET_EXTENSION := ".gse.json"

func load_asset(path: String) -> Dictionary:
	if _transaction_artifacts_exist(path) or FileAccess.file_exists(ProjectSettings.globalize_path(path + ".bak")) or FileAccess.file_exists(ProjectSettings.globalize_path(path + ".ownership.json.bak")):
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
		if source_ref.is_empty() or source_ref.begins_with("/") or source_ref.split("/").has("..") or source_ref.contains("\\") or source_ref != path.trim_prefix("res://").trim_suffix(ASSET_EXTENSION) + ".coda":
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
	if _transaction_artifacts_exist(path) or FileAccess.file_exists(ProjectSettings.globalize_path(path + ".bak")) or FileAccess.file_exists(ProjectSettings.globalize_path(ownership_path + ".bak")):
		return {"receipt": _receipt("ASSET_TRANSACTION_RECOVERY_REQUIRED", "检测到待恢复事务；请先在 Event Dock 执行恢复。"), "saved": false}
	if expected_asset != null and create_expected:
		if FileAccess.file_exists(absolute_path) or FileAccess.file_exists(absolute_ownership_path):
			return {"receipt": _receipt("ASSET_SOURCE_CHANGED", "新 EventAsset 路径已被占用；本次事务未写入。"), "saved": false}
	elif expected_asset != null:
		var latest := load_asset(path)
		if not latest.receipt.ok or latest.asset != expected_asset or not latest.ownership_receipt.ok or int(latest.ownership.get("owner_revision", -1)) != int(previous_ownership.get("owner_revision", -1)):
			return {"receipt": _receipt("ASSET_SOURCE_CHANGED", "EventAsset 或 owner revision 在事务准备期间已变化；本次事务未写入。"), "saved": false}
	if existed_before:
		var latest_state := load_asset(path)
		if not latest_state.receipt.ok or not latest_state.ownership_receipt.ok or latest_state.asset != previous_asset or int(latest_state.ownership.get("owner_revision", -1)) != int(previous_ownership.get("owner_revision", -1)):
			return {"receipt": _receipt("AUTHORING_SOURCE_CHANGED", "EventAsset 或 owner revision 已变化；本次事务未写入。"), "saved": false}
	var writes := _commit_file_set(
		[path, ownership_path],
		[JSON.stringify(checker.data, "  ") + "\n", JSON.stringify(owner, "  ") + "\n"],
	)
	if not writes.ok: return {"receipt": writes.receipt, "saved": false}
	return {"receipt": receipt, "saved": true, "ownership": owner, "asset": checker.data, "cleanup_pending": writes.cleanup_pending}

func save_text_owned_asset(asset_path: String, source_path: String, source_text: String, asset: Dictionary, expected_owner_revision: int, expected_source_fingerprint: String) -> Dictionary:
	if asset_path == source_path or asset_path + ".ownership.json" == source_path:
		return {"receipt": _receipt("AUTHORING_SOURCE_PATH_COLLISION", "派生资产、CODA 源与 ownership sidecar 必须使用不同路径。"), "saved": false}
	var source_ref := source_path.trim_prefix("res://")
	if not source_path.begins_with("res://") or source_ref.is_empty() or source_ref.begins_with("/") or source_ref.split("/").has("..") or source_ref.contains("\\"):
		return {"receipt": _receipt("INVALID_AUTHORING_SOURCE_REF", "text_owned 源必须位于项目内并使用相对路径。"), "saved": false}
	if not asset_path.ends_with(ASSET_EXTENSION) or source_path != asset_path.trim_suffix(ASSET_EXTENSION) + ".coda":
		return {"receipt": _receipt("INVALID_AUTHORING_SOURCE_REF", "text_owned 源必须是派生 EventAsset 同路径的 canonical .coda 源。"), "saved": false}
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
	if paths.size() < 2 or paths.size() > 3 or paths.size() != contents.size():
		return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "文件事务路径与内容数量无效。")}
	var transaction_path := paths[0] + ".transaction.json"
	var committed_path := paths[0] + ".transaction.commit.json"
	if _transaction_artifacts_exist(paths[0]):
		return {"ok": false, "receipt": _receipt("ASSET_TRANSACTION_RECOVERY_REQUIRED", "检测到待恢复事务；请先在 Event Dock 执行恢复。")}
	var files: Array[Dictionary] = []
	for index in paths.size():
		if not paths[index].begins_with("res://") or paths[index].trim_prefix("res://").split("/").has("..") or paths.count(paths[index]) > 1:
			return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "文件事务仅支持项目内、无重复的规范路径。")}
		var absolute_target := ProjectSettings.globalize_path(paths[index])
		var absolute_temp := ProjectSettings.globalize_path(paths[index] + ".tmp")
		var absolute_backup := absolute_target + ".bak"
		if FileAccess.file_exists(absolute_backup):
			for staged in files: DirAccess.remove_absolute(ProjectSettings.globalize_path(String(staged.path) + ".tmp"))
			return {"ok": false, "receipt": _receipt("ASSET_TRANSACTION_RECOVERY_REQUIRED", "检测到待恢复暂存或备份；事务未启动。")}
		var file := FileAccess.open(paths[index] + ".tmp", FileAccess.WRITE)
		if file == null:
			for staged in files: DirAccess.remove_absolute(ProjectSettings.globalize_path(String(staged.path) + ".tmp"))
			return {"ok": false, "receipt": _receipt("AUTHORING_STAGE_WRITE_FAILED", "无法暂存 authoring 文件事务。")}
		file.store_string(contents[index])
		file.close()
		var existed := FileAccess.file_exists(absolute_target)
		files.append({
			"path": paths[index], "existed": existed,
			"before_fingerprint": _fingerprint(FileAccess.get_file_as_string(paths[index])) if existed else "",
			"after_fingerprint": _fingerprint(contents[index]),
		})
	var manifest := {"contract_type": "AuthoringFileSetTransaction", "schema_version": 1, "state": "prepared", "files": files}
	var manifest_text := JSON.stringify(manifest, "  ") + "\n"
	var journal_temp_path := transaction_path + ".tmp"
	var journal_file := FileAccess.open(journal_temp_path, FileAccess.WRITE)
	if journal_file == null:
		for entry in files: DirAccess.remove_absolute(ProjectSettings.globalize_path(String(entry.path) + ".tmp"))
		return {"ok": false, "receipt": _receipt("AUTHORING_JOURNAL_WRITE_FAILED", "无法写入事务恢复日志；尚未替换任何源文件。")}
	journal_file.store_string(manifest_text)
	journal_file.close()
	if DirAccess.rename_absolute(ProjectSettings.globalize_path(journal_temp_path), ProjectSettings.globalize_path(transaction_path)) != OK:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(journal_temp_path))
		for entry in files: DirAccess.remove_absolute(ProjectSettings.globalize_path(String(entry.path) + ".tmp"))
		return {"ok": false, "receipt": _receipt("AUTHORING_JOURNAL_WRITE_FAILED", "无法安装事务恢复日志；尚未替换任何源文件。")}
	_test_crash_at("journal_installed")
	for entry in files:
		if not entry.existed: continue
		var target := ProjectSettings.globalize_path(String(entry.path))
		if DirAccess.rename_absolute(target, target + ".bak") != OK:
			var rolled_back := recover_transaction(paths[0])
			return {"ok": false, "receipt": rolled_back.receipt if not rolled_back.ok else _receipt("AUTHORING_BACKUP_FAILED", "无法备份文件事务；已恢复旧版本。")}
	for index in files.size():
		var entry: Dictionary = files[index]
		var target := ProjectSettings.globalize_path(String(entry.path))
		var temporary := target + ".tmp"
		if DirAccess.rename_absolute(temporary, target) != OK:
			var rolled_back := recover_transaction(paths[0])
			return {"ok": false, "receipt": rolled_back.receipt if not rolled_back.ok else _receipt("AUTHORING_RENAME_FAILED", "无法提交完整的文件事务；已恢复旧版本。")}
		if index == 0: _test_crash_at("first_target_installed")
	var commit_temp := committed_path + ".tmp"
	var commit_file := FileAccess.open(commit_temp, FileAccess.WRITE)
	if commit_file == null:
		var rolled_back := recover_transaction(paths[0])
		return {"ok": false, "receipt": rolled_back.receipt if not rolled_back.ok else _receipt("AUTHORING_COMMIT_MARKER_FAILED", "无法标记事务完成；已恢复旧版本。")}
	var committed_manifest := manifest.duplicate(true)
	committed_manifest.state = "committed"
	commit_file.store_string(JSON.stringify(committed_manifest, "  ") + "\n")
	commit_file.close()
	if DirAccess.rename_absolute(ProjectSettings.globalize_path(commit_temp), ProjectSettings.globalize_path(committed_path)) != OK:
		var rolled_back := recover_transaction(paths[0])
		return {"ok": false, "receipt": rolled_back.receipt if not rolled_back.ok else _receipt("AUTHORING_COMMIT_MARKER_FAILED", "无法标记事务完成；已恢复旧版本。")}
	_test_crash_at("commit_marker_installed")
	var cleanup_pending := false
	for entry in files:
		var target := ProjectSettings.globalize_path(String(entry.path))
		if FileAccess.file_exists(target + ".bak") and DirAccess.remove_absolute(target + ".bak") != OK: cleanup_pending = true
		if FileAccess.file_exists(target + ".tmp") and DirAccess.remove_absolute(target + ".tmp") != OK: cleanup_pending = true
	if not cleanup_pending:
		var journal_absolute := ProjectSettings.globalize_path(transaction_path)
		if FileAccess.file_exists(journal_absolute) and DirAccess.remove_absolute(journal_absolute) != OK:
			cleanup_pending = true
		else:
			var committed_absolute := ProjectSettings.globalize_path(committed_path)
			if FileAccess.file_exists(committed_absolute) and DirAccess.remove_absolute(committed_absolute) != OK: cleanup_pending = true
	return {"ok": true, "cleanup_pending": cleanup_pending, "receipt": {"ok": true, "diagnostics": []}}

func recover_transaction(asset_path: String) -> Dictionary:
	var transaction_path := asset_path + ".transaction.json"
	var committed_path := asset_path + ".transaction.commit.json"
	var manifest_path := committed_path if FileAccess.file_exists(ProjectSettings.globalize_path(committed_path)) else transaction_path
	if not FileAccess.file_exists(ProjectSettings.globalize_path(manifest_path)) and FileAccess.file_exists(ProjectSettings.globalize_path(transaction_path + ".tmp")):
		manifest_path = transaction_path + ".tmp"
	if not FileAccess.file_exists(ProjectSettings.globalize_path(manifest_path)):
		return {"ok": false, "receipt": _receipt("AUTHORING_TRANSACTION_NOT_FOUND", "没有可恢复的 authoring 事务日志。")}
	var manifest = JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
	if not manifest is Dictionary or manifest.get("contract_type") != "AuthoringFileSetTransaction" or manifest.get("schema_version") != 1 or manifest.get("state") not in ["prepared", "committed"] or not manifest.get("files", null) is Array:
		return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务恢复日志无效；未更改任何文件。")}
	var files: Array = manifest.files
	if files.size() < 2 or files.size() > 3:
		return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务恢复日志中的文件数量无效。")}
	var seen := {}
	var contains_asset := false
	var source_count := 0
	for entry in files:
		if not entry is Dictionary or not entry.get("path", null) is String:
			return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务恢复日志含无效路径。")}
		var path := String(entry.path)
		var relative := path.trim_prefix("res://")
		if not path.begins_with("res://") or relative.is_empty() or relative.split("/").has("..") or path.contains("\\") or seen.has(path):
			return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务恢复日志路径越界或重复。")}
		seen[path] = true
		contains_asset = contains_asset or path == asset_path
		if path != asset_path and path != asset_path + ".ownership.json":
			source_count += 1
			if path != asset_path.trim_suffix(ASSET_EXTENSION) + ".coda":
				return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "第三个事务文件必须是对应的 canonical CODA 源。")}
		var before_fingerprint := String(entry.get("before_fingerprint", ""))
		var after_fingerprint := String(entry.get("after_fingerprint", ""))
		if not entry.get("existed", null) is bool or after_fingerprint.length() != 71 or not after_fingerprint.begins_with("sha256:") or (entry.existed and (before_fingerprint.length() != 71 or not before_fingerprint.begins_with("sha256:"))) or (not entry.existed and not before_fingerprint.is_empty()):
			return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务恢复日志缺少文件指纹。")}
	if not asset_path.ends_with(ASSET_EXTENSION) or not contains_asset or not seen.has(asset_path + ".ownership.json") or source_count != files.size() - 2:
		return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务恢复日志不匹配 EventAsset 与 owner/source 文件集合。")}
	var committed := manifest_path == committed_path
	if committed != (manifest.state == "committed"):
		return {"ok": false, "receipt": _receipt("INVALID_AUTHORING_TRANSACTION", "事务状态与恢复日志位置不一致；未更改任何文件。")}
	if committed:
		for entry in files:
			var target := ProjectSettings.globalize_path(String(entry.path))
			var target_is_new: bool = FileAccess.file_exists(target) and _fingerprint(FileAccess.get_file_as_string(String(entry.path))) == entry.after_fingerprint
			if target_is_new: continue
			var temporary := target + ".tmp"
			if not FileAccess.file_exists(temporary) or _fingerprint(FileAccess.get_file_as_string(String(entry.path) + ".tmp")) != entry.after_fingerprint:
				return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_AMBIGUOUS", "已提交事务缺少可验证的新文件或暂存文件；未执行清理。")}
		for entry in files:
			var target := ProjectSettings.globalize_path(String(entry.path))
			var target_is_new: bool = FileAccess.file_exists(target) and _fingerprint(FileAccess.get_file_as_string(String(entry.path))) == entry.after_fingerprint
			if target_is_new: continue
			if FileAccess.file_exists(target) and DirAccess.remove_absolute(target) != OK:
				return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_WRITE_FAILED", "无法完成已提交事务恢复。")}
			if DirAccess.rename_absolute(target + ".tmp", target) != OK:
				return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_WRITE_FAILED", "无法从暂存文件完成已提交事务恢复。")}
		for entry in files:
			var target := ProjectSettings.globalize_path(String(entry.path))
			for suffix in [".bak", ".tmp"]:
				var artifact: String = target + suffix
				if FileAccess.file_exists(artifact) and DirAccess.remove_absolute(artifact) != OK:
					return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "已恢复新版本，但残留备份暂未清理。")}
		for suffix in [transaction_path + ".tmp", committed_path + ".tmp"]:
			var artifact: String = ProjectSettings.globalize_path(suffix)
			if FileAccess.file_exists(artifact) and DirAccess.remove_absolute(artifact) != OK:
				return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "已恢复新版本，但恢复日志暂存文件未清理。")}
		var journal_absolute := ProjectSettings.globalize_path(transaction_path)
		if FileAccess.file_exists(journal_absolute) and DirAccess.remove_absolute(journal_absolute) != OK:
			return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "新版本完整，但准备日志暂未清理；提交标记仍保留。")}
		var committed_absolute := ProjectSettings.globalize_path(committed_path)
		if FileAccess.file_exists(committed_absolute) and DirAccess.remove_absolute(committed_absolute) != OK:
			return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "新版本完整，但提交日志暂未清理。")}
		return {"ok": true, "recovery": "completed", "receipt": {"ok": true, "diagnostics": []}}
	var rollback_cleanup_failed := false
	for entry in files:
		var target_path := String(entry.path)
		var target := ProjectSettings.globalize_path(target_path)
		var backup := target + ".bak"
		var exists_now := FileAccess.file_exists(target)
		var is_old: bool = exists_now and _fingerprint(FileAccess.get_file_as_string(target_path)) == entry.before_fingerprint
		if entry.existed:
			if is_old: continue
			if not FileAccess.file_exists(backup) or _fingerprint(FileAccess.get_file_as_string(target_path + ".bak")) != entry.before_fingerprint:
				return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_AMBIGUOUS", "旧版本备份缺失或指纹不符；未更改任何目标文件。")}
		else:
			if not exists_now: continue
			if _fingerprint(FileAccess.get_file_as_string(target_path)) != entry.after_fingerprint:
				return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_AMBIGUOUS", "新建目标文件与事务指纹不符；未更改任何目标文件。")}
	for entry in files:
		var target_path := String(entry.path)
		var target := ProjectSettings.globalize_path(target_path)
		var backup := target + ".bak"
		var exists_now := FileAccess.file_exists(target)
		var is_old: bool = exists_now and entry.existed and _fingerprint(FileAccess.get_file_as_string(target_path)) == entry.before_fingerprint
		if not is_old and exists_now and DirAccess.remove_absolute(target) != OK:
			return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_WRITE_FAILED", "无法移除不完整事务产生的混合文件。")}
		if entry.existed and not is_old and DirAccess.rename_absolute(backup, target) != OK:
			return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_WRITE_FAILED", "无法从备份恢复旧版本。")}
		for suffix in [".tmp", ".bak"]:
			var artifact: String = target + suffix
			if FileAccess.file_exists(artifact) and DirAccess.remove_absolute(artifact) != OK: rollback_cleanup_failed = true
	if rollback_cleanup_failed:
		return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "旧版本已恢复，但备份暂未清理；恢复日志仍保留。")}
	var commit_temp := ProjectSettings.globalize_path(committed_path + ".tmp")
	if FileAccess.file_exists(commit_temp) and DirAccess.remove_absolute(commit_temp) != OK:
		return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "旧版本已恢复，但提交标记暂未清理；恢复日志仍保留。")}
	var journal_temp := ProjectSettings.globalize_path(transaction_path + ".tmp")
	if FileAccess.file_exists(journal_temp) and DirAccess.remove_absolute(journal_temp) != OK:
		return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "旧版本已恢复，但暂存恢复日志未能清理。")}
	var journal_absolute := ProjectSettings.globalize_path(transaction_path)
	if FileAccess.file_exists(journal_absolute) and DirAccess.remove_absolute(journal_absolute) != OK:
		return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "旧版本已恢复，但事务日志暂未清理。")}
	var committed_absolute := ProjectSettings.globalize_path(committed_path)
	if FileAccess.file_exists(committed_absolute) and DirAccess.remove_absolute(committed_absolute) != OK:
		return {"ok": false, "receipt": _receipt("AUTHORING_RECOVERY_CLEANUP_FAILED", "旧版本已恢复，但提交日志暂未清理。")}
	return {"ok": true, "recovery": "rolled_back", "receipt": {"ok": true, "diagnostics": []}}

func _transaction_artifacts_exist(asset_path: String) -> bool:
	for suffix in [".transaction.json", ".transaction.json.tmp", ".transaction.commit.json", ".transaction.commit.json.tmp"]:
		if FileAccess.file_exists(ProjectSettings.globalize_path(asset_path + suffix)): return true
	return false

func _test_crash_at(point: String) -> void:
	var crash_point := OS.get_environment("CODA_TEST_CRASH_AT")
	if crash_point.is_empty(): crash_point = OS.get_environment("GSEOS_TEST_CRASH_AT")
	if not OS.is_debug_build() or not OS.get_cmdline_user_args().has("--enable-authoring-crash-injection") or crash_point != point: return
	var marker_path := OS.get_environment("CODA_TEST_CRASH_MARKER")
	if marker_path.is_empty(): marker_path = OS.get_environment("GSEOS_TEST_CRASH_MARKER")
	if marker_path.is_empty(): return
	var marker := FileAccess.open(marker_path, FileAccess.WRITE)
	if marker == null: return
	marker.store_string(point)
	marker.close()
	while true: OS.delay_msec(100)

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
