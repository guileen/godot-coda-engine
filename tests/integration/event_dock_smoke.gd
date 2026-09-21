extends SceneTree

const DOCK := preload("res://addons/gseos/editor/event_dock.gd")
const STORE := preload("res://addons/gseos/core/asset_store.gd")
var failures: Array[String] = []
var new_event_path := "res://gseos/events/new-event.gse.json"
var generated_path := "res://.gseos/generated/ui_reward_apply.gd"

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path))
	var dock = DOCK.new()
	root.add_child(dock)
	await process_frame
	if dock._event_list.item_count < 1:
		failures.append("Event Dock did not discover the reward EventAsset")
	dock._on_event_selected(0)
	if dock._tree.get_root() == null or dock._tree.get_root().get_child_count() < 1:
		failures.append("Event Dock did not rebuild the asset tree")
	dock._selected_node_id = "reward-check"
	dock._show_source_map_location()
	if not dock._status.text.contains("ui_reward_apply.gd:7") or not dock._status.text.contains("field=condition"):
		failures.append("Event Dock did not resolve the selected node through source-map")
	dock._show_diagnostic_context()
	if not dock._status.text.contains("event_id → node_id → field → backend"):
		failures.append("Event Dock did not expose the complete diagnostic context")
	dock._inspect_managed_artifact()
	if not dock._status.text.contains("受管生成物完整"):
		failures.append("Event Dock did not recognize the managed generated artifact")
	dock._new_event()
	await process_frame
	if not FileAccess.file_exists(new_event_path):
		failures.append("Event Dock new-event transaction did not save")
	else:
		var new_index: int = dock._asset_paths.find(new_event_path)
		dock._on_event_selected(new_index)
		dock._name_edit.text = "可撤销事件"
		dock._rename_selected()
		if STORE.new().load_asset(new_event_path).asset.get("display_name") != "可撤销事件":
			failures.append("Event Dock rename did not commit the display name")
		dock._undo_change()
		if STORE.new().load_asset(new_event_path).asset.get("display_name") == "可撤销事件":
			failures.append("Event Dock fallback undo did not restore the previous asset")
		dock._redo_change()
		if STORE.new().load_asset(new_event_path).asset.get("display_name") != "可撤销事件":
			failures.append("Event Dock fallback redo did not restore the changed asset")

		dock._open_text_import()
		dock._text_import_edit.text = "event ui.new.event.1:\n  let value = 1\n"
		dock._preview_text_import()
		var english_candidate: Dictionary = dock._text_import_candidate.duplicate(true)
		if english_candidate.is_empty() or english_candidate.root.size() != 1:
			failures.append("English text import did not produce a preview tree: " + dock._text_import_status.text)
		dock._text_import_edit.text = "事件 ui.new.event.1：\n  令 value 为 1\n"
		dock._preview_text_import()
		var chinese_candidate: Dictionary = dock._text_import_candidate.duplicate(true)
		if chinese_candidate.is_empty() or chinese_candidate.root.size() != 1 or chinese_candidate.root[0].command_id != english_candidate.root[0].command_id:
			failures.append("Chinese text import did not normalize to the same tree: " + dock._text_import_status.text)
		dock._text_import_edit.text = "event ui.new.event.1:\n\tlet value = 1\n"
		dock._preview_text_import()
		if not dock._text_import_candidate.is_empty() or not dock._text_import_status.text.contains("失败"):
			failures.append("Invalid text import did not preserve the committed asset: " + dock._text_import_status.text)
		dock._cancel_text_import()

		for command_index in dock._command_select.item_count:
			if String(dock._command_select.get_item_metadata(command_index)) == "let":
				dock._command_select.select(command_index)
				break
		dock._insert_draft_node()
		if dock._draft_asset.root.size() != 1 or not dock._draft_asset.root[0].get("draft", false):
			failures.append("Event Dock did not create an in-memory draft node")
		if not dock._selected_asset.root.is_empty():
			failures.append("draft insertion changed the committed asset")
		var invalid_slot := dock._append_to_slot(dock._selected_asset.duplicate(true), {"parent_id": "missing", "slot": "then"}, {"node_id": "bad", "command_id": "let"})
		if invalid_slot:
			failures.append("Event Dock accepted an invalid children slot")
		dock._cancel_draft()
		var cancelled := STORE.new().load_asset(new_event_path)
		if not cancelled.receipt.ok or not cancelled.asset.root.is_empty():
			failures.append("draft cancellation changed the persisted asset")
		for command_index in dock._command_select.item_count:
			if String(dock._command_select.get_item_metadata(command_index)) == "let":
				dock._command_select.select(command_index)
				break
		dock._insert_draft_node()
		(dock._draft_param_controls["name"] as LineEdit).text = "\"draft_value\""
		(dock._draft_param_controls["value"] as LineEdit).text = "1"
		dock._confirm_draft()
		if dock._selected_asset.root.size() != 1 or dock._selected_asset.root[0].get("draft", false):
			failures.append("Event Dock did not confirm the draft as a committed node")
		dock._selected_node_id = dock._selected_asset.root[0].node_id
		dock._copy_selected_node()
		if dock._selected_asset.root.size() != 2:
			failures.append("Event Dock did not copy the selected node")
		dock._move_selected_node(1)
		if dock._selected_asset.root.size() != 2:
			failures.append("Event Dock did not move the selected node within its slot")
		dock._delete_selected_node()
		if dock._selected_asset.root.size() != 1:
			failures.append("Event Dock did not delete the selected node")
		dock._selected_node_id = dock._selected_asset.root[0].node_id
		dock._delete_selected_node()
		if not dock._selected_asset.root.is_empty():
			failures.append("Event Dock did not delete the copied node")
		dock._reload_selected_from_disk()
		if dock._selected_asset.root.size() != 0 or not dock._status.text.contains("已从磁盘重载"):
			failures.append("Event Dock did not rebuild the tree after external reload")

	var reward_backup: Dictionary = STORE.new().load_asset("res://gseos/events/ui.reward.apply.gse.json").asset
	dock._selected_path = "res://gseos/events/ui.reward.apply.gse.json"
	dock._on_event_selected(dock._asset_paths.find(dock._selected_path))
	dock._selected_node_id = "reward-check"
	dock._rebuild_tree()
	dock._condition_edit.text = "{\"op\":\">\",\"left\":{\"ref\":\"reward\"},\"right\":10}"
	dock._apply_condition_edit()
	if dock._selected_asset.root[0].params.condition.right != 10:
		failures.append("Event Dock did not commit a composite condition edit")
	STORE.new().save_asset("res://gseos/events/ui.reward.apply.gse.json", reward_backup)

	var generated_file := FileAccess.open(generated_path, FileAccess.READ)
	if generated_file != null:
		var original_generated := generated_file.get_as_text()
		generated_file.close()
		var changed_generated := FileAccess.open(generated_path, FileAccess.WRITE)
		changed_generated.store_string("# manually changed\n")
		changed_generated.close()
		dock._selected_path = "res://gseos/events/ui.reward.apply.gse.json"
		dock._on_event_selected(dock._asset_paths.find(dock._selected_path))
		dock._inspect_managed_artifact()
		if not dock._status.text.contains("手改"):
			failures.append("Event Dock did not surface the managed-artifact takeover state")
		var restored_generated := FileAccess.open(generated_path, FileAccess.WRITE)
		restored_generated.store_string(original_generated)
		restored_generated.close()
	dock.queue_free()
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path + ".tmp"))
	if failures.is_empty():
		print("GSEOS Event Dock smoke integration passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
