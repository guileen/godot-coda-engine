extends SceneTree

const DOCK := preload("res://addons/gseos/editor/event_dock.gd")
const STORE := preload("res://addons/gseos/core/asset_store.gd")
var failures: Array[String] = []
var new_event_path := "res://gseos/events/new-event.gse.json"
var generated_path := "res://.gseos/generated/ui_reward_apply.gd"
var reward_owner_path := "res://gseos/events/ui.reward.apply.gse.json.ownership.json"
var embodied_asset_path := "res://gseos/events/embodied-event.gse.json"
var embodied_source_path := "res://gseos/events/embodied-event.coda"

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path + ".ownership.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_asset_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_source_path))
	for suffix in [".ownership.json", ".bak", ".tmp", ".ownership.json.bak", ".ownership.json.tmp", ".transaction.json", ".transaction.json.tmp", ".transaction.commit.json", ".transaction.commit.json.tmp"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_asset_path + suffix))
		DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_source_path + suffix))
	var reward_asset_path := "res://gseos/events/ui.reward.apply.gse.json"
	var reward_asset_raw := FileAccess.get_file_as_string(reward_asset_path)
	var reward_owner_existed := FileAccess.file_exists(reward_owner_path)
	var reward_owner_raw := FileAccess.get_file_as_string(reward_owner_path) if reward_owner_existed else ""
	var dock = DOCK.new()
	root.add_child(dock)
	await process_frame
	if dock._toolbar.get_child_count() != 2:
		failures.append("Event Dock primary toolbar is still crowded with more than two actions")
	if dock._editor_tabs.get_tab_title(0) != "流程" or dock._editor_tabs.get_tab_title(1) != "步骤设置":
		failures.append("Event Dock narrow layout did not separate the flow and step settings pages")
	if dock._event_list.item_count < 1:
		failures.append("Event Dock did not discover the reward EventAsset")
	var reward_index: int = dock._asset_paths.find("res://gseos/events/ui.reward.apply.gse.json")
	if reward_index < 0:
		failures.append("Event Dock did not index the reward EventAsset path")
	dock._new_embodied_event()
	var created_embodied := STORE.new().load_asset(embodied_asset_path)
	if not created_embodied.receipt.ok or created_embodied.ownership.authoring_mode != "text_owned" or not FileAccess.file_exists(embodied_source_path):
		failures.append("new embodied event did not default to a canonical text-owned CODA source")
	reward_index = dock._asset_paths.find("res://gseos/events/ui.reward.apply.gse.json")
	dock._on_event_selected(reward_index)
	if dock._tree.get_root() == null or dock._tree.get_root().get_child_count() < 1:
		failures.append("Event Dock did not rebuild the asset tree")
	dock._tree.get_root().get_first_child().select(0)
	dock._on_tree_selected()
	if dock._editor_tabs.current_tab != 1:
		failures.append("Selecting a flow step did not open its settings page")
	dock._command_search.text = "条件"
	dock._refresh_command_options()
	if dock._command_select.item_count != 2 or String(dock._command_select.get_item_metadata(1)) != "if":
		failures.append("Event Dock step search did not find the matching condition step")
	dock._command_search.text = ""
	dock._refresh_command_options()
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
	dock._selected_node_id = "calculate-score"
	dock._render_inspector()
	if dock._let_expression_edit == null or dock._let_expression_edit.text != "当前积分 + 奖励":
		failures.append("Event Dock did not show the reward calculation in plain language")
	else:
		dock._let_expression_edit.text = "当前积分 + 5"
		dock._preview_let_edit()
		if dock._projection_pending_asset.is_empty() or not dock._projection_preview_diff.contains("当前积分 + 5"):
			failures.append("Event Dock did not preview the readable reward calculation")
		dock._cancel_projection_preview()
	for command_index in dock._command_select.item_count:
		if String(dock._command_select.get_item_metadata(command_index)) == "read":
			dock._command_select.select(command_index)
			break
	dock._insert_draft_node()
	if not dock._draft_param_controls.has("target") or not dock._draft_param_controls["target"] is OptionButton:
		failures.append("read draft did not offer a selectable event object")
	else:
		var target_options := dock._draft_param_controls["target"] as OptionButton
		if target_options.item_count < 2 or target_options.get_item_text(1) != "目标界面":
			failures.append("read draft displayed a raw object id instead of its human label")
	dock._cancel_draft()
	dock._new_event()
	await process_frame
	if not FileAccess.file_exists(new_event_path):
		failures.append("Event Dock new-event transaction did not save")
	else:
		var new_index: int = dock._asset_paths.find(new_event_path)
		dock._on_event_selected(new_index)
		if new_index < 0 or dock._selected_path != new_event_path:
			failures.append("Event Dock did not select the newly created EventAsset")
			dock._selected_path = new_event_path
			var reloaded_new := STORE.new().load_asset(new_event_path)
			dock._selected_asset = reloaded_new.asset
			dock._rebuild_tree()
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
				dock._update_command_description()
				break
		if not dock._command_description.text.contains("新结果"):
			failures.append("step picker did not explain the selected step in plain language")
		dock._insert_draft_node()
		if dock._draft_asset.root.size() != 1 or not dock._draft_asset.root[0].get("draft", false):
			failures.append("Event Dock did not create an in-memory draft node")
		if dock._editor_tabs.current_tab != 1:
			failures.append("New draft step did not open its settings page")
		if dock._let_name_edit == null or dock._let_expression_edit == null or not dock._let_expression_edit.placeholder_text.contains("1 + 2"):
			failures.append("New calculation draft did not explain what to enter")
		var draft_has_next_action := false
		for inspector_child in dock._inspector.get_children():
			if inspector_child is Label and inspector_child.text.contains("给结果起名"):
				draft_has_next_action = true
		if not draft_has_next_action:
			failures.append("calculation draft did not explain its next action")
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
		dock._let_name_edit.text = "测试结果"
		dock._let_expression_edit.text = "1 + 2"
		dock._confirm_draft()
		if dock._selected_asset.root.size() != 1 or dock._selected_asset.root[0].get("draft", false):
			failures.append("Event Dock did not confirm the draft as a committed node")
		elif dock._selected_asset.root[0].params.name != "测试结果" or dock._selected_asset.root[0].params.value != {"left": 1.0, "op": "+", "right": 2.0}:
			failures.append("Event Dock did not turn the human-readable calculation into a structured expression: %s" % JSON.stringify(dock._selected_asset.root[0].params))
		dock._selected_node_id = dock._selected_asset.root[0].node_id
		dock._copy_selected_node()
		if dock._selected_asset.root.size() != 2:
			var disk_after_copy := STORE.new().load_asset(new_event_path)
			failures.append("Event Dock did not copy the selected node: %s; memory=%s; disk=%s" % [dock._status.text, JSON.stringify(dock._selected_asset), JSON.stringify(disk_after_copy.asset)])
		dock._move_selected_node(1)
		if dock._selected_asset.root.size() != 2:
			failures.append("Event Dock did not move the selected node within its slot: " + dock._status.text)
		dock._delete_selected_node()
		if dock._selected_asset.root.size() != 1:
			failures.append("Event Dock did not delete the selected node")
		dock._selected_node_id = dock._selected_asset.root[0].node_id
		dock._delete_selected_node()
		if not dock._selected_asset.root.is_empty():
			failures.append("Event Dock did not delete the copied node")
		dock._reload_selected_from_disk()
		if dock._selected_asset.root.size() != 0 or not dock._status.text.contains("已从磁盘重载"):
			failures.append("Event Dock did not rebuild the tree after external reload: roots=%d status=%s" % [dock._selected_asset.root.size(), dock._status.text])
		dock._migrate_selected_to_text_owned()
		var migrated_new := STORE.new().load_asset(new_event_path)
		var migrated_source_path := "res://gseos/events/new-event.coda"
		if not migrated_new.receipt.ok or migrated_new.ownership.authoring_mode != "text_owned" or not FileAccess.file_exists(migrated_source_path):
			failures.append("Event Dock explicit graph-owned to text-owned migration did not commit the source and owner")
		else:
			var graph_edit_allowed := dock._write_asset_transaction(new_event_path, dock._selected_asset, dock._selected_asset.duplicate(true), "forbidden graph write")
			if graph_edit_allowed:
				failures.append("Event Dock allowed a graph transaction after text-owned migration")
			dock._open_text_import()
			var migrated_display_name := String(dock._selected_asset.display_name)
			dock._text_import_edit.text = dock._text_import_edit.text.replace(migrated_display_name, "迁移后的文本作者")
			dock._preview_text_import()
			dock._commit_text_import()
			var edited_migration := STORE.new().load_asset(new_event_path)
			if not edited_migration.receipt.ok or edited_migration.asset.display_name != "迁移后的文本作者" or not FileAccess.get_file_as_string(migrated_source_path).contains("迁移后的文本作者"):
				failures.append("Event Dock text-owned edit did not update canonical source, projection and owner")
			else:
				var stable_asset_text := FileAccess.get_file_as_string(new_event_path)
				var stable_source_text := FileAccess.get_file_as_string(migrated_source_path)
				var stable_owner_text := FileAccess.get_file_as_string(new_event_path + ".ownership.json")
				var interrupted_source_text := stable_source_text + "# incomplete write\n"
				var fingerprints := STORE.new()
				var recovery_manifest := {
					"contract_type": "AuthoringFileSetTransaction", "schema_version": 1, "state": "prepared",
					"files": [
						{"path": new_event_path, "existed": true, "before_fingerprint": fingerprints._fingerprint(stable_asset_text), "after_fingerprint": fingerprints._fingerprint(stable_asset_text)},
						{"path": migrated_source_path, "existed": true, "before_fingerprint": fingerprints._fingerprint(stable_source_text), "after_fingerprint": fingerprints._fingerprint(interrupted_source_text)},
						{"path": new_event_path + ".ownership.json", "existed": true, "before_fingerprint": fingerprints._fingerprint(stable_owner_text), "after_fingerprint": fingerprints._fingerprint(stable_owner_text)},
					]
				}
				DirAccess.rename_absolute(ProjectSettings.globalize_path(migrated_source_path), ProjectSettings.globalize_path(migrated_source_path + ".bak"))
				var interrupted_file := FileAccess.open(migrated_source_path, FileAccess.WRITE)
				interrupted_file.store_string(interrupted_source_text)
				interrupted_file.close()
				var manifest_file := FileAccess.open(new_event_path + ".transaction.json", FileAccess.WRITE)
				manifest_file.store_string(JSON.stringify(recovery_manifest, "  ") + "\n")
				manifest_file.close()
				dock._recover_selected_transaction()
				if FileAccess.get_file_as_string(migrated_source_path) != stable_source_text or not dock._status.text.contains("已回滚") or not STORE.new().load_asset(new_event_path).receipt.ok:
					failures.append("Event Dock recovery action did not restore the last consistent text-owned file set")

	var reward_backup: Dictionary = JSON.parse_string(reward_asset_raw)
	dock._selected_path = "res://gseos/events/ui.reward.apply.gse.json"
	dock._on_event_selected(dock._asset_paths.find(dock._selected_path))
	dock._selected_node_id = "animate-score"
	dock._rebuild_tree()
	var duration_slot: Dictionary = {}
	for candidate in dock._projection_node("animate-score").get("slots", []):
		if candidate.get("slot_id", "") == "animate-score.duration":
			duration_slot = candidate
	if duration_slot.is_empty():
		failures.append("Event Dock did not expose the duration projection slot")
	else:
		if not (dock._projection_slot_controls["animate-score.target"] is OptionButton) or (dock._projection_slot_controls["animate-score.target"] as OptionButton).item_count != 3:
			failures.append("Event Dock did not expose a bounded NodeRef selector")
		(dock._projection_slot_controls["animate-score.duration"] as LineEdit).text = "0.5"
		dock._preview_projection_slot(duration_slot)
		if dock._selected_asset.root[0].children.then[2].params.args.duration != 0.35 or dock._projection_pending_asset.root[0].children.then[2].params.args.duration != 0.5:
			failures.append("Event Dock projection preview wrote before confirmation or missed the pending value")
		var before_failure_generated := FileAccess.get_file_as_string(generated_path)
		var before_failure_source_map := FileAccess.get_file_as_string(generated_path + ".map.json")
		dock._generation_override = func(_path): return {"ok": false, "message": "injected generation failure"}
		dock._commit_projection_preview()
		if dock._selected_asset.root[0].children.then[2].params.args.duration != 0.35 or STORE.new().load_asset(dock._selected_path).asset.root[0].children.then[2].params.args.duration != 0.35 or FileAccess.get_file_as_string(generated_path) != before_failure_generated or FileAccess.get_file_as_string(generated_path + ".map.json") != before_failure_source_map or not dock._status.text.contains("未留下混合版本"):
			failures.append("Event Dock generation failure did not restore the single known-good version")
		dock._generation_override = Callable()
		dock._reload_selected_from_disk()
		dock._selected_node_id = "animate-score"
		dock._rebuild_tree()
		duration_slot = dock._projection_node("animate-score").get("slots", [])[3]
		(dock._projection_slot_controls["animate-score.duration"] as LineEdit).text = "0.5"
		dock._preview_projection_slot(duration_slot)
		dock._commit_projection_preview()
		if dock._selected_asset.root[0].children.then[2].params.args.duration != 0.5:
			failures.append("Event Dock projection confirmation did not write back the slot")
	STORE.new().save_asset(reward_asset_path, reward_backup)
	var restore_output: Array[String] = []
	OS.execute("node", [ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js"), "generate", ProjectSettings.globalize_path("res://gseos/events/ui.reward.apply.gse.json")], restore_output, true)
	dock._on_event_selected(dock._asset_paths.find(dock._selected_path))
	dock._selected_node_id = "reward-check"
	dock._rebuild_tree()
	dock._render_inspector()
	for index in dock._condition_left_select.item_count:
		var candidate = dock._condition_left_select.get_item_metadata(index)
		if candidate is Dictionary and String(candidate.get("id", "")) == "reward":
			dock._condition_left_select.select(index)
	dock._refresh_condition_operator_choices(">")
	dock._condition_right_edit.text = "10"
	dock._apply_condition_edit()
	if dock._selected_asset.root[0].params.condition.right == 10 or dock._projection_pending_asset.root[0].params.condition.right != 10:
		failures.append("Event Dock condition preview wrote early or missed its candidate value")
	dock._commit_projection_preview()
	if dock._selected_asset.root[0].params.condition.right != 10:
		failures.append("Event Dock did not commit the confirmed condition edit")
	var restored_reward_asset := FileAccess.open(reward_asset_path, FileAccess.WRITE)
	restored_reward_asset.store_string(reward_asset_raw)
	restored_reward_asset.close()
	if reward_owner_existed:
		var restored_owner := FileAccess.open(reward_owner_path, FileAccess.WRITE)
		restored_owner.store_string(reward_owner_raw)
		restored_owner.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(reward_owner_path))

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
	DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path + ".ownership.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://gseos/events/new-event.coda"))
	for suffix in [".bak", ".tmp", ".ownership.json.bak", ".ownership.json.tmp", ".transaction.json", ".transaction.json.tmp", ".transaction.commit.json", ".transaction.commit.json.tmp"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(new_event_path + suffix))
		DirAccess.remove_absolute(ProjectSettings.globalize_path("res://gseos/events/new-event.coda" + suffix))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_asset_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_source_path))
	for suffix in [".ownership.json", ".bak", ".tmp", ".ownership.json.bak", ".ownership.json.tmp", ".transaction.json", ".transaction.json.tmp", ".transaction.commit.json", ".transaction.commit.json.tmp"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_asset_path + suffix))
		DirAccess.remove_absolute(ProjectSettings.globalize_path(embodied_source_path + suffix))
	if failures.is_empty():
		print("CODA Event Dock smoke integration passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
