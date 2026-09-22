@tool
extends VBoxContainer

var _editor_interface: EditorInterface
var _undo_redo: EditorUndoRedoManager
var _store := GSEOS_AssetStore.new()
var _event_list := ItemList.new()
var _tree := Tree.new()
var _status := Label.new()
var _name_edit := LineEdit.new()
var _slot_select := OptionButton.new()
var _command_select := OptionButton.new()
var _inspector := VBoxContainer.new()
var _inspector_title := Label.new()
var _inspector_hint := Label.new()
var _condition_edit := LineEdit.new()
var _text_import_panel := PanelContainer.new()
var _text_import_edit := TextEdit.new()
var _text_import_status := Label.new()
var _text_import_diff := RichTextLabel.new()
var _text_transaction := GSEOS_TextTransaction.new()
var _text_import_candidate: Dictionary = {}
var _draft_param_controls: Dictionary = {}
var _asset_paths: Array[String] = []
var _selected_path := ""
var _selected_asset: Dictionary = {}
var _selected_ownership: Dictionary = {}
var _selected_node_id := ""
var _draft_asset: Dictionary = {}
var _draft_node_id := ""
var _disk_modified_time := 0
var _fallback_history: Array[Dictionary] = []
var _fallback_history_index := -1
var _projection_map: Dictionary = {}
var _projection_pending_asset: Dictionary = {}
var _projection_pending_slot_id := ""
var _projection_preview_diff := ""
var _projection_slot_controls: Dictionary = {}
var _generation_override: Callable = Callable()
var _last_write_ok := true

const COMMAND_DEFINITIONS := {
	"if": {"label": "条件 if", "fields": ["condition"]},
	"let": {"label": "绑定 let", "fields": ["name", "value"]},
	"read": {"label": "读取 read", "fields": ["target", "field", "bind"]},
	"do": {"label": "同步 do", "fields": ["capability", "args"]},
	"await": {"label": "等待 await", "fields": ["capability", "args"]},
	"publish": {"label": "发布 publish", "fields": ["topic", "payload"]},
	"return": {"label": "返回 return", "fields": ["value"]},
	"escape": {"label": "受限 escape", "fields": ["inputs", "outputs", "code"]},
}

func configure(editor_interface: EditorInterface) -> void:
	_editor_interface = editor_interface
	_undo_redo = editor_interface.get_editor_undo_redo()

func _ready() -> void:
	add_theme_constant_override("separation", 6)
	var title := Label.new()
	title.text = "GSEOS 事件"
	title.add_theme_font_size_override("font_size", 16)
	add_child(title)
	var toolbar := HBoxContainer.new()
	toolbar.add_child(_button("刷新", _reload))
	toolbar.add_child(_button("新建", _new_event))
	toolbar.add_child(_button("外部重载", _reload_selected_from_disk))
	toolbar.add_child(_button("文本导入", _open_text_import))
	toolbar.add_child(_button("确认草稿", _confirm_draft))
	toolbar.add_child(_button("取消草稿", _cancel_draft))
	toolbar.add_child(_button("确认投影写回", _commit_projection_preview))
	toolbar.add_child(_button("取消投影预览", _cancel_projection_preview))
	toolbar.add_child(_button("删除节点", _delete_selected_node))
	toolbar.add_child(_button("复制节点", _copy_selected_node))
	toolbar.add_child(_button("上移", func(): _move_selected_node(-1)))
	toolbar.add_child(_button("下移", func(): _move_selected_node(1)))
	toolbar.add_child(_button("撤销", _undo_change))
	toolbar.add_child(_button("重做", _redo_change))
	add_child(toolbar)
	var name_row := HBoxContainer.new()
	_name_edit.placeholder_text = "事件显示名"
	_name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_row.add_child(_name_edit)
	name_row.add_child(_button("确认重命名", _rename_selected))
	add_child(name_row)
	var insert_row := HBoxContainer.new()
	_slot_select.tooltip_text = "选择要插入的合法 children slot"
	_command_select.tooltip_text = "只列出 E0 后端允许的 command"
	insert_row.add_child(_slot_select)
	insert_row.add_child(_command_select)
	insert_row.add_child(_button("添加草稿节点", _insert_draft_node))
	add_child(insert_row)
	_event_list.custom_minimum_size.y = 100
	_event_list.item_selected.connect(_on_event_selected)
	add_child(_event_list)
	_tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_tree.custom_minimum_size.x = 280
	_tree.item_selected.connect(_on_tree_selected)
	var content := HSplitContainer.new()
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_child(_tree)
	_inspector.custom_minimum_size.x = 320
	_inspector_title.text = "节点检查器"
	_inspector.add_child(_inspector_title)
	_inspector_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_inspector.add_child(_inspector_hint)
	content.add_child(_inspector)
	add_child(content)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_status)
	_build_text_import_panel()
	_refresh_command_options()
	_reload()
	set_process(true)

func _button(label: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = label
	button.pressed.connect(callback)
	return button

func _reload() -> void:
	_event_list.clear()
	_asset_paths.clear()
	var dir := DirAccess.open("res://gseos/events")
	if dir == null:
		_status.text = "未找到 res://gseos/events；创建 EventAsset 后刷新。"
		return
	dir.list_dir_begin()
	var filename := dir.get_next()
	while not filename.is_empty():
		if not dir.current_is_dir() and filename.ends_with(".gse.json"):
			_asset_paths.append("res://gseos/events/" + filename)
			_event_list.add_item(filename.trim_suffix(".gse.json"))
		filename = dir.get_next()
	dir.list_dir_end()
	_status.text = "%d 个 EventAsset；树是唯一事实源。" % _asset_paths.size()
	if _selected_path.is_empty() and not _asset_paths.is_empty():
		_selected_path = _asset_paths[0]
	if not _selected_path.is_empty():
		var selected_index := _asset_paths.find(_selected_path)
		if selected_index >= 0:
			_event_list.select(selected_index)
			_on_event_selected(selected_index)

func _on_event_selected(index: int) -> void:
	if index < 0 or index >= _asset_paths.size():
		return
	_selected_path = _asset_paths[index]
	var loaded := _store.load_asset(_selected_path)
	if not loaded.receipt.ok:
		_selected_asset = {}
		_status.text = _format_diagnostics(loaded.receipt.diagnostics)
		return
	_selected_asset = loaded.asset
	_selected_ownership = loaded.ownership
	_draft_asset = {}
	_draft_node_id = ""
	_name_edit.text = String(_selected_asset.get("display_name", _selected_asset.get("event_id", "")))
	_update_disk_modified_time()
	_selected_node_id = ""
	_projection_pending_asset = {}
	_projection_pending_slot_id = ""
	_projection_preview_diff = ""
	_refresh_projection_map()
	_rebuild_tree()
	_refresh_slot_options()

func _rebuild_tree() -> void:
	_tree.clear()
	var view_asset := _draft_asset if not _draft_asset.is_empty() else _selected_asset
	var tree_root := _tree.create_item()
	tree_root.set_text(0, String(view_asset.get("display_name", view_asset.get("event_id", "EventAsset"))))
	tree_root.set_metadata(0, "")
	for node in view_asset.get("root", []):
		_add_node(tree_root, node)
	_render_inspector()
	_status.text = "已加载 %s；确认/删除是单一可撤销事务。" % view_asset.get("event_id", "")

func _add_node(parent: TreeItem, node: Dictionary) -> void:
	var item := _tree.create_item(parent)
	var projection_node := _projection_node(String(node.get("node_id", "")))
	var labels: Dictionary = projection_node.get("labels", {})
	var display_label := String(labels.get("zh-CN", labels.get("en", node.get("command_id", "?"))))
	item.set_text(0, "%s · %s" % [display_label, node.get("node_id", "?")])
	item.set_tooltip_text(0, "%s\n%s" % [projection_node.get("semantic_id", node.get("command_id", "?")), JSON.stringify(node.get("params", {}))])
	item.set_metadata(0, String(node.get("node_id", "")))
	for slot in node.get("children", {}).keys():
		for child in node.children[slot]:
			_add_node(item, child)

func _on_tree_selected() -> void:
	var item := _tree.get_selected()
	if item == null:
		return
	_selected_node_id = String(item.get_metadata(0))
	_status.text = "选中 node_id=%s；检查器只应显示该节点的待定字段。" % _selected_node_id
	_render_inspector()
	_refresh_slot_options()

func _refresh_command_options() -> void:
	_command_select.clear()
	for command_id in COMMAND_DEFINITIONS.keys():
		var definition: Dictionary = COMMAND_DEFINITIONS[command_id]
		_command_select.add_item(definition.label)
		_command_select.set_item_metadata(_command_select.item_count - 1, command_id)

func _refresh_slot_options() -> void:
	_slot_select.clear()
	_slot_select.add_item("root")
	_slot_select.set_item_metadata(0, {"parent_id": "", "slot": "root"})
	var view_asset := _draft_asset if not _draft_asset.is_empty() else _selected_asset
	var selected := _find_node(view_asset.get("root", []), _selected_node_id)
	if not selected.is_empty() and selected.get("command_id") == "if":
		for slot in ["then", "else"]:
			_slot_select.add_item("%s.children.%s" % [_selected_node_id, slot])
			_slot_select.set_item_metadata(_slot_select.item_count - 1, {"parent_id": _selected_node_id, "slot": slot})

func _find_node(nodes: Array, node_id: String) -> Dictionary:
	for node in nodes:
		if String(node.get("node_id", "")) == node_id:
			return node
		for children in node.get("children", {}).values():
			var found := _find_node(children, node_id)
			if not found.is_empty():
				return found
	return {}

func _render_inspector() -> void:
	for child in _inspector.get_children():
		if child != _inspector_title and child != _inspector_hint:
			child.queue_free()
	_draft_param_controls.clear()
	var view_asset := _draft_asset if not _draft_asset.is_empty() else _selected_asset
	var node := _find_node(view_asset.get("root", []), _selected_node_id)
	if node.is_empty():
		_inspector_hint.text = "选择节点后显示稳定 node_id、摘要和待定字段。"
		return
	var command_id := String(node.get("command_id", ""))
	var definition: Dictionary = COMMAND_DEFINITIONS.get(command_id, {})
	var projection_node := _projection_node(_selected_node_id)
	var projection_labels: Dictionary = projection_node.get("labels", {})
	_inspector_hint.text = "%s\nnode_id=%s\nsemantic_id=%s\nparams=%s" % [projection_labels.get("zh-CN", command_id), _selected_node_id, projection_node.get("semantic_id", command_id), JSON.stringify(node.get("params", {}))]
	_inspector.add_child(_button("显示 source-map 定位", _show_source_map_location))
	_inspector.add_child(_button("检查受管生成物", _inspect_managed_artifact))
	_inspector.add_child(_button("显示诊断上下文", _show_diagnostic_context))
	if command_id == "if" and not node.get("draft", false):
		var condition_row := HBoxContainer.new()
		var condition_label := Label.new()
		condition_label.text = "condition"
		condition_label.custom_minimum_size.x = 80
		condition_row.add_child(condition_label)
		_condition_edit = LineEdit.new()
		_condition_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_condition_edit.text = JSON.stringify(node.get("params", {}).get("condition", {}))
		condition_row.add_child(_condition_edit)
		condition_row.add_child(_button("应用条件", _apply_condition_edit))
		_inspector.add_child(condition_row)
	if not node.get("draft", false):
		_render_projection_slots(projection_node)
		return
	var pending: Array = definition.get("fields", [])
	if pending.is_empty():
		var unsupported := Label.new()
		unsupported.text = "未知 command；目录拒绝确认。"
		_inspector.add_child(unsupported)
		return
	var pending_label := Label.new()
	pending_label.text = "待定字段（确认前不会写入资产）"
	_inspector.add_child(pending_label)
	for field in pending:
		var row := HBoxContainer.new()
		var label := Label.new()
		label.text = String(field)
		label.custom_minimum_size.x = 80
		row.add_child(label)
		var edit := LineEdit.new()
		edit.placeholder_text = "JSON 值；字符串可直接填写"
		edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(edit)
		_inspector.add_child(row)
		_draft_param_controls[field] = edit

func _projection_node(node_id: String) -> Dictionary:
	for item in _projection_map.get("nodes", []):
		if String(item.get("node_id", "")) == node_id:
			return item
	return {}

func _refresh_projection_map() -> void:
	_projection_map = {}
	if _selected_path.is_empty():
		return
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var asset_path := ProjectSettings.globalize_path(_selected_path)
	var alias_path := ProjectSettings.globalize_path("res://gseos/fixtures/ui.reward.apply.alias-registry.json")
	var exit_code := OS.execute("node", [cli, "project", asset_path, alias_path], output, true)
	if exit_code != 0 or output.is_empty():
		_status.text = "语义投影生成失败；保留 EventAsset 原始树。"
		return
	var parsed = JSON.parse_string("\n".join(output))
	if parsed is Dictionary and parsed.get("receipt", {}).get("ok", false):
		_projection_map = parsed.get("map", {})
	else:
		_status.text = "语义投影诊断：%s" % _format_diagnostics(parsed.get("receipt", {}).get("diagnostics", []) if parsed is Dictionary else [])

func _render_projection_slots(projection_node: Dictionary) -> void:
	_projection_slot_controls.clear()
	if projection_node.is_empty():
		return
	var slots: Array = projection_node.get("slots", [])
	if slots.is_empty():
		return
	var title := Label.new()
	title.text = "可编辑槽位（先预览，确认后才写回）"
	_inspector.add_child(title)
	for slot in slots:
		var row := HBoxContainer.new()
		var labels: Dictionary = slot.get("label", {})
		var label := Label.new()
		label.text = String(labels.get("zh-CN", slot.get("field_id", "slot")))
		label.custom_minimum_size.x = 90
		row.add_child(label)
		var control: Control
		if String(slot.get("type", "")) == "NodeRef":
			var select := OptionButton.new()
			select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var allowed_refs: Array = slot.get("allowed_refs", [])
			for allowed_ref in allowed_refs:
				select.add_item(String(allowed_ref))
				select.set_item_metadata(select.item_count - 1, String(allowed_ref))
			var current_ref := String(slot.get("value", {}).get("ref", ""))
			for option_index in select.item_count:
				if String(select.get_item_metadata(option_index)) == current_ref:
					select.select(option_index)
					break
			control = select
		else:
			var edit := LineEdit.new()
			edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			edit.text = _projection_value_text(slot.get("value"))
			control = edit
		row.add_child(control)
		row.add_child(_button("预览", Callable(self, "_preview_projection_slot").bind(slot)))
		_inspector.add_child(row)
		_projection_slot_controls[String(slot.get("slot_id", ""))] = control
	if not _projection_preview_diff.is_empty():
		var diff := RichTextLabel.new()
		diff.bbcode_enabled = false
		diff.custom_minimum_size.y = 80
		diff.text = _projection_preview_diff
		_inspector.add_child(diff)

func _projection_value_text(value) -> String:
	if value is Dictionary and value.has("ref"):
		return String(value.get("ref"))
	if value is String:
		return value
	return JSON.stringify(value)

func _parse_projection_value(slot: Dictionary, text: String) -> Dictionary:
	var type := String(slot.get("type", "Any"))
	if type == "NodeRef":
		var ref := text.strip_edges()
		if ref.is_empty() or (slot.get("allowed_refs", []) is Array and not slot.get("allowed_refs", []).is_empty() and not slot.get("allowed_refs", []).has(ref)):
			return {"ok": false, "message": "目标引用不在当前声明的类型兼容范围内。"}
		return {"ok": true, "value": {"ref": ref}}
	if type == "Duration" or type == "Float":
		if not text.is_valid_float():
			return {"ok": false, "message": "数值槽位必须是数字。"}
		var number := float(text)
		if slot.has("min") and number < float(slot.get("min")):
			return {"ok": false, "message": "数值低于契约下限。"}
		if slot.has("max") and number > float(slot.get("max")):
			return {"ok": false, "message": "数值超出契约范围。"}
		return {"ok": true, "value": number}
	if type == "Int":
		if not text.is_valid_int():
			return {"ok": false, "message": "整数槽位必须是整数。"}
		return {"ok": true, "value": int(text)}
	if type == "Text":
		return {"ok": true, "value": text}
	var parsed = JSON.parse_string(text)
	return {"ok": parsed != null or text == "null", "value": parsed}

func _set_json_pointer(root: Dictionary, pointer: String, value) -> bool:
	if not pointer.begins_with("/"):
		return false
	var parts := pointer.trim_prefix("/").split("/")
	var current: Variant = root
	for index in parts.size() - 1:
		var part := String(parts[index]).replace("~1", "/").replace("~0", "~")
		if current is Dictionary and current.has(part):
			current = current[part]
		elif current is Array and part.is_valid_int() and int(part) < current.size():
			current = current[int(part)]
		else:
			return false
	var last := String(parts[-1]).replace("~1", "/").replace("~0", "~")
	if current is Dictionary and current.has(last):
		current[last] = value
		return true
	if current is Array and last.is_valid_int() and int(last) < current.size():
		current[int(last)] = value
		return true
	return false

func _preview_generated_diff(asset: Dictionary) -> Dictionary:
	var stamp := "%s" % Time.get_ticks_usec()
	var temp_asset := "/tmp/gseos-projection-preview-%s.gse.json" % stamp
	var temp_generated := "/tmp/gseos-projection-preview-%s.gd" % stamp
	var file := FileAccess.open(temp_asset, FileAccess.WRITE)
	if file == null:
		return {"ok": false, "message": "无法创建临时生成预览文件。"}
	file.store_string(JSON.stringify(asset, "  ") + "\n")
	file.close()
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var exit_code := OS.execute("node", [cli, "generate", temp_asset, temp_generated], output, true)
	if exit_code != 0:
		DirAccess.remove_absolute(temp_asset)
		DirAccess.remove_absolute(temp_generated)
		return {"ok": false, "message": "GDScript 预生成失败：%s" % " ".join(output)}
	var next_file := FileAccess.open(temp_generated, FileAccess.READ)
	var current_file := FileAccess.open(_generated_path(), FileAccess.READ)
	if next_file == null or current_file == null:
		DirAccess.remove_absolute(temp_asset)
		DirAccess.remove_absolute(temp_generated)
		return {"ok": false, "message": "缺少当前或预计生成的 GDScript，无法展示三层差异。"}
	var next_lines := next_file.get_as_text().split("\n")
	var current_lines := current_file.get_as_text().split("\n")
	next_file.close()
	current_file.close()
	var changed_lines: Array[String] = []
	var count := maxi(current_lines.size(), next_lines.size())
	for index in count:
		var before := current_lines[index] if index < current_lines.size() else ""
		var after := next_lines[index] if index < next_lines.size() else ""
		if before != after:
			changed_lines.append("L%d: - %s / + %s" % [index + 1, before.strip_edges(), after.strip_edges()])
	DirAccess.remove_absolute(temp_asset)
	DirAccess.remove_absolute(temp_generated)
	return {"ok": true, "message": "GDScript 预计差异（%d 行）：\n%s" % [changed_lines.size(), "\n".join(changed_lines.slice(0, 8))]}

func _preview_projection_slot(slot: Dictionary) -> void:
	var slot_id := String(slot.get("slot_id", ""))
	var control: Control = _projection_slot_controls.get(slot_id)
	if control == null:
		return
	var text := ""
	if control is OptionButton:
		var selected := (control as OptionButton).selected
		if selected >= 0:
			text = String((control as OptionButton).get_item_metadata(selected))
	else:
		text = (control as LineEdit).text
	var parsed := _parse_projection_value(slot, text)
	if not parsed.ok:
		_status.text = "槽位预览失败：%s" % parsed.message
		return
	var next := _selected_asset.duplicate(true)
	if not _set_json_pointer(next, String(slot.get("path", "")), parsed.value):
		_status.text = "槽位路径不存在；未写入资产。"
		return
	var generated_preview := _preview_generated_diff(next)
	if not generated_preview.ok:
		_status.text = "槽位预览失败：%s" % generated_preview.message
		return
	_projection_pending_asset = next
	_projection_pending_slot_id = slot_id
	var source_range := "%s:%s" % [slot.get("source", {}).get("generated_start", "?"), slot.get("source", {}).get("generated_end", "?")]
	_projection_preview_diff = "语义差异 %s：\n- %s\n+ %s\n\nEventAsset 路径：%s\n预计 GDScript/source-map 范围：%s\n%s\n\n确认前均未写入磁盘。" % [slot_id, _projection_value_text(slot.get("value")), _projection_value_text(parsed.value), slot.get("path", ""), source_range, generated_preview.message]
	_render_inspector()
	_status.text = "已预览语义/EventAsset/GDScript 差异；请确认投影写回或取消。"

func _cancel_projection_preview() -> void:
	_projection_pending_asset = {}
	_projection_pending_slot_id = ""
	_projection_preview_diff = ""
	_rebuild_tree()
	_status.text = "已取消投影预览；EventAsset 未改变。"

func _commit_projection_preview() -> void:
	if _projection_pending_asset.is_empty():
		return
	if FileAccess.get_modified_time(_selected_path) != _disk_modified_time:
		_status.text = "投影预览已过期；磁盘资产已变化，请重新加载后再预览。"
		_cancel_projection_preview()
		return
	var before := _selected_asset.duplicate(true)
	var saved := _store.save_asset(_selected_path, _projection_pending_asset, before)
	if not saved.saved:
		_status.text = _format_diagnostics(saved.receipt.diagnostics)
		return
	var generated := _generate_selected_asset()
	if not generated.ok:
		_store.save_asset(_selected_path, before, _projection_pending_asset)
		_update_disk_modified_time()
		_status.text = "生成失败；已恢复原 EventAsset，未留下混合版本。%s" % generated.get("message", "")
		return
	_record_fallback_history(_selected_path, before, _projection_pending_asset, "确认语义投影写回")
	_selected_asset = _projection_pending_asset
	_update_disk_modified_time()
	_projection_pending_asset = {}
	_projection_pending_slot_id = ""
	_projection_preview_diff = ""
	_refresh_projection_map()
	_rebuild_tree()
	_status.text = "语义投影已校验写回；EventAsset、GDScript 与 source map 已重新生成。"

func _generate_selected_asset() -> Dictionary:
	if _generation_override.is_valid():
		var overridden = _generation_override.call(_selected_path)
		return overridden if overridden is Dictionary else {"ok": bool(overridden)}
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var asset_path := ProjectSettings.globalize_path(_selected_path)
	var exit_code := OS.execute("node", [cli, "generate", asset_path], output, true)
	return {"ok": exit_code == 0, "message": " ".join(output)}

func _generated_path() -> String:
	return "res://.gseos/generated/%s.gd" % String(_selected_asset.get("event_id", "")).replace(".", "_")

func _source_map_path() -> String:
	return "%s.map.json" % _generated_path()

func _show_source_map_location() -> void:
	var path := _source_map_path()
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		_status.text = "未找到 source map；请先运行 GSEOS generate。"
		return
	var map = JSON.parse_string(file.get_as_text())
	if not map is Dictionary:
		_status.text = "source map 无效；诊断保留在 EventAsset。"
		return
	for mapping in map.get("mappings", []):
		if String(mapping.get("node_id", "")) == _selected_node_id:
			_status.text = "诊断定位：event=%s node=%s field=%s backend=%s → %s:%d" % [mapping.get("event_id", ""), mapping.get("node_id", ""), mapping.get("field_id", _field_for_command()), mapping.get("backend", "gdscript"), _generated_path(), int(mapping.get("generated_start", 0))]
			return
	_status.text = "source map 中没有 node_id=%s；生成物未覆盖该节点。" % _selected_node_id

func _field_for_command() -> String:
	var node := _find_node(_selected_asset.get("root", []), _selected_node_id)
	match String(node.get("command_id", "")):
		"if": return "condition"
		"let": return "value"
		"read": return "target"
		"do", "await": return "capability"
		"publish": return "topic"
		"return": return "value"
		"escape": return "code"
		_: return "node"

func _show_diagnostic_context() -> void:
	_show_source_map_location()
	if not _status.text.begins_with("诊断定位"):
		return
	_status.text += "；诊断链 event_id → node_id → field → backend 已保留。"

func _inspect_managed_artifact() -> void:
	var path := _generated_path()
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		_status.text = "未找到受管生成物；无需覆盖。"
		return
	var first_line := file.get_line()
	if first_line.begins_with("# GENERATED BY GSEOS.") and first_line.contains("event="):
		_status.text = "受管生成物完整；手改检测通过。"
		return
	_status.text = "检测到受管文件被手改；请恢复生成物或显式接管。"
	var restore := _button("恢复受管生成物", _restore_generated_artifact)
	_inspector.add_child(restore)

func _restore_generated_artifact() -> void:
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var asset := ProjectSettings.globalize_path(_selected_path)
	var exit_code := OS.execute("node", [cli, "generate", asset], output, true)
	if exit_code == 0:
		_status.text = "已恢复受管生成物；source map 已重新生成。"
	else:
		_status.text = "恢复失败；原 EventAsset 未改变。%s" % " ".join(output)

func _selected_command_id() -> String:
	var index := _command_select.selected
	if index < 0:
		return ""
	return String(_command_select.get_item_metadata(index))

func _selected_slot() -> Dictionary:
	var index := _slot_select.selected
	if index < 0:
		return {}
	return _slot_select.get_item_metadata(index)

func _append_to_slot(asset: Dictionary, slot: Dictionary, node: Dictionary) -> bool:
	if String(slot.get("slot", "")) == "root":
		asset.root.append(node)
		return true
	var parent := _find_node(asset.root, String(slot.get("parent_id", "")))
	if parent.is_empty() or parent.get("command_id") != "if":
		return false
	var children: Dictionary = parent.get("children", {})
	var child_slot := String(slot.get("slot", ""))
	if child_slot not in ["then", "else"]:
		return false
	if not children.has(child_slot):
		children[child_slot] = []
	parent["children"] = children
	children[child_slot].append(node)
	return true

func _new_event() -> void:
	var index := 1
	var path := "res://gseos/events/new-event.gse.json"
	while FileAccess.file_exists(path):
		index += 1
		path = "res://gseos/events/new-event-%d.gse.json" % index
	var asset := {"asset_type": "EventAsset", "schema_version": 1, "event_id": "ui.new.event.%d" % index, "display_name": "新事件", "args": [], "reentry": "reject", "recovery": "E0", "root": []}
	if not _write_asset_transaction(path, {}, asset, "创建 GSEOS 事件"):
		return
	_reload()

func _rename_selected() -> void:
	if _selected_path.is_empty() or _selected_asset.is_empty():
		return
	var next := _selected_asset.duplicate(true)
	var name := _name_edit.text.strip_edges()
	if name.is_empty():
		_status.text = "显示名不能为空；未写入资产。"
		return
	next.display_name = name
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "重命名 GSEOS 事件"):
		return
	_selected_asset = next
	_update_disk_modified_time()
	_rebuild_tree()

func _insert_draft_node() -> void:
	if _selected_path.is_empty() or _selected_asset.is_empty():
		return
	if not _draft_asset.is_empty():
		_status.text = "已有未确认 draft；请先确认或取消。"
		return
	var command_id := _selected_command_id()
	var slot := _selected_slot()
	if command_id.is_empty() or slot.is_empty():
		_status.text = "必须选择合法 command 和 slot；未写入资产。"
		return
	var next := _selected_asset.duplicate(true)
	var node_id := "%s.draft.%d" % [next.event_id, Time.get_ticks_msec()]
	var draft := {"node_id": node_id, "command_id": command_id, "params": {}, "draft": true}
	if not _append_to_slot(next, slot, draft):
		_status.text = "slot 不属于选中的控制节点；目录拒绝插入。"
		return
	_draft_asset = next
	_draft_node_id = node_id
	_selected_node_id = node_id
	_rebuild_tree()
	_status.text = "已创建 draft node；取消不写资产，确认后才形成单一事务。"

func _confirm_draft() -> void:
	if _draft_asset.is_empty() or _draft_node_id.is_empty():
		return
	var draft := _find_node(_draft_asset.root, _draft_node_id)
	if draft.is_empty():
		_cancel_draft()
		return
	var params: Dictionary = {}
	for field in _draft_param_controls.keys():
		var text := String(_draft_param_controls[field].text).strip_edges()
		if text.is_empty():
			_status.text = "字段 %s 仍待填写；未写入资产。" % field
			return
		var parsed = _parse_inspector_value(text)
		params[field] = parsed
	if draft.command_id in ["do", "await"] and not params.get("args", {}) is Dictionary:
		_status.text = "args 必须是 JSON 对象；未写入资产。"
		return
	draft["params"] = params
	draft.erase("draft")
	if not _write_asset_transaction(_selected_path, _selected_asset, _draft_asset, "确认 GSEOS 草稿节点"):
		return
	_selected_asset = _draft_asset
	_update_disk_modified_time()
	_draft_asset = {}
	_draft_node_id = ""
	_rebuild_tree()
	_refresh_slot_options()

func _parse_inspector_value(text: String):
	var first := text.substr(0, 1)
	var looks_like_json := first in ["{", "[", "\"", "-"] or text in ["true", "false", "null"] or text.is_valid_float() or text.is_valid_int()
	if not looks_like_json:
		return text
	var parsed = JSON.parse_string(text)
	return text if parsed == null and text != "null" else parsed

func _cancel_draft() -> void:
	if _draft_asset.is_empty():
		return
	_draft_asset = {}
	_draft_node_id = ""
	_selected_node_id = ""
	_rebuild_tree()
	_refresh_slot_options()
	_status.text = "已取消 draft；EventAsset 未改变。"

func _delete_selected_node() -> void:
	if _selected_path.is_empty() or _selected_node_id.is_empty():
		return
	if not _draft_asset.is_empty():
		if _selected_node_id == _draft_node_id:
			_cancel_draft()
		else:
			_status.text = "请先确认或取消 draft，再编辑其他节点。"
		return
	var next := _selected_asset.duplicate(true)
	if not _remove_node(next.root, _selected_node_id):
		_status.text = "未找到节点；未写入资产。"
		return
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "删除 GSEOS 节点"):
		return
	_selected_asset = next
	_update_disk_modified_time()
	_selected_node_id = ""
	_rebuild_tree()
	_refresh_slot_options()

func _copy_selected_node() -> void:
	if _selected_path.is_empty() or _selected_node_id.is_empty() or not _draft_asset.is_empty():
		return
	var next := _selected_asset.duplicate(true)
	if not _copy_node(next.root, _selected_node_id):
		_status.text = "未找到节点；未写入资产。"
		return
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "复制 GSEOS 节点"):
		return
	_selected_asset = next
	_update_disk_modified_time()
	_rebuild_tree()

func _copy_node(nodes: Array, node_id: String) -> bool:
	for index in nodes.size():
		var node: Dictionary = nodes[index]
		if String(node.get("node_id", "")) == node_id:
			var clone: Dictionary = node.duplicate(true)
			clone["node_id"] = "%s.copy.%d" % [node_id, Time.get_ticks_msec()]
			_rekey_descendants(clone)
			nodes.insert(index + 1, clone)
			return true
		for children in node.get("children", {}).values():
			if _copy_node(children, node_id):
				return true
	return false

func _rekey_descendants(node: Dictionary) -> void:
	var children: Dictionary = node.get("children", {})
	for slot in children.keys():
		for index in children[slot].size():
			var child: Dictionary = children[slot][index]
			child["node_id"] = "%s.%s.%d" % [node.node_id, slot, index + 1]
			_rekey_descendants(child)

func _move_selected_node(delta: int) -> void:
	if _selected_path.is_empty() or _selected_node_id.is_empty() or not _draft_asset.is_empty():
		return
	var next := _selected_asset.duplicate(true)
	if not _move_node(next.root, _selected_node_id, delta):
		_status.text = "节点无法在当前 slot 移动；未写入资产。"
		return
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "移动 GSEOS 节点"):
		return
	_selected_asset = next
	_update_disk_modified_time()
	_rebuild_tree()

func _move_node(nodes: Array, node_id: String, delta: int) -> bool:
	for index in nodes.size():
		var node: Dictionary = nodes[index]
		if String(node.get("node_id", "")) == node_id:
			var target := index + delta
			if target < 0 or target >= nodes.size():
				return false
			nodes.remove_at(index)
			nodes.insert(target, node)
			return true
		for children in node.get("children", {}).values():
			if _move_node(children, node_id, delta):
				return true
	return false

func _remove_node(nodes: Array, node_id: String) -> bool:
	for index in nodes.size():
		if String(nodes[index].get("node_id", "")) == node_id:
			nodes.remove_at(index)
			return true
		for children in nodes[index].get("children", {}).values():
			if _remove_node(children, node_id):
				return true
	return false

func _write_asset_transaction(path: String, before: Dictionary, after: Dictionary, title: String) -> bool:
	if path == _selected_path and _selected_ownership.get("authoring_mode", "graph_owned") == "text_owned":
		_status.text = "该资产由 CODA 源唯一拥有；请通过文本事务编辑，图形写入已拒绝。"
		return false
	if _undo_redo == null:
		var result := _store.save_asset(path, after, before)
		if result.saved:
			after.clear()
			after.merge(result.asset, true)
			if path == _selected_path: _selected_ownership = result.ownership
			if result.get("cleanup_pending", false):
				_status.text = "资产与 owner 已提交；旧备份未清理，后续读取/写入将 fail-closed。"
			_record_fallback_history(path, before, after, title)
			_update_disk_modified_time()
		else:
			_status.text = _format_diagnostics(result.receipt.diagnostics)
		return result.saved
	_last_write_ok = true
	_undo_redo.create_action(title)
	_undo_redo.add_do_method(self, "_write_asset", path, before, after)
	_undo_redo.add_undo_method(self, "_write_asset", path, after, before)
	_undo_redo.commit_action()
	return _last_write_ok

func _write_asset(path: String, expected_asset: Dictionary, asset: Dictionary) -> void:
	var result := _store.save_asset(path, asset, expected_asset)
	_last_write_ok = result.saved
	if result.saved:
		asset.clear()
		asset.merge(result.asset, true)
		if path == _selected_path: _selected_ownership = result.ownership
		if result.get("cleanup_pending", false):
			_status.text = "资产与 owner 已提交；旧备份未清理，后续读取/写入将 fail-closed。"
		_update_disk_modified_time()
	if not result.receipt.ok:
		_status.text = _format_diagnostics(result.receipt.diagnostics)

func _format_diagnostics(diagnostics: Array) -> String:
	if diagnostics.is_empty():
		return "未知诊断"
	return "；".join(diagnostics.map(func(item): return "%s: %s" % [item.get("code", "DIAGNOSTIC"), item.get("message", "")]))

func _apply_condition_edit() -> void:
	if _selected_path.is_empty() or _selected_node_id.is_empty() or not _draft_asset.is_empty():
		return
	var parsed = JSON.parse_string(_condition_edit.text)
	if parsed == null or not parsed is Dictionary:
		_status.text = "condition 必须是 JSON 表达式对象；未写入资产。"
		return
	var next := _selected_asset.duplicate(true)
	var node := _find_node(next.root, _selected_node_id)
	if node.is_empty() or node.get("command_id") != "if":
		_status.text = "当前选择不是 if 节点；未写入资产。"
		return
	var params: Dictionary = node.get("params", {}).duplicate(true)
	params["condition"] = parsed
	node["params"] = params
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "编辑 GSEOS 复合条件"):
		return
	_selected_asset = next
	_rebuild_tree()

func _record_fallback_history(path: String, before: Dictionary, after: Dictionary, title: String) -> void:
	if _fallback_history_index + 1 < _fallback_history.size():
		_fallback_history = _fallback_history.slice(0, _fallback_history_index + 1)
	_fallback_history.append({"path": path, "before": before.duplicate(true), "after": after.duplicate(true), "title": title})
	_fallback_history_index = _fallback_history.size() - 1

func _undo_change() -> void:
	if _undo_redo != null:
		_undo_redo.undo()
		_reload_selected_from_disk()
		return
	if _fallback_history_index < 0:
		return
	var action: Dictionary = _fallback_history[_fallback_history_index]
	var result := _store.save_asset(action.path, action.before, action.after)
	if not result.saved:
		_status.text = _format_diagnostics(result.receipt.diagnostics)
		return
	_fallback_history_index -= 1
	_reload_selected_from_disk()

func _redo_change() -> void:
	if _undo_redo != null:
		_undo_redo.redo()
		_reload_selected_from_disk()
		return
	if _fallback_history_index + 1 >= _fallback_history.size():
		return
	_fallback_history_index += 1
	var action: Dictionary = _fallback_history[_fallback_history_index]
	var result := _store.save_asset(action.path, action.after, action.before)
	if not result.saved:
		_status.text = _format_diagnostics(result.receipt.diagnostics)
		_fallback_history_index -= 1
		return
	_reload_selected_from_disk()

func _update_disk_modified_time() -> void:
	if _selected_path.is_empty() or not FileAccess.file_exists(_selected_path):
		_disk_modified_time = 0
		return
	_disk_modified_time = FileAccess.get_modified_time(_selected_path)

func _reload_selected_from_disk() -> void:
	if _selected_path.is_empty():
		return
	var loaded := _store.load_asset(_selected_path)
	if not loaded.receipt.ok:
		_status.text = _format_diagnostics(loaded.receipt.diagnostics)
		return
	_selected_asset = loaded.asset
	_selected_ownership = loaded.ownership
	_draft_asset = {}
	_draft_node_id = ""
	_selected_node_id = ""
	_projection_pending_asset = {}
	_projection_pending_slot_id = ""
	_projection_preview_diff = ""
	_name_edit.text = String(_selected_asset.get("display_name", _selected_asset.get("event_id", "")))
	_update_disk_modified_time()
	_refresh_projection_map()
	_rebuild_tree()
	_refresh_slot_options()
	_status.text = "已从磁盘重载 %s；树、摘要、选择和诊断已重建。" % _selected_asset.get("event_id", "")

func _process(_delta: float) -> void:
	if _selected_path.is_empty() or not _draft_asset.is_empty() or not FileAccess.file_exists(_selected_path):
		return
	var modified := FileAccess.get_modified_time(_selected_path)
	if modified > _disk_modified_time:
		_reload_selected_from_disk()

func _build_text_import_panel() -> void:
	_text_import_panel.visible = false
	var box := VBoxContainer.new()
	var title := Label.new()
	title.text = "GSE 文本导入（非持久预览；提交才写入 EventAsset）"
	box.add_child(title)
	_text_import_edit.custom_minimum_size.y = 130
	box.add_child(_text_import_edit)
	var actions := HBoxContainer.new()
	actions.add_child(_button("预览 diff", _preview_text_import))
	actions.add_child(_button("提交文本事务", _commit_text_import))
	actions.add_child(_button("取消", _cancel_text_import))
	box.add_child(actions)
	_text_import_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_text_import_status)
	_text_import_diff.custom_minimum_size.y = 90
	_text_import_diff.bbcode_enabled = false
	box.add_child(_text_import_diff)
	_text_import_panel.add_child(box)
	add_child(_text_import_panel)

func _open_text_import() -> void:
	if _selected_asset.is_empty():
		_status.text = "请先选择 EventAsset。"
		return
	if not _can_format_asset_to_gse(_selected_asset.get("root", [])):
		_status.text = "此资产包含当前文本投影器不支持的节点/分支；为避免丢失语义，不能打开文本事务。"
		return
	if _selected_ownership.get("authoring_mode", "graph_owned") == "text_owned":
		var source_path := "res://" + String(_selected_ownership.get("source", {}).get("source_ref", ""))
		if not FileAccess.file_exists(source_path):
			_status.text = "text_owned CODA 源缺失；拒绝编辑派生 EventAsset。"
			return
		_text_import_edit.text = FileAccess.get_file_as_string(source_path)
	else:
		_text_import_edit.text = _asset_to_gse_text(_selected_asset)
	_text_import_status.text = "编辑文本后预览；失败只保留 draft 和诊断，不改资产。"
	_text_import_diff.text = ""
	_text_import_candidate = {}
	_text_import_panel.visible = true

func _cancel_text_import() -> void:
	_text_transaction.cancel()
	_text_import_candidate = {}
	_text_import_panel.visible = false
	_text_import_diff.text = ""

func _preview_text_import() -> void:
	if _selected_asset.is_empty():
		return
	var temp_path := "res://.gseos/text-import-%d.gse" % Time.get_ticks_msec()
	var file := FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		_text_import_status.text = "无法创建文本 draft；资产未改变。"
		return
	file.store_string(_text_import_edit.text)
	file.close()
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var exit_code := OS.execute("node", [cli, "parse-check", ProjectSettings.globalize_path(temp_path)], output, true)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(temp_path))
	var parsed = JSON.parse_string("\n".join(output))
	if exit_code != 0 or not parsed is Dictionary or not parsed.get("receipt", {}).get("ok", false) or not parsed.get("asset") is Dictionary:
		_text_import_candidate = {}
		_text_import_status.text = "文本导入失败；EventAsset 未改变。%s" % _format_diagnostics(parsed.get("receipt", {}).get("diagnostics", []) if parsed is Dictionary else [])
		_text_import_diff.text = ""
		return
	var candidate: Dictionary = parsed.asset.duplicate(true)
	if _selected_ownership.get("authoring_mode", "graph_owned") == "text_owned":
		if candidate.get("event_id") != _selected_asset.get("event_id"):
			_text_import_candidate = {}
			_text_import_status.text = "text_owned 编辑不得更改 asset_id；请执行显式 owner migration。"
			return
		candidate["recovery"] = _selected_asset.get("recovery", "E0")
	else:
		candidate["event_id"] = _selected_asset.get("event_id", candidate.get("event_id", ""))
		candidate["display_name"] = _selected_asset.get("display_name", candidate.get("display_name", ""))
		candidate["recovery"] = _selected_asset.get("recovery", "E0")
	_rebase_imported_node_ids(candidate, _selected_asset)
	_text_transaction.begin(_selected_asset, _text_import_edit.text)
	var preview := _text_transaction.preview(candidate, parsed.receipt.diagnostics)
	_text_import_candidate = preview.asset
	_text_import_status.text = "文本导入通过 parse → bind → check；当前为预览，确认后才写入。"
	_text_import_diff.text = "\n".join(preview.diff)

func _commit_text_import() -> void:
	if _text_import_candidate.is_empty():
		_text_import_status.text = "没有可提交的成功预览；资产未改变。"
		return
	var committed := _text_transaction.commit()
	if not committed.ok:
		_text_import_status.text = _format_diagnostics(committed.diagnostics)
		return
	if _selected_ownership.get("authoring_mode", "graph_owned") == "text_owned":
		var source_path := "res://" + String(_selected_ownership.get("source", {}).get("source_ref", ""))
		var saved := _store.save_text_owned_asset(_selected_path, source_path, _text_import_edit.text, committed.asset, int(_selected_ownership.get("owner_revision", -1)), String(_selected_ownership.get("source", {}).get("fingerprint", "")))
		if not saved.saved:
			_text_import_status.text = _format_diagnostics(saved.receipt.diagnostics)
			return
		_selected_asset = saved.asset
		_selected_ownership = saved.ownership
		if saved.get("cleanup_pending", false): _text_import_status.text = "源、派生投影与 owner 已提交；旧备份待恢复清理。"
	else:
		if not _write_asset_transaction(_selected_path, _selected_asset, committed.asset, "提交 GSE 文本导入"):
			return
		_selected_asset = committed.asset
	_text_import_candidate = {}
	_text_import_panel.visible = false
	_rebuild_tree()
	_refresh_slot_options()

func _rebase_imported_node_ids(candidate: Dictionary, _original: Dictionary) -> void:
	var used_ids := {}
	_collect_node_ids(candidate.get("root", []), used_ids)
	_rebase_nodes(candidate.get("root", []), used_ids, 1)

func _collect_node_ids(nodes: Array, result: Dictionary) -> void:
	for node in nodes:
		if not String(node.get("node_id", "")).begins_with("imported-"):
			result[String(node.get("node_id", ""))] = true
		for children in node.get("children", {}).values():
			_collect_node_ids(children, result)

func _rebase_nodes(nodes: Array, used_ids: Dictionary, imported_index: int) -> int:
	for node in nodes:
		if String(node.get("node_id", "")).begins_with("imported-"):
			var candidate_id := "%s.imported.%d" % [_selected_asset.get("event_id", "event"), imported_index]
			while used_ids.has(candidate_id):
				imported_index += 1
				candidate_id = "%s.imported.%d" % [_selected_asset.get("event_id", "event"), imported_index]
			node["node_id"] = candidate_id
			used_ids[candidate_id] = true
			imported_index += 1
		for children in node.get("children", {}).values():
			imported_index = _rebase_nodes(children, used_ids, imported_index)
	return imported_index

func _asset_to_gse_text(asset: Dictionary) -> String:
	var argument_names: Array[String] = []
	for argument in asset.get("args", []):
		argument_names.append(String(argument.get("id", "")))
	var display_name := String(asset.get("display_name", asset.get("event_id", "event")))
	var event_id := String(asset.get("event_id", display_name))
	var header := "event %s(%s) [id: %s]:" % [display_name, ", ".join(argument_names), event_id] if not argument_names.is_empty() else "event %s [id: %s]:" % [display_name, event_id]
	var lines: Array[String] = [header]
	_append_asset_text(asset.get("root", []), 1, lines)
	return "\n".join(lines) + "\n"

func _can_format_asset_to_gse(nodes: Array) -> bool:
	for node in nodes:
		var command := String(node.get("command_id", ""))
		if command not in ["if", "let", "do", "await", "motion_intent", "publish"]:
			return false
		var children: Dictionary = node.get("children", {})
		if command == "if":
			if children.keys().any(func(slot): return slot not in ["then", "else"]):
				return false
			if not _can_format_asset_to_gse(children.get("then", [])) or not _can_format_asset_to_gse(children.get("else", [])):
				return false
		elif not children.is_empty():
			return false
	return true

func _append_asset_text(nodes: Array, indent: int, lines: Array[String]) -> void:
	for node in nodes:
		var pad := "  ".repeat(indent)
		var anchor := " # @node_id=%s" % node.get("node_id", "")
		match String(node.get("command_id", "")):
			"if":
				lines.append("%sif (%s):%s" % [pad, _format_source_expression(node.get("params", {}).get("condition", {})), anchor])
				_append_asset_text(node.get("children", {}).get("then", []), indent + 1, lines)
				if not node.get("children", {}).get("else", []).is_empty():
					lines.append("%selse:" % pad)
					_append_asset_text(node.get("children", {}).get("else", []), indent + 1, lines)
			"let": lines.append("%slet %s = %s%s" % [pad, node.get("params", {}).get("name", "value"), _format_source_expression(node.get("params", {}).get("value", {})), anchor])
			"do", "await": lines.append("%s%s %s(%s)%s" % [pad, node.get("command_id", "do"), node.get("params", {}).get("capability", ""), _format_source_arguments(node.get("params", {}).get("args", {})), anchor])
			"motion_intent":
				var arguments: Array[String] = []
				for key in node.get("params", {}).get("args", {}).keys():
					arguments.append("%s: %s" % [key, _format_source_expression(node.params.args[key])])
				lines.append("%sintent %s(%s)%s" % [pad, node.get("params", {}).get("intent", ""), ", ".join(arguments), anchor])
			"publish": lines.append("%spublish %s(%s)%s" % [pad, node.get("params", {}).get("topic", ""), _format_source_expression(node.get("params", {}).get("payload", {})), anchor])

func _format_source_arguments(arguments: Dictionary) -> String:
	var formatted: Array[String] = []
	for key in arguments.keys():
		formatted.append("%s: %s" % [key, _format_source_expression(arguments[key])])
	return ", ".join(formatted)

func _format_source_expression(value: Variant) -> String:
	if value is Dictionary:
		if value.has("ref"):
			return String(value.ref)
		if value.has("op"):
			var operator := String(value.op)
			var left := _format_source_expression(value.get("left", value.get("value", null)))
			var right := _format_source_expression(value.get("right", null))
			if operator == "not":
				return "not %s" % left
			if operator == "negate":
				return "-%s" % left
			return "%s %s %s" % [left, operator, right]
	return JSON.stringify(value)
