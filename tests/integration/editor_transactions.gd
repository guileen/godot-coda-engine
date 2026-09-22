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
	if not loaded.ownership_receipt.ok or not loaded.ownership_persisted or loaded.ownership.authoring_mode != "graph_owned" or loaded.ownership.owner_revision != 0:
		failures.append("new EventAsset did not persist a graph-owned revision-zero sidecar")
	if loaded.ownership.source.fingerprint.is_empty() or loaded.ownership.node_identity.mapping_digest.is_empty():
		failures.append("ownership sidecar omitted source or stable node identity fingerprints")
	var backup_marker := FileAccess.open(test_path + ".bak", FileAccess.WRITE)
	backup_marker.store_string("incomplete replacement")
	backup_marker.close()
	var blocked_by_backup := store.save_asset(test_path, original)
	var blocked_read := store.load_asset(test_path)
	if blocked_by_backup.saved or blocked_read.receipt.diagnostics[0].get("code") != "ASSET_TRANSACTION_RECOVERY_REQUIRED":
		failures.append("incomplete backup marker did not block mixed-version read/write")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".bak"))

	var invalid := original.duplicate(true)
	invalid["event_id"] = "INVALID ID"
	var rejected := store.save_asset(test_path, invalid)
	var after_reject := store.load_asset(test_path)
	if rejected.saved or after_reject.asset.get("event_id") != original.get("event_id"):
		failures.append("invalid save overwrote the last valid asset")
	var concurrent := original.duplicate(true)
	concurrent["display_name"] = "并发版本"
	var concurrent_saved := store.save_asset(test_path, concurrent, original, 0)
	var stale_candidate := original.duplicate(true)
	stale_candidate["display_name"] = "过期预览"
	var stale_save := store.save_asset(test_path, stale_candidate, original)
	var after_stale := store.load_asset(test_path)
	if not concurrent_saved.saved or stale_save.saved or stale_save.receipt.diagnostics[0].get("code") != "ASSET_SOURCE_CHANGED":
		failures.append("stale compare-and-swap transaction was not rejected")
	if after_stale.asset.get("display_name") != "并发版本":
		failures.append("stale transaction overwrote the concurrent version")
	var owner_stale := concurrent.duplicate(true)
	owner_stale["display_name"] = "过期 owner revision"
	var stale_owner_save := store.save_asset(test_path, owner_stale, concurrent, 0)
	if stale_owner_save.saved or stale_owner_save.receipt.diagnostics[0].get("code") != "AUTHORING_OWNER_REVISION_CHANGED":
		failures.append("stale owner revision was not rejected")
	var owner_next := concurrent.duplicate(true)
	owner_next["display_name"] = "owner revision 2"
	var owner_saved := store.save_asset(test_path, owner_next, concurrent, 1)
	if not owner_saved.saved or store.load_asset(test_path).ownership.owner_revision != 2:
		failures.append("owner revision did not advance with the asset transaction")
	var ownership_path := test_path + ".ownership.json"
	var ownership_raw := FileAccess.get_file_as_string(ownership_path)
	var corrupted_ownership: Dictionary = JSON.parse_string(ownership_raw)
	corrupted_ownership.source.fingerprint = "sha256:" + "0".repeat(64)
	var corrupted_file := FileAccess.open(ownership_path, FileAccess.WRITE)
	corrupted_file.store_string(JSON.stringify(corrupted_ownership, "  ") + "\n")
	corrupted_file.close()
	var mismatch_load := store.load_asset(test_path)
	if mismatch_load.receipt.ok or mismatch_load.receipt.diagnostics[0].get("code") != "AUTHORING_OWNERSHIP_SOURCE_MISMATCH":
		failures.append("mismatched owner sidecar did not fail closed on read")
	var mismatch_save := store.save_asset(test_path, original, owner_next)
	if mismatch_save.saved:
		failures.append("mismatched owner sidecar did not fail closed on write")
	var restored_owner_file := FileAccess.open(ownership_path, FileAccess.WRITE)
	restored_owner_file.store_string(ownership_raw)
	restored_owner_file.close()
	store.save_asset(test_path, original, owner_next, 2)

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
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".ownership.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".tmp"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".ownership.json.tmp"))
	if failures.is_empty():
		print("GSEOS editor asset transaction integration passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
