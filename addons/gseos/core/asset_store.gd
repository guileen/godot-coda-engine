@tool
class_name GSEOS_AssetStore
extends RefCounted

const ASSET_EXTENSION := ".gse.json"

func load_asset(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {"asset": {}, "receipt": _receipt("ASSET_NOT_FOUND", "无法读取 EventAsset：" + path)}
	var raw := file.get_as_text()
	var parsed = JSON.parse_string(raw.replace("\uFEFF", ""))
	if not parsed is Dictionary:
		return {"asset": {}, "receipt": _receipt("INVALID_JSON", "EventAsset JSON 无效，原文件保持不变。")}
	var asset := GSEOS_EventAsset.new()
	var receipt: Dictionary = asset.from_dictionary(parsed)
	return {"asset": asset.data, "receipt": receipt, "raw": raw}

func save_asset(path: String, asset: Dictionary) -> Dictionary:
	var checker := GSEOS_EventAsset.new()
	var receipt: Dictionary = checker.from_dictionary(asset)
	if not receipt.ok:
		return {"receipt": receipt, "saved": false}
	var temp_path := path + ".tmp"
	var file := FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		return {"receipt": _receipt("ASSET_WRITE_FAILED", "无法写入临时 EventAsset。"), "saved": false}
	file.store_string(JSON.stringify(checker.data, "  ") + "\n")
	file.close()
	var absolute_path := ProjectSettings.globalize_path(path)
	var absolute_temp_path := ProjectSettings.globalize_path(temp_path)
	var backup_path := absolute_path + ".bak"
	if FileAccess.file_exists(backup_path):
		DirAccess.remove_absolute(absolute_temp_path)
		return {"receipt": _receipt("ASSET_BACKUP_EXISTS", "检测到未完成的 EventAsset 替换；请先恢复或移走 .bak。"), "saved": false}
	var had_original := FileAccess.file_exists(absolute_path)
	if had_original and DirAccess.rename_absolute(absolute_path, backup_path) != OK:
		DirAccess.remove_absolute(absolute_temp_path)
		return {"receipt": _receipt("ASSET_BACKUP_FAILED", "无法保护原始 EventAsset，未执行替换。"), "saved": false}
	if DirAccess.rename_absolute(absolute_temp_path, absolute_path) != OK:
		if had_original:
			DirAccess.rename_absolute(backup_path, absolute_path)
		DirAccess.remove_absolute(absolute_temp_path)
		return {"receipt": _receipt("ASSET_RENAME_FAILED", "无法完成 EventAsset 替换，原文件已恢复。"), "saved": false}
	if had_original and DirAccess.remove_absolute(backup_path) != OK:
		var rollback_temp := absolute_path + ".rollback.tmp"
		var rolled_back := DirAccess.rename_absolute(absolute_path, rollback_temp) == OK and DirAccess.rename_absolute(backup_path, absolute_path) == OK
		if rolled_back:
			DirAccess.remove_absolute(rollback_temp)
		return {"receipt": _receipt("ASSET_BACKUP_CLEANUP_FAILED", "旧版本备份未能清理；已回滚本次替换。"), "saved": false}
	return {"receipt": receipt, "saved": true}

func _receipt(code: String, message: String) -> Dictionary:
	return {"ok": false, "diagnostics": [{"code": code, "severity": "error", "message": message, "path": "/"}]}
