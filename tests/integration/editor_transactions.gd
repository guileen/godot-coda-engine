extends SceneTree

const STORE := preload("res://addons/gseos/core/asset_store.gd")
const TEXT_TRANSACTION := preload("res://addons/gseos/editor/text_transaction.gd")

var failures: Array[String] = []
var test_path := "res://.gseos/editor-transaction-test.gse.json"

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	var source_file := FileAccess.open("res://gseos/events/ui.reward.apply.gse.json", FileAccess.READ)
	var original: Dictionary = JSON.parse_string(source_file.get_as_text())
	original["test_unknown"] = {"nested": true}
	var store := STORE.new()
	var saved := store.save_asset(test_path, original)
	if not saved.saved or not saved.receipt.ok:
		failures.append("valid EventAsset transaction did not save")
	var loaded := store.load_asset(test_path)
	if not loaded.receipt.ok or not loaded.asset.get("test_unknown", {}).get("nested", false):
		failures.append("reload did not preserve unknown fields")
	var backup_marker := FileAccess.open(test_path + ".bak", FileAccess.WRITE)
	backup_marker.store_string("incomplete replacement")
	backup_marker.close()
	var blocked_by_backup := store.save_asset(test_path, original)
	if blocked_by_backup.saved or store.load_asset(test_path).asset.get("event_id", "") != original.get("event_id", ""):
		failures.append("incomplete backup marker did not block a potentially mixed-version save")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".bak"))

	var invalid := original.duplicate(true)
	invalid["event_id"] = "INVALID ID"
	var rejected := store.save_asset(test_path, invalid)
	var after_reject := store.load_asset(test_path)
	if rejected.saved or after_reject.asset.get("event_id") != original.get("event_id"):
		failures.append("invalid save overwrote the last valid asset")
	var concurrent := original.duplicate(true)
	concurrent["display_name"] = "并发版本"
	var concurrent_saved := store.save_asset(test_path, concurrent, original)
	var stale_candidate := original.duplicate(true)
	stale_candidate["display_name"] = "过期预览"
	var stale_save := store.save_asset(test_path, stale_candidate, original)
	var after_stale := store.load_asset(test_path)
	if not concurrent_saved.saved or stale_save.saved or stale_save.receipt.diagnostics[0].get("code") != "ASSET_SOURCE_CHANGED":
		failures.append("stale compare-and-swap transaction was not rejected")
	if after_stale.asset.get("display_name") != "并发版本":
		failures.append("stale transaction overwrote the concurrent version")
	store.save_asset(test_path, original, concurrent)

	var transaction := TEXT_TRANSACTION.new()
	transaction.begin(original, "event ui.reward.apply")
	var changed := original.duplicate(true)
	changed["display_name"] = "临时修改"
	var preview := transaction.preview(changed)
	if not preview.changed or preview.diff.is_empty():
		failures.append("text transaction did not expose a preview change")
	var cancelled := transaction.cancel()
	if cancelled.asset.get("display_name") != original.get("display_name"):
		failures.append("cancel changed the committed asset")
	transaction.begin(original, "event ui.reward.apply")
	transaction.preview(changed)
	var committed := transaction.commit()
	if not committed.ok or committed.asset.get("display_name") != "临时修改":
		failures.append("valid text transaction did not commit")

	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".tmp"))
	if failures.is_empty():
		print("GSEOS editor asset transaction integration passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
