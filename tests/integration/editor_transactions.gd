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

	var text_source_path := "res://.gseos/text-owned-transaction.coda"
	var text_asset_path := "res://.gseos/text-owned-transaction.gse.json"
	var text_source := "event ui.text.owned [id: ui.text.owned]:\n  let score = 1 # @node_id=stable.score\n"
	var text_source_file := FileAccess.open(text_source_path, FileAccess.WRITE)
	text_source_file.store_string(text_source)
	text_source_file.close()
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var parse_output: Array[String] = []
	OS.execute("node", [cli, "parse", ProjectSettings.globalize_path(text_source_path)], parse_output, true)
	var parsed_text = JSON.parse_string("\n".join(parse_output))
	var text_asset: Dictionary = parsed_text.asset
	var text_created := store.save_text_owned_asset(text_asset_path, text_source_path, text_source, text_asset, -1, "")
	if not text_created.saved or store.load_asset(text_asset_path).ownership.authoring_mode != "text_owned":
		failures.append("text-owned source, projection and owner were not committed together")
	var source_fingerprint: String = store.load_asset(text_asset_path).ownership.source.fingerprint
	var edited_source := text_source.replace("score = 1", "score = 2")
	var edited_source_path := text_source_path + ".candidate"
	var edited_source_file := FileAccess.open(edited_source_path, FileAccess.WRITE)
	edited_source_file.store_string(edited_source)
	edited_source_file.close()
	parse_output.clear()
	OS.execute("node", [cli, "parse", ProjectSettings.globalize_path(edited_source_path)], parse_output, true)
	parsed_text = JSON.parse_string("\n".join(parse_output))
	var edited_text_asset: Dictionary = parsed_text.asset
	var text_updated := store.save_text_owned_asset(text_asset_path, text_source_path, edited_source, edited_text_asset, 0, source_fingerprint)
	var text_reloaded := store.load_asset(text_asset_path)
	if not text_updated.saved or text_reloaded.asset.root[0].params.value != 2 or text_reloaded.ownership.owner_revision != 1:
		failures.append("text-owned source edit did not advance the source/projection owner atomically")
	var stale_text_save := store.save_text_owned_asset(text_asset_path, text_source_path, text_source, text_asset, 0, source_fingerprint)
	if stale_text_save.saved or stale_text_save.receipt.diagnostics[0].get("code") != "AUTHORING_SOURCE_CHANGED":
		failures.append("stale text-owned source edit was not rejected")
	var graph_write_to_text_owner := store.save_asset(text_asset_path, edited_text_asset, text_reloaded.asset)
	if graph_write_to_text_owner.saved:
		failures.append("graph-owned EventAsset store wrote a text-owned projection")

	var old_asset_text := FileAccess.get_file_as_string(test_path)
	var old_owner_text := FileAccess.get_file_as_string(ownership_path)
	var partial_asset: Dictionary = JSON.parse_string(old_asset_text)
	partial_asset["display_name"] = "中断中的新版本"
	var partial_asset_text := JSON.stringify(partial_asset, "  ") + "\n"
	var partial_owner_text := "uncommitted owner version\n"
	var rollback_manifest := {
		"contract_type": "AuthoringFileSetTransaction", "schema_version": 1, "state": "prepared",
		"files": [
			{"path": test_path, "existed": true, "before_fingerprint": store._fingerprint(old_asset_text), "after_fingerprint": store._fingerprint(partial_asset_text)},
			{"path": ownership_path, "existed": true, "before_fingerprint": store._fingerprint(old_owner_text), "after_fingerprint": store._fingerprint(partial_owner_text)},
		]
	}
	DirAccess.rename_absolute(ProjectSettings.globalize_path(test_path), ProjectSettings.globalize_path(test_path + ".bak"))
	_write_text(test_path, partial_asset_text)
	_write_text(test_path + ".transaction.json", JSON.stringify(rollback_manifest, "  ") + "\n")
	if store.load_asset(test_path).receipt.ok:
		failures.append("interrupted authoring transaction exposed a mixed-version asset")
	_write_text(test_path + ".bak", "untrusted backup\n")
	var ambiguous_recovery := store.recover_transaction(test_path)
	if ambiguous_recovery.ok or FileAccess.get_file_as_string(test_path) != partial_asset_text:
		failures.append("recovery modified a transaction whose backup fingerprint did not match")
	_write_text(test_path + ".bak", old_asset_text)
	var rolled_back := store.recover_transaction(test_path)
	if not rolled_back.ok or rolled_back.recovery != "rolled_back" or FileAccess.get_file_as_string(test_path) != old_asset_text or not store.load_asset(test_path).receipt.ok:
		failures.append("recovery did not restore a verifiable previous file set")

	old_asset_text = FileAccess.get_file_as_string(test_path)
	old_owner_text = FileAccess.get_file_as_string(ownership_path)
	var committed_asset: Dictionary = JSON.parse_string(old_asset_text)
	committed_asset["display_name"] = "已提交的新版本"
	var committed_asset_text := JSON.stringify(committed_asset, "  ") + "\n"
	var committed_owner := store._make_ownership(test_path, committed_asset, "graph_owned", int(JSON.parse_string(old_owner_text).owner_revision) + 1)
	var committed_owner_text := JSON.stringify(committed_owner, "  ") + "\n"
	var committed_manifest := {
		"contract_type": "AuthoringFileSetTransaction", "schema_version": 1, "state": "prepared",
		"files": [
			{"path": test_path, "existed": true, "before_fingerprint": store._fingerprint(old_asset_text), "after_fingerprint": store._fingerprint(committed_asset_text)},
			{"path": ownership_path, "existed": true, "before_fingerprint": store._fingerprint(old_owner_text), "after_fingerprint": store._fingerprint(committed_owner_text)},
		]
	}
	_write_text(test_path + ".bak", old_asset_text)
	_write_text(ownership_path + ".bak", old_owner_text)
	_write_text(test_path, committed_asset_text)
	_write_text(ownership_path, committed_owner_text)
	var committed_manifest_text := JSON.stringify(committed_manifest, "  ") + "\n"
	_write_text(test_path + ".transaction.json", committed_manifest_text)
	committed_manifest.state = "committed"
	_write_text(test_path + ".transaction.commit.json", JSON.stringify(committed_manifest, "  ") + "\n")
	var completed := store.recover_transaction(test_path)
	if not completed.ok or completed.recovery != "completed" or not store.load_asset(test_path).receipt.ok or store.load_asset(test_path).asset.display_name != "已提交的新版本":
		failures.append("recovery did not retain a fully committed file set")

	var text_asset_before_commit := FileAccess.get_file_as_string(text_asset_path)
	var text_source_before_commit := FileAccess.get_file_as_string(text_source_path)
	var text_owner_before_commit := FileAccess.get_file_as_string(text_asset_path + ".ownership.json")
	var third_source := edited_source.replace("score = 2", "score = 3")
	_write_text(edited_source_path, third_source)
	parse_output.clear()
	OS.execute("node", [cli, "parse", ProjectSettings.globalize_path(edited_source_path)], parse_output, true)
	parsed_text = JSON.parse_string("\n".join(parse_output))
	var third_asset: Dictionary = parsed_text.asset
	var text_owner_before: Dictionary = store.load_asset(text_asset_path).ownership
	var third_save := store.save_text_owned_asset(text_asset_path, text_source_path, third_source, third_asset, 1, String(text_owner_before.source.fingerprint))
	if not third_save.saved:
		failures.append("text-owned three-file transaction failed before forward-recovery fixture")
	var text_asset_after_commit := FileAccess.get_file_as_string(text_asset_path)
	var text_source_after_commit := FileAccess.get_file_as_string(text_source_path)
	var text_owner_after_commit := FileAccess.get_file_as_string(text_asset_path + ".ownership.json")
	var text_manifest := {
		"contract_type": "AuthoringFileSetTransaction", "schema_version": 1, "state": "prepared",
		"files": [
			{"path": text_asset_path, "existed": true, "before_fingerprint": store._fingerprint(text_asset_before_commit), "after_fingerprint": store._fingerprint(text_asset_after_commit)},
			{"path": text_source_path, "existed": true, "before_fingerprint": store._fingerprint(text_source_before_commit), "after_fingerprint": store._fingerprint(text_source_after_commit)},
			{"path": text_asset_path + ".ownership.json", "existed": true, "before_fingerprint": store._fingerprint(text_owner_before_commit), "after_fingerprint": store._fingerprint(text_owner_after_commit)},
		]
	}
	_write_text(text_asset_path + ".bak", text_asset_before_commit)
	_write_text(text_source_path + ".bak", text_source_before_commit)
	_write_text(text_asset_path + ".ownership.json.bak", text_owner_before_commit)
	var text_manifest_text := JSON.stringify(text_manifest, "  ") + "\n"
	_write_text(text_asset_path + ".transaction.json", text_manifest_text)
	text_manifest.state = "committed"
	_write_text(text_asset_path + ".transaction.commit.json", JSON.stringify(text_manifest, "  ") + "\n")
	var text_forward_recovery := store.recover_transaction(text_asset_path)
	var text_forward_loaded := store.load_asset(text_asset_path)
	if not text_forward_recovery.ok or text_forward_recovery.recovery != "completed" or not text_forward_loaded.receipt.ok or text_forward_loaded.asset.root[0].params.value != 3 or FileAccess.get_file_as_string(text_source_path) != third_source:
		failures.append("three-file source/projection/owner recovery did not preserve the committed version")

	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + ".ownership.json"))
	for suffix in [".tmp", ".ownership.json.tmp", ".bak", ".ownership.json.bak", ".transaction.json", ".transaction.json.tmp", ".transaction.commit.json", ".transaction.commit.json.tmp"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(test_path + suffix))
	for suffix in ["", ".ownership.json", ".coda", ".gse.json", ".gse.json.ownership.json", ".tmp", ".ownership.json.tmp", ".coda.tmp", ".coda.bak", ".gse.json.bak", ".gse.json.ownership.json.bak", ".transaction.json", ".transaction.json.tmp", ".transaction.commit.json", ".transaction.commit.json.tmp", ".coda.candidate"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path("res://.gseos/text-owned-transaction" + suffix))
	if failures.is_empty():
		print("CODA editor asset transaction integration passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)

func _write_text(path: String, value: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		failures.append("could not write recovery fixture: " + path)
		return
	file.store_string(value)
	file.close()
