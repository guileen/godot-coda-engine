@tool
extends VBoxContainer

var _editor_interface: EditorInterface
var _undo_redo: EditorUndoRedoManager
var _store := CODA_AssetStore.new()
var _event_list := ItemList.new()
var _tree := Tree.new()
var _toolbar := HBoxContainer.new()
var _editor_tabs := TabContainer.new()
var _status := Label.new()
var _name_edit := LineEdit.new()
var _slot_select := OptionButton.new()
var _command_search := LineEdit.new()
var _command_select := OptionButton.new()
var _command_description := Label.new()
var _inspector := VBoxContainer.new()
var _inspector_title := Label.new()
var _inspector_hint := Label.new()
var _condition_edit := TextEdit.new()
var _condition_left_select: OptionButton
var _condition_operator_select: OptionButton
var _condition_right_edit: LineEdit
var _condition_advanced_toggle: CheckButton
var _condition_simple_panel: VBoxContainer
var _condition_advanced_panel: VBoxContainer
var _text_import_panel := PanelContainer.new()
var _text_import_edit := TextEdit.new()
var _text_import_status := Label.new()
var _text_import_diff := RichTextLabel.new()
var _text_transaction := CODA_TextTransaction.new()
var _text_import_candidate: Dictionary = {}
var _draft_param_controls: Dictionary = {}
var _draft_action_arg_controls: Dictionary = {}
var _draft_action_args_container: VBoxContainer
var _draft_capability_select: OptionButton
var _let_name_edit: LineEdit
var _let_expression_edit: LineEdit
var _let_expression_row: Control
var _let_advanced_toggle: CheckButton
var _let_advanced_edit: TextEdit
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
	"if": {"label": "条件分支", "description": "按一个条件分成“满足条件”和“否则”两条路。", "fields": ["condition"]},
	"let": {"label": "计算变量", "description": "用一个算式得到新结果，供后续步骤继续使用。", "fields": ["name", "value"]},
	"read": {"label": "读取信息", "description": "从角色或界面读取一个信息，并给它起个流程内名称。", "fields": ["target", "field", "bind"]},
	"do": {"label": "执行动作", "description": "立即执行一个已登记动作，然后继续下一步。", "fields": ["capability", "args"]},
	"await": {"label": "等待动作", "description": "执行一个动作，并等它完成后再继续下一步。", "fields": ["capability", "args"]},
	"publish": {"label": "发送通知", "description": "把本流程的结果通知给订阅这个事件的其他流程。", "fields": ["topic", "payload"]},
	"return": {"label": "结束流程", "description": "结束当前流程；可以把一个结果交还给调用方。", "fields": ["value"]},
	"escape": {"label": "调用受限代码", "description": "高级用法：调用受限代码。一般玩法流程不需要此步骤。", "fields": ["inputs", "outputs", "code"]},
}

const DRAFT_GUIDANCE := {
	"if": "在下面选择要检查的值、比较方式和目标值，然后确认。",
	"let": "给结果起名并填写算式，例如：新积分 = 当前积分 + 奖励。",
	"read": "选择读取对象和字段，再给读出的值起名。",
	"do": "选择已登记动作，再按动作说明填写参数。",
	"await": "选择可等待的动作并填写参数；动作完成后流程才会继续。",
	"publish": "填写通知类型和要发送的内容。",
	"return": "填写要交还给调用方的结果；没有结果时填 null。",
	"escape": "仅用于受限代码步骤；填写声明过的输入、输出和代码。",
}

const MORE_ACTIONS := {
	"reload_external": 1, "recover_transaction": 2, "text_import": 3,
	"migrate": 4, "new_embodied": 5, "delete": 6, "duplicate": 7,
	"move_up": 8, "move_down": 9, "undo": 10, "redo": 11,
	"commit_projection": 12, "cancel_projection": 13, "source_map": 14,
	"inspect_generated": 15, "diagnostics": 16, "refresh": 17,
}
const CONDITION_OPERATORS := ["==", "!=", ">", ">=", "<", "<="]

func configure(editor_interface: EditorInterface) -> void:
	_editor_interface = editor_interface
	_undo_redo = editor_interface.get_editor_undo_redo()

func _ready() -> void:
	add_theme_constant_override("separation", 6)
	var title := Label.new()
	title.text = "CODA 事件"
	title.add_theme_font_size_override("font_size", 16)
	add_child(title)
	_toolbar.add_child(_button("新建事件", _new_event))
	var more_button := MenuButton.new()
	more_button.text = "更多操作"
	_build_more_menu(more_button.get_popup())
	_toolbar.add_child(more_button)
	add_child(_toolbar)
	var name_row := HBoxContainer.new()
	var name_label := Label.new()
	name_label.text = "流程名称"
	name_row.add_child(name_label)
	_name_edit.placeholder_text = "给这个流程起个名字"
	_name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_row.add_child(_name_edit)
	name_row.add_child(_button("改名", _rename_selected))
	add_child(name_row)
	var insert_section := VBoxContainer.new()
	var insert_title := Label.new()
	insert_title.text = "添加步骤"
	insert_title.add_theme_font_size_override("font_size", 14)
	insert_section.add_child(insert_title)
	var insert_help := Label.new()
	insert_help.text = "① 先在流程里选一个步骤（默认接在它后面；没选时放到末尾）；② 选步骤类型和位置，再点“添加步骤”；③ 按“步骤设置”里的提示填写并确认。未确认前不会改动原流程。"
	insert_help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	insert_help.add_theme_color_override("font_color", get_theme_color("font_color", "Label").lerp(Color.TRANSPARENT, 0.25))
	insert_section.add_child(insert_help)
	_command_search.placeholder_text = "按名称找步骤，例如“条件分支”"
	_command_search.tooltip_text = "输入步骤名称筛选列表；选中后还要确认插入位置。"
	_command_search.text_changed.connect(func(_text: String): _refresh_command_options())
	insert_section.add_child(_labeled_control("找步骤", _command_search))
	_slot_select.tooltip_text = "选中流程步骤时，可插在它前面或后面；否则放到流程末尾。"
	_command_select.tooltip_text = "选择新步骤要完成的动作"
	insert_section.add_child(_labeled_control("放在", _slot_select))
	insert_section.add_child(_labeled_control("做什么", _command_select))
	_command_description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_command_description.add_theme_color_override("font_color", get_theme_color("font_color", "Label").lerp(Color.TRANSPARENT, 0.2))
	insert_section.add_child(_command_description)
	_command_select.item_selected.connect(func(_index: int): _update_command_description())
	var add_step := _button("添加步骤", _insert_draft_node)
	insert_section.add_child(add_step)
	add_child(insert_section)
	_event_list.custom_minimum_size.y = 100
	_event_list.item_selected.connect(_on_event_selected)
	add_child(_event_list)
	_tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_tree.item_selected.connect(_on_tree_selected)
	_tree.custom_minimum_size.y = 220
	var flow_page := VBoxContainer.new()
	var flow_hint := Label.new()
	flow_hint.text = "选择一个步骤查看或修改；分支会显示在步骤下方。"
	flow_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	flow_page.add_child(flow_hint)
	_tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	flow_page.add_child(_tree)
	var edit_page := ScrollContainer.new()
	edit_page.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_inspector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inspector.custom_minimum_size.x = 0
	_inspector_title.text = "节点检查器"
	_inspector.add_child(_inspector_title)
	_inspector_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_inspector.add_child(_inspector_hint)
	edit_page.add_child(_inspector)
	_editor_tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_editor_tabs.add_child(flow_page)
	_editor_tabs.set_tab_title(0, "流程")
	_editor_tabs.add_child(edit_page)
	_editor_tabs.set_tab_title(1, "步骤设置")
	_editor_tabs.current_tab = 0
	add_child(_editor_tabs)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_status)
	_build_text_import_panel()
	_refresh_command_options()
	_reload()
	set_process(true)

func _labeled_control(label_text: String, control: Control) -> HBoxContainer:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = label_text
	label.custom_minimum_size.x = 58
	row.add_child(label)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(control)
	return row

func _build_more_menu(menu: PopupMenu) -> void:
	menu.add_item("刷新流程列表", MORE_ACTIONS.refresh)
	menu.add_separator()
	menu.add_item("重载所选流程", MORE_ACTIONS.reload_external)
	menu.add_item("导入流程文本…", MORE_ACTIONS.text_import)
	menu.add_item("恢复中断的保存", MORE_ACTIONS.recover_transaction)
	menu.add_separator()
	menu.add_item("新建具身事件…", MORE_ACTIONS.new_embodied)
	menu.add_item("迁移到 CODA 源…", MORE_ACTIONS.migrate)
	menu.add_separator()
	menu.add_item("删除所选步骤", MORE_ACTIONS.delete)
	menu.add_item("复制所选步骤", MORE_ACTIONS.duplicate)
	menu.add_item("上移所选步骤", MORE_ACTIONS.move_up)
	menu.add_item("下移所选步骤", MORE_ACTIONS.move_down)
	menu.add_separator()
	menu.add_item("撤销", MORE_ACTIONS.undo)
	menu.add_item("重做", MORE_ACTIONS.redo)
	menu.add_separator()
	menu.add_item("确认已预览的修改", MORE_ACTIONS.commit_projection)
	menu.add_item("取消预览", MORE_ACTIONS.cancel_projection)
	menu.add_separator()
	menu.add_item("显示代码位置", MORE_ACTIONS.source_map)
	menu.add_item("检查生成文件", MORE_ACTIONS.inspect_generated)
	menu.add_item("显示诊断详情", MORE_ACTIONS.diagnostics)
	menu.id_pressed.connect(_on_more_action)

func _on_more_action(action_id: int) -> void:
	if action_id == MORE_ACTIONS.refresh: _reload()
	elif action_id == MORE_ACTIONS.reload_external: _reload_selected_from_disk()
	elif action_id == MORE_ACTIONS.recover_transaction: _recover_selected_transaction()
	elif action_id == MORE_ACTIONS.text_import: _open_text_import()
	elif action_id == MORE_ACTIONS.migrate: _migrate_selected_to_text_owned()
	elif action_id == MORE_ACTIONS.new_embodied: _new_embodied_event()
	elif action_id == MORE_ACTIONS.delete: _delete_selected_node()
	elif action_id == MORE_ACTIONS.duplicate: _copy_selected_node()
	elif action_id == MORE_ACTIONS.move_up: _move_selected_node(-1)
	elif action_id == MORE_ACTIONS.move_down: _move_selected_node(1)
	elif action_id == MORE_ACTIONS.undo: _undo_change()
	elif action_id == MORE_ACTIONS.redo: _redo_change()
	elif action_id == MORE_ACTIONS.commit_projection: _commit_projection_preview()
	elif action_id == MORE_ACTIONS.cancel_projection: _cancel_projection_preview()
	elif action_id == MORE_ACTIONS.source_map: _show_source_map_location()
	elif action_id == MORE_ACTIONS.inspect_generated: _inspect_managed_artifact()
	elif action_id == MORE_ACTIONS.diagnostics: _show_diagnostic_context()

func _button(label: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = label
	button.pressed.connect(callback)
	return button

func _reload() -> void:
	_event_list.clear()
	_asset_paths.clear()
	var dir := DirAccess.open("res://coda/events")
	if dir == null:
		_status.text = "未找到 res://coda/events；创建 EventAsset 后刷新。"
		return
	dir.list_dir_begin()
	var filename := dir.get_next()
	while not filename.is_empty():
		if not dir.current_is_dir() and filename.ends_with(".gse.json"):
			var asset_path := "res://coda/events/" + filename
			_asset_paths.append(asset_path)
			var loaded := _store.load_asset(asset_path)
			var title := String(loaded.asset.get("display_name", filename.trim_suffix(".gse.json"))) if loaded.receipt.ok else filename.trim_suffix(".gse.json")
			_event_list.add_item(title)
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
	_editor_tabs.current_tab = 0
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
	var command_id := String(node.get("command_id", ""))
	var fallback_label := String(COMMAND_DEFINITIONS.get(command_id, {}).get("label", "步骤"))
	var display_label := String(labels.get("zh-CN", labels.get("en", fallback_label)))
	var summary := _flow_summary(node)
	item.set_text(0, display_label if summary.is_empty() else "%s：%s" % [display_label, summary])
	var description := String(projection_node.get("descriptions", {}).get("zh-CN", fallback_label))
	item.set_tooltip_text(0, description if summary.is_empty() else "%s\n%s" % [description, summary])
	item.set_metadata(0, String(node.get("node_id", "")))
	var children: Dictionary = node.get("children", {})
	for slot in children.keys():
		var branch := _tree.create_item(item)
		branch.set_text(0, "满足条件时" if slot == "then" else "否则")
		branch.set_selectable(0, false)
		branch.set_metadata(0, "")
		for child in children[slot]:
			_add_node(branch, child)

func _flow_summary(node: Dictionary) -> String:
	var command_id := String(node.get("command_id", ""))
	var params: Dictionary = node.get("params", {})
	match command_id:
		"if": return _condition_summary(params.get("condition", {}))
		"read": return "%s.%s → %s" % [_reference_label(params.get("target", {}).get("ref", "对象")), params.get("field", "字段"), params.get("bind", "结果")]
		"let": return "%s → %s" % [_value_summary(params.get("value", {})), params.get("name", "新值")]
		"await", "do":
			var capability := String(params.get("capability", ""))
			var args: Dictionary = params.get("args", {})
			if capability.begins_with("ui.animate_number"):
				return "%s → %s · %s 秒" % [_value_summary(args.get("from", {})), _value_summary(args.get("to", {})), args.get("duration", 0)]
			if capability.begins_with("ui.remove_node"): return "移除旧奖励条目"
			if capability.begins_with("ui.create_reward_row"): return "显示新积分"
			if capability.begins_with("ui.set_text"): return "显示 +新积分"
		"publish": return "奖励结算通知"
	return ""

func _condition_summary(condition) -> String:
	if not condition is Dictionary or condition.is_empty():
		return "请设置条件"
	if condition.has_all(["left", "op", "right"]):
		return "%s %s %s" % [_value_summary(condition.left), _condition_operator_label(String(condition.op)), _value_summary(condition.right)]
	return _value_summary(condition)

func _value_summary(value) -> String:
	if value is Dictionary:
		if value.has("ref"):
			return _reference_label(value.get("ref", ""))
		if value.has("left") and value.has("op") and value.has("right"):
			return "%s %s %s" % [_value_summary(value.left), value.op, _value_summary(value.right)]
		if value.has("items") and value.get("op") == "connect":
			var parts: Array[String] = []
			for part in value.items: parts.append(_value_summary(part))
			return "".join(parts)
	if value is Array:
		var array_parts: Array[String] = []
		for part in value: array_parts.append(_value_summary(part))
		return "、".join(array_parts)
	return str(value)

func _reference_label(reference) -> String:
	var ref := String(reference)
	var friendly := {"reward": "奖励", "target_hud": "积分界面", "old_row": "旧奖励条目", "old_score": "当前积分", "new_score": "新积分", "new_row": "新奖励条目"}
	if friendly.has(ref): return friendly[ref]
	for argument in _selected_asset.get("args", []):
		if String(argument.get("id", "")) == ref:
			return String(argument.get("name", ref))
	return ref

func _on_tree_selected() -> void:
	var item := _tree.get_selected()
	if item == null or String(item.get_metadata(0)).is_empty():
		return
	_selected_node_id = String(item.get_metadata(0))
	var selected := _find_node((_draft_asset if not _draft_asset.is_empty() else _selected_asset).get("root", []), _selected_node_id)
	var label := String(COMMAND_DEFINITIONS.get(String(selected.get("command_id", "")), {}).get("label", "步骤"))
	_status.text = "已选中：%s" % label
	_editor_tabs.current_tab = 1
	_render_inspector()
	_refresh_slot_options()

func _refresh_command_options() -> void:
	var selected_command := ""
	if _command_select.selected >= 0:
		selected_command = String(_command_select.get_item_metadata(_command_select.selected))
	var needle := _command_search.text.strip_edges().to_lower() if _command_search != null else ""
	_command_select.clear()
	_command_select.add_item("请选择要添加的步骤…")
	_command_select.set_item_metadata(0, "")
	_command_select.select(0)
	for command_id in COMMAND_DEFINITIONS.keys():
		var definition: Dictionary = COMMAND_DEFINITIONS[command_id]
		var label := String(definition.get("label", ""))
		if not needle.is_empty() and not label.to_lower().contains(needle) and not String(command_id).to_lower().contains(needle):
			continue
		_command_select.add_item(label)
		_command_select.set_item_metadata(_command_select.item_count - 1, command_id)
		if String(command_id) == selected_command:
			_command_select.select(_command_select.item_count - 1)
	_update_command_description()

func _update_command_description() -> void:
	if _command_description == null:
		return
	if _command_select.selected < 0:
		_command_description.text = "选好步骤类型后，这里会说明它的作用。"
		return
	var command_id := String(_command_select.get_item_metadata(_command_select.selected))
	if command_id.is_empty():
		_command_description.text = "选好步骤类型后，这里会说明它的作用。"
		return
	var definition: Dictionary = COMMAND_DEFINITIONS.get(command_id, {})
	_command_description.text = String(definition.get("description", "按步骤设置页的提示填写内容。"))

func _refresh_slot_options() -> void:
	_slot_select.clear()
	var view_asset := _draft_asset if not _draft_asset.is_empty() else _selected_asset
	var selected := _find_node(view_asset.get("root", []), _selected_node_id)
	if not selected.is_empty() and _draft_asset.is_empty():
		var selected_id := String(selected.get("node_id", ""))
		var label := String(COMMAND_DEFINITIONS.get(String(selected.get("command_id", "")), {}).get("label", "所选步骤"))
		_slot_select.add_item("接在“%s”后面（推荐）" % label)
		_slot_select.set_item_metadata(_slot_select.item_count - 1, {"position": "after", "anchor_id": selected_id})
		_slot_select.add_item("插在“%s”前面" % label)
		_slot_select.set_item_metadata(_slot_select.item_count - 1, {"position": "before", "anchor_id": selected_id})
	_slot_select.add_item("流程末尾")
	_slot_select.set_item_metadata(_slot_select.item_count - 1, {"parent_id": "", "slot": "root"})
	if not selected.is_empty() and selected.get("command_id") == "if":
		for slot in ["then", "else"]:
			_slot_select.add_item("条件成立时" if slot == "then" else "条件不成立时")
			_slot_select.set_item_metadata(_slot_select.item_count - 1, {"parent_id": _selected_node_id, "slot": slot})
	_slot_select.select(0)

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
	_let_name_edit = null
	_let_expression_edit = null
	_let_expression_row = null
	_let_advanced_toggle = null
	_let_advanced_edit = null
	var view_asset := _draft_asset if not _draft_asset.is_empty() else _selected_asset
	var node := _find_node(view_asset.get("root", []), _selected_node_id)
	if node.is_empty():
		_inspector_hint.text = "选择节点后显示稳定 node_id、摘要和待定字段。"
		return
	var command_id := String(node.get("command_id", ""))
	var definition: Dictionary = COMMAND_DEFINITIONS.get(command_id, {})
	var projection_node := _projection_node(_selected_node_id)
	var projection_labels: Dictionary = projection_node.get("labels", {})
	var friendly_name := String(projection_labels.get("zh-CN", definition.get("label", "流程步骤")))
	var descriptions: Dictionary = projection_node.get("descriptions", {})
	_inspector_hint.text = friendly_name
	if not descriptions.is_empty():
		_inspector_hint.text += "\n" + String(descriptions.get("zh-CN", ""))
	if command_id == "if" and not node.get("draft", false):
		_render_condition_editor(node)
		_render_projection_preview_confirmation()
		return
	if command_id == "let":
		_render_let_expression_editor(node)
		if node.get("draft", false):
			_add_draft_confirm_actions()
		elif not _projection_preview_diff.is_empty():
			_render_projection_preview_confirmation()
		else:
			_inspector.add_child(_button("预览计算修改", _preview_let_edit))
		return
	if command_id == "read" and node.get("draft", false):
		_render_read_draft_editor()
		_add_draft_confirm_actions()
		return
	if not node.get("draft", false):
		_render_projection_slots(projection_node)
		return
	var pending: Array = definition.get("fields", [])
	if pending.is_empty():
		var unsupported := Label.new()
		unsupported.text = "这个步骤类型目前不能通过图形方式补全。"
		_inspector.add_child(unsupported)
		return
	var pending_label := Label.new()
	pending_label.text = "%s\n确认后才会写入流程；取消会丢弃这一步。" % String(DRAFT_GUIDANCE.get(command_id, "按下面提示填写内容。"))
	pending_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_inspector.add_child(pending_label)
	if command_id == "if":
		_render_condition_editor(node)
		_add_draft_confirm_actions()
		return
	if command_id in ["do", "await"]:
		_render_draft_action_editor(command_id)
		_add_draft_confirm_actions()
		return
	var field_labels := {
		"condition": "成立条件", "name": "结果名称", "value": "计算内容",
		"target": "操作对象", "field": "读取哪个字段", "bind": "保存为",
		"capability": "动作类型", "args": "动作参数（结构化）",
		"topic": "通知类型", "payload": "通知内容", "inputs": "传入内容",
		"outputs": "输出内容", "code": "代码内容",
	}
	var field_examples := {
		"name": "例如：new_score",
		"target": "例如：target_hud",
		"field": "例如：score",
		"bind": "例如：current_score",
		"topic": "例如：combat.hit_resolved@1",
		"payload": "填写通知内容；复杂内容请使用完整表达式。",
		"inputs": "填写已声明的输入内容。",
		"outputs": "填写已声明的输出内容。",
		"code": "仅供受限代码使用；一般流程无需填写。",
	}
	for field in pending:
		var row := HBoxContainer.new()
		var label := Label.new()
		label.text = String(field_labels.get(String(field), String(field)))
		label.custom_minimum_size.x = 80
		row.add_child(label)
		var edit := LineEdit.new()
		edit.placeholder_text = "填写 %s" % label.text
		if field_examples.has(String(field)):
			edit.placeholder_text = String(field_examples[String(field)])
		edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(edit)
		_inspector.add_child(row)
		_draft_param_controls[field] = edit
	_add_draft_confirm_actions()

func _render_let_expression_editor(node: Dictionary) -> void:
	var params: Dictionary = node.get("params", {})
	var value = params.get("value", {})
	var draft: bool = bool(node.get("draft", false))
	var example := _let_expression_example()
	var guide := Label.new()
	guide.text = "给结果起个名称，再写怎么算。例：%s。" % example
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_inspector.add_child(guide)
	_let_name_edit = LineEdit.new()
	_let_name_edit.placeholder_text = "例如：新积分"
	_let_name_edit.tooltip_text = "后续步骤可以用这个名称读取计算结果。"
	_let_name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_let_name_edit.text = String(params.get("name", ""))
	_inspector.add_child(_labeled_control("结果名称", _let_name_edit))
	_let_expression_edit = LineEdit.new()
	_let_expression_edit.placeholder_text = "例如：%s" % example
	_let_expression_edit.tooltip_text = "可用数字、双引号文字和前面步骤产生的值；支持 +、-、*、/。复杂表达式可切换高级模式。"
	_let_expression_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_let_expression_edit.text = "" if draft and not params.has("value") else _expression_to_author_text(value)
	_let_expression_row = _labeled_control("怎么算", _let_expression_edit)
	_inspector.add_child(_let_expression_row)
	_let_advanced_toggle = CheckButton.new()
	_let_advanced_toggle.text = "高级表达式（JSON）"
	_let_advanced_toggle.button_pressed = not draft and params.has("value") and not _is_simple_author_expression(value)
	_inspector.add_child(_let_advanced_toggle)
	_let_advanced_edit = TextEdit.new()
	_let_advanced_edit.custom_minimum_size.y = 82
	_let_advanced_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_let_advanced_edit.placeholder_text = "复杂表达式 JSON；普通计算不需要使用此项。"
	_let_advanced_edit.tooltip_text = "供需要编辑嵌套表达式的开发者使用。"
	_let_advanced_edit.text = JSON.stringify(value)
	_let_advanced_edit.visible = _let_advanced_toggle.button_pressed
	_inspector.add_child(_let_advanced_edit)
	_let_expression_row.visible = not _let_advanced_toggle.button_pressed
	_let_advanced_toggle.toggled.connect(func(enabled: bool):
		_let_expression_row.visible = not enabled
		_let_advanced_edit.visible = enabled
	)
	if draft:
		guide.text = "① 给结果起名称；② 写计算式；③ 确认后才加入流程。例：%s。" % example

func _let_expression_example() -> String:
	var references := _author_expression_references()
	if references.has("old_score") and references.has("reward"):
		return "当前积分 + 奖励"
	return "1 + 2"

func _render_read_draft_editor() -> void:
	var guide := Label.new()
	guide.text = "选择一个对象和要读取的字段，再给结果起名。例：积分界面 → score → 当前积分。"
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_inspector.add_child(guide)
	var target := OptionButton.new()
	target.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	target.add_item("选择一个对象…")
	target.set_item_metadata(0, {})
	for argument in _selected_asset.get("args", []):
		if String(argument.get("type", "")) != "NodeRef": continue
		var reference := String(argument.get("id", ""))
		target.add_item(String(argument.get("name", _reference_label(reference))))
		target.set_item_metadata(target.item_count - 1, {"ref": reference})
	if target.item_count == 1:
		var empty := Label.new()
		empty.text = "当前流程没有可选对象；需要先声明一个对象参数。"
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_inspector.add_child(empty)
	_inspector.add_child(_labeled_control("读取哪个对象", target))
	_draft_param_controls["target"] = target
	for field in ["field", "bind"]:
		var edit := LineEdit.new()
		edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if field == "field":
			edit.placeholder_text = "例如：score"
			_inspector.add_child(_labeled_control("读取哪个字段", edit))
		else:
			edit.placeholder_text = "例如：当前积分"
			_inspector.add_child(_labeled_control("结果名称", edit))
		_draft_param_controls[field] = edit

func _is_simple_author_expression(value) -> bool:
	if value is Dictionary and value.has("ref"):
		return true
	if value is Dictionary and value.has_all(["left", "op", "right"]):
		return value.left is Dictionary and value.left.has("ref") and _is_simple_author_operand(value.right) and String(value.op) in ["+", "-", "*", "/"]
	return _is_simple_author_operand(value)

func _is_simple_author_operand(value) -> bool:
	return value is Dictionary and value.has("ref") or value is String or value is int or value is float or value is bool

func _expression_to_author_text(value) -> String:
	if value is Dictionary and value.has("ref"):
		return _reference_label(String(value.get("ref", "")))
	if value is Dictionary and value.has_all(["left", "op", "right"]):
		return "%s %s %s" % [_expression_to_author_text(value.left), String(value.op), _expression_to_author_text(value.right)]
	if value is String:
		return JSON.stringify(value)
	if value == null:
		return ""
	return str(value)

func _author_expression_references() -> Dictionary:
	var result := {}
	for argument in _selected_asset.get("args", []):
		var reference := String(argument.get("id", ""))
		if reference.is_empty(): continue
		result[reference] = reference
		result[String(argument.get("name", reference))] = reference
		result[_reference_label(reference)] = reference
	_collect_author_expression_references(_selected_asset.get("root", []), result)
	return result

func _collect_author_expression_references(nodes: Array, references: Dictionary) -> void:
	for node in nodes:
		var params: Dictionary = node.get("params", {})
		var possible_bindings := [params.get("name", ""), params.get("bind", ""), params.get("args", {}).get("bind", "")]
		for candidate in possible_bindings:
			var reference := String(candidate)
			if reference.is_empty(): continue
			references[reference] = reference
			references[_reference_label(reference)] = reference
		for children in node.get("children", {}).values():
			_collect_author_expression_references(children, references)

func _parse_author_operand(text: String) -> Dictionary:
	var operand := text.strip_edges()
	if operand.is_empty(): return {"ok": false, "message": "请填写计算内容。"}
	var references := _author_expression_references()
	if references.has(operand): return {"ok": true, "value": {"ref": references[operand]}}
	if operand in ["true", "false", "null"]:
		return {"ok": true, "value": JSON.parse_string(operand)}
	if operand.is_valid_int() or operand.is_valid_float(): return {"ok": true, "value": float(operand)}
	if operand.begins_with("\""):
		var parsed = JSON.parse_string(operand)
		if parsed is String: return {"ok": true, "value": parsed}
		return {"ok": false, "message": "文字内容请用双引号括起，例如 \"奖励已领取\"。"}
	return {"ok": false, "message": "找不到“%s”。请使用已有流程值，或将文字用双引号括起。" % operand}

func _parse_author_expression(text: String) -> Dictionary:
	var expression := text.strip_edges()
	var operation_regex := RegEx.new()
	operation_regex.compile("^(.+?)\\s*(加|减|乘以|除以|\\+|\\-|\\*|/)\\s*(.+)$")
	var match_result := operation_regex.search(expression)
	if match_result == null:
		return _parse_author_operand(expression)
	var left := _parse_author_operand(match_result.get_string(1))
	if not left.ok: return left
	var right := _parse_author_operand(match_result.get_string(3))
	if not right.ok: return right
	var operator := match_result.get_string(2)
	var operator_map := {"加": "+", "减": "-", "乘以": "*", "除以": "/"}
	return {"ok": true, "value": {"left": left.value, "op": String(operator_map.get(operator, operator)), "right": right.value}}

func _read_let_editor() -> Dictionary:
	if _let_name_edit == null or _let_advanced_toggle == null:
		return {"ok": false, "message": "计算步骤编辑器尚未准备好。"}
	var name := _let_name_edit.text.strip_edges()
	if name.is_empty() or name.contains(" "):
		return {"ok": false, "message": "请填写不含空格的结果名称。"}
	var parsed: Dictionary
	if _let_advanced_toggle.button_pressed:
		var value = JSON.parse_string(_let_advanced_edit.text)
		if value == null and _let_advanced_edit.text.strip_edges() != "null":
			return {"ok": false, "message": "高级表达式 JSON 格式无效。"}
		parsed = {"ok": true, "value": value}
	else:
		parsed = _parse_author_expression(_let_expression_edit.text)
	if not parsed.ok: return parsed
	return {"ok": true, "name": name, "value": parsed.value}

func _preview_let_edit() -> void:
	var edited := _read_let_editor()
	if not edited.ok:
		_status.text = "%s；尚未修改流程。" % edited.message
		return
	var next := _selected_asset.duplicate(true)
	var node := _find_node(next.get("root", []), _selected_node_id)
	if node.is_empty() or String(node.get("command_id", "")) != "let":
		_status.text = "当前选择不是计算步骤；尚未修改流程。"
		return
	var before: Dictionary = node.get("params", {}).duplicate(true)
	var params: Dictionary = node.get("params", {}).duplicate(true)
	params["name"] = edited.name
	params["value"] = edited.value
	node["params"] = params
	var generated_preview := _preview_generated_diff(next)
	if not generated_preview.ok:
		_status.text = "计算预览失败：%s；尚未修改流程。" % generated_preview.message
		return
	_projection_pending_asset = next
	_projection_pending_slot_id = "%s.expression" % _selected_node_id
	_projection_preview_diff = "计算步骤修改预览：\n- %s = %s\n+ %s = %s\n\n%s\n确认前不会写入流程。" % [before.get("name", ""), _expression_to_author_text(before.get("value", {})), edited.name, _expression_to_author_text(edited.value), generated_preview.message]
	_render_inspector()
	_status.text = "计算结果和生成代码已预览；确认后才会保存。"

func _render_condition_editor(node: Dictionary) -> void:
	var current = node.get("params", {}).get("condition", {})
	var simple: bool = false
	if current is Dictionary:
		simple = current.is_empty()
	if not simple:
		simple = _is_simple_condition(current)
	var current_left = current.get("left") if current is Dictionary else null
	var current_operator := String(current.get("op", "==")) if current is Dictionary else "=="
	var current_right = current.get("right") if current is Dictionary else null
	var heading := Label.new()
	heading.text = "只有满足下面条件，才会运行“满足条件时”分支。"
	heading.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_inspector.add_child(heading)
	_condition_simple_panel = VBoxContainer.new()
	_condition_simple_panel.add_theme_constant_override("separation", 4)
	_condition_left_select = OptionButton.new()
	_condition_left_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_condition_left_select.add_item("选择一个已有的值…")
	_condition_left_select.set_item_metadata(0, {})
	var refs := _condition_references()
	var selected_left_index := 0
	for entry in refs:
		_condition_left_select.add_item(String(entry.label))
		_condition_left_select.set_item_metadata(_condition_left_select.item_count - 1, entry)
		if current_left is Dictionary and String(current_left.get("ref", "")) == String(entry.id):
			selected_left_index = _condition_left_select.item_count - 1
	if not current_left == null and not _condition_left_is_listed(current_left, refs):
		_condition_left_select.add_item("当前固定值：%s" % _condition_operand_label(current_left))
		_condition_left_select.set_item_metadata(_condition_left_select.item_count - 1, {"kind": "literal", "value": current_left, "type": _condition_value_type(current_left)})
		selected_left_index = _condition_left_select.item_count - 1
	_condition_left_select.select(selected_left_index)
	_condition_simple_panel.add_child(_labeled_control("判断哪个值", _condition_left_select))
	_condition_operator_select = OptionButton.new()
	for operator in CONDITION_OPERATORS:
		_condition_operator_select.add_item(_condition_operator_label(operator))
		_condition_operator_select.set_item_metadata(_condition_operator_select.item_count - 1, operator)
	for operator_index in _condition_operator_select.item_count:
		if String(_condition_operator_select.get_item_metadata(operator_index)) == current_operator:
			_condition_operator_select.select(operator_index)
			break
	_condition_simple_panel.add_child(_labeled_control("关系", _condition_operator_select))
	_condition_right_edit = LineEdit.new()
	_condition_right_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_condition_right_edit.placeholder_text = "例如 0、true、金币 或已有值名称"
	_condition_right_edit.tooltip_text = "输入常量，或输入前面步骤已经产生的值名称。"
	if current is Dictionary and current.has("right"):
		_condition_right_edit.text = _condition_operand_label(current_right)
	_condition_simple_panel.add_child(_labeled_control("比较对象", _condition_right_edit))
	_inspector.add_child(_condition_simple_panel)
	_condition_advanced_toggle = CheckButton.new()
	_condition_advanced_toggle.text = "高级表达式（JSON）"
	_condition_advanced_toggle.button_pressed = not simple
	_inspector.add_child(_condition_advanced_toggle)
	_condition_advanced_panel = VBoxContainer.new()
	_condition_edit = TextEdit.new()
	_condition_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_condition_edit.custom_minimum_size.y = 82
	_condition_edit.text = JSON.stringify(current)
	_condition_edit.placeholder_text = "填写完整的条件表达式 JSON"
	_condition_edit.tooltip_text = "面向熟悉 CODA 表达式结构的开发者。"
	_condition_advanced_panel.add_child(_condition_edit)
	if not node.get("draft", false):
		_condition_advanced_panel.add_child(_button("预览条件修改", _apply_condition_edit))
	_condition_advanced_panel.visible = not simple
	_inspector.add_child(_condition_advanced_panel)
	_condition_simple_panel.visible = simple
	_condition_advanced_toggle.toggled.connect(_set_condition_advanced_mode)
	_condition_left_select.item_selected.connect(func(_index: int): _refresh_condition_operator_choices(current_operator))
	_condition_operator_select.item_selected.connect(func(_index: int): _update_condition_operator_hint())
	_refresh_condition_operator_choices(current_operator)
	_update_condition_operator_hint()
	if not node.get("draft", false) and simple:
		_condition_simple_panel.add_child(_button("预览条件修改", _apply_condition_edit))

func _set_condition_advanced_mode(enabled: bool) -> void:
	if _condition_simple_panel != null:
		_condition_simple_panel.visible = not enabled
	if _condition_advanced_panel != null:
		_condition_advanced_panel.visible = enabled

func _condition_references() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var seen := {}
	for argument in _selected_asset.get("args", []):
		var ref := String(argument.get("id", ""))
		if ref.is_empty() or seen.has(ref): continue
		seen[ref] = true
		result.append({"kind": "ref", "id": ref, "label": String(argument.get("name", ref)), "type": String(argument.get("type", "Any"))})
	_collect_condition_references(_selected_asset.get("root", []), result, seen)
	return result

func _collect_condition_references(nodes: Array, result: Array[Dictionary], seen: Dictionary) -> void:
	for node in nodes:
		var params: Dictionary = node.get("params", {})
		var candidates := [params.get("name", ""), params.get("bind", ""), params.get("args", {}).get("bind", "")]
		for value in candidates:
			var ref := String(value)
			if ref.is_empty() or seen.has(ref): continue
			seen[ref] = true
			result.append({"kind": "ref", "id": ref, "label": "流程值：%s" % _reference_label(ref), "type": "Any"})
		for children in node.get("children", {}).values():
			_collect_condition_references(children, result, seen)

func _condition_left_is_listed(value, refs: Array[Dictionary]) -> bool:
	if not value is Dictionary or not value.has("ref"):
		return false
	for entry in refs:
		if String(entry.get("id", "")) == String(value.get("ref", "")):
			return true
	return false

func _is_simple_condition(value) -> bool:
	if not value is Dictionary or not value.has_all(["left", "op", "right"]):
		return false
	if String(value.get("op", "")) not in CONDITION_OPERATORS:
		return false
	return _is_simple_condition_operand(value.left) and _is_simple_condition_operand(value.right)

func _is_simple_condition_operand(value) -> bool:
	if value is Dictionary:
		return value.size() == 1 and value.has("ref")
	return value is String or value is int or value is float or value is bool

func _condition_operand_label(value) -> String:
	if value is Dictionary and value.has("ref"):
		return String(value.get("ref", ""))
	if value is String:
		return value
	return JSON.stringify(value)

func _condition_value_type(value) -> String:
	if value is bool: return "Bool"
	if value is int: return "Int"
	if value is float: return "Float"
	if value is String: return "Text"
	if value is Dictionary and value.has("ref"):
		for argument in _selected_asset.get("args", []):
			if String(argument.get("id", "")) == String(value.ref): return String(argument.get("type", "Any"))
	return "Any"

func _condition_operator_label(operator: String) -> String:
	return {"==": "等于", "!=": "不等于", ">": "大于", ">=": "大于或等于", "<": "小于", "<=": "小于或等于"}.get(operator, operator)

func _refresh_condition_operator_choices(preferred_operator: String) -> void:
	if _condition_operator_select == null or _condition_left_select == null:
		return
	var selected_left = _condition_left_select.get_item_metadata(_condition_left_select.selected) if _condition_left_select.selected >= 0 else {}
	var value_type := String(selected_left.get("type", "Any")) if selected_left is Dictionary else "Any"
	var operators := CONDITION_OPERATORS if value_type in ["Int", "Float", "Duration", "Any"] else ["==", "!="]
	_condition_operator_select.clear()
	for operator in operators:
		_condition_operator_select.add_item(_condition_operator_label(operator))
		_condition_operator_select.set_item_metadata(_condition_operator_select.item_count - 1, operator)
	var selected_operator := false
	for index in _condition_operator_select.item_count:
		if String(_condition_operator_select.get_item_metadata(index)) == preferred_operator:
			_condition_operator_select.select(index)
			selected_operator = true
			break
	if not selected_operator and _condition_operator_select.item_count > 0:
		_condition_operator_select.select(0)
	_update_condition_operator_hint()

func _update_condition_operator_hint() -> void:
	if _condition_right_edit == null or _condition_operator_select == null:
		return
	var operator := String(_condition_operator_select.get_item_metadata(_condition_operator_select.selected)) if _condition_operator_select.selected >= 0 else "=="
	_condition_right_edit.tooltip_text = "“%s”右侧填常量或已有流程值。" % _condition_operator_label(operator)

func _read_condition_editor() -> Dictionary:
	if _condition_advanced_toggle != null and _condition_advanced_toggle.button_pressed:
		var parsed = JSON.parse_string(_condition_edit.text)
		if parsed is Dictionary and not parsed.is_empty():
			return {"ok": true, "value": parsed}
		return {"ok": false, "message": "高级条件需要完整的 JSON 表达式。"}
	if _condition_left_select == null or _condition_operator_select == null or _condition_right_edit == null:
		return {"ok": false, "message": "条件编辑器尚未准备好。"}
	var left_index := _condition_left_select.selected
	if left_index < 0:
		return {"ok": false, "message": "请选择左侧要判断的值。"}
	var left_data = _condition_left_select.get_item_metadata(left_index)
	if not left_data is Dictionary or left_data.is_empty():
		return {"ok": false, "message": "请选择左侧要判断的值。"}
	var right_text := _condition_right_edit.text.strip_edges()
	if right_text.is_empty():
		return {"ok": false, "message": "请填写要比较的值。"}
	var right = _parse_condition_operand(right_text)
	if not right.ok:
		return right
	var operator := String(_condition_operator_select.get_item_metadata(_condition_operator_select.selected))
	var left = left_data.get("value") if left_data.get("kind") == "literal" else {"ref": left_data.get("id", "")}
	var left_type := String(left_data.get("type", "Any"))
	var right_type := _condition_value_type(right.value)
	if operator in [">", ">=", "<", "<="] and left_type not in ["Int", "Float", "Duration", "Any"]:
		return {"ok": false, "message": "当前值类型不能使用数值比较。"}
	if left_type != "Any" and right_type != "Any" and left_type != right_type and not (left_type in ["Int", "Float"] and right_type in ["Int", "Float"]):
		return {"ok": false, "message": "两侧值类型不一致，请检查条件。"}
	return {"ok": true, "value": {"left": left, "op": operator, "right": right.value}}

func _parse_condition_operand(text: String) -> Dictionary:
	if _is_flow_symbol(text):
		return {"ok": true, "value": {"ref": text}}
	if text in ["true", "false", "null"] or text.is_valid_float() or text.is_valid_int():
		var parsed = JSON.parse_string(text)
		return {"ok": true, "value": parsed}
	if text.begins_with("\"") or text.begins_with("{") or text.begins_with("["):
		var parsed = JSON.parse_string(text)
		if parsed != null:
			return {"ok": true, "value": parsed}
		return {"ok": false, "message": "文本常量请用双引号括起。"}
	return {"ok": true, "value": text}

func _preview_condition_edit() -> void:
	var parsed := _read_condition_editor()
	if not parsed.ok:
		_status.text = "%s；尚未修改流程。" % parsed.message
		return
	var next := _selected_asset.duplicate(true)
	var node := _find_node(next.get("root", []), _selected_node_id)
	if node.is_empty() or node.get("command_id") != "if":
		_status.text = "当前选择不是条件分支；尚未修改流程。"
		return
	var before = node.get("params", {}).get("condition", {})
	var params: Dictionary = node.get("params", {}).duplicate(true)
	params["condition"] = parsed.value
	node["params"] = params
	var generated_preview := _preview_generated_diff(next)
	if not generated_preview.ok:
		_status.text = "条件预览失败：%s；尚未修改流程。" % generated_preview.message
		return
	_projection_pending_asset = next
	_projection_pending_slot_id = "%s.condition" % _selected_node_id
	_projection_preview_diff = "条件修改预览：\n- %s\n+ %s\n\n%s\n确认前不会写入流程。" % [_value_summary(before), _value_summary(parsed.value), generated_preview.message]
	_render_inspector()
	_status.text = "条件和生成结果已经预览；确认后才会保存。"

func _render_projection_preview_confirmation() -> void:
	if _projection_preview_diff.is_empty():
		return
	var diff := RichTextLabel.new()
	diff.bbcode_enabled = false
	diff.custom_minimum_size.y = 80
	diff.text = _projection_preview_diff
	_inspector.add_child(diff)
	var preview_actions := HBoxContainer.new()
	preview_actions.add_child(_button("确认这个修改", _commit_projection_preview))
	preview_actions.add_child(_button("保留原样", _cancel_projection_preview))
	_inspector.add_child(preview_actions)

func _add_draft_confirm_actions() -> void:
	var draft_actions := HBoxContainer.new()
	draft_actions.add_child(_button("确认这一步", _confirm_draft))
	draft_actions.add_child(_button("取消", _cancel_draft))
	_inspector.add_child(draft_actions)

func _render_draft_action_editor(command_id: String) -> void:
	var manifest_path := ProjectSettings.globalize_path("res://contracts/coda/capabilities.json")
	var manifest_text := FileAccess.get_file_as_string(manifest_path)
	var manifest = JSON.parse_string(manifest_text)
	if not manifest is Dictionary:
		var warning := Label.new()
		warning.text = "无法读取动作目录；这一步不能安全保存。"
		_inspector.add_child(warning)
		return
	_draft_capability_select = OptionButton.new()
	_draft_capability_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_draft_capability_select.add_item("选择已登记的动作…")
	_draft_capability_select.set_item_metadata(0, "")
	for capability in manifest.get("capabilities", []):
		if String(capability.get("kind", "")) != "capability":
			continue
		if command_id == "await" and not bool(capability.get("awaitable", false)):
			continue
		var capability_id := "%s@%d" % [capability.get("id", ""), capability.get("version", 1)]
		_draft_capability_select.add_item(_capability_label(capability_id))
		_draft_capability_select.set_item_metadata(_draft_capability_select.item_count - 1, capability_id)
	var row := _labeled_control("动作", _draft_capability_select)
	_inspector.add_child(row)
	_draft_action_args_container = VBoxContainer.new()
	_draft_action_args_container.add_theme_constant_override("separation", 4)
	_inspector.add_child(_draft_action_args_container)
	_draft_capability_select.item_selected.connect(func(_index: int): _render_draft_action_args(manifest))
	_draft_action_arg_controls.clear()

func _render_draft_action_args(manifest: Dictionary) -> void:
	for child in _draft_action_args_container.get_children():
		child.queue_free()
	_draft_action_arg_controls.clear()
	if _draft_capability_select == null or _draft_capability_select.selected < 0:
		return
	var capability_id := String(_draft_capability_select.get_item_metadata(_draft_capability_select.selected))
	if capability_id.is_empty():
		return
	var capability: Dictionary = {}
	for candidate in manifest.get("capabilities", []):
		if "%s@%d" % [candidate.get("id", ""), candidate.get("version", 1)] == capability_id:
			capability = candidate
			break
	if capability.is_empty():
		return
	var guide := Label.new()
	guide.text = String(_capability_description(capability_id))
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_draft_action_args_container.add_child(guide)
	var alias_slots := _capability_slots(capability_id)
	for argument in capability.get("params", []):
		var field_id := String(argument.get("id", ""))
		var type := String(argument.get("type", "Any"))
		var alias_slot: Dictionary = alias_slots.get(field_id, {})
		var slot_labels: Dictionary = alias_slot.get("label", {})
		var label_text := String(slot_labels.get("zh-CN", field_id))
		var edit := LineEdit.new()
		edit.placeholder_text = _draft_placeholder(type)
		edit.tooltip_text = "数据类型：%s。普通名称会绑定到已声明的流程值；数字可以直接填写。" % type
		edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_draft_action_args_container.add_child(_labeled_control(label_text, edit))
		_draft_action_arg_controls[field_id] = {"control": edit, "type": type, "label": label_text}
	if capability.get("result", "Void") != "Void":
		var bind := LineEdit.new()
		bind.placeholder_text = "可选：把结果保存为一个名称"
		bind.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_draft_action_args_container.add_child(_labeled_control("保存结果", bind))
		_draft_action_arg_controls["__bind"] = {"control": bind, "type": "Binding", "label": "保存结果"}

func _draft_placeholder(type: String) -> String:
	match type:
		"NodeRef": return "节点或流程值名称，例如 target_hud"
		"Int": return "整数或已定义的流程值，例如 10 / new_score"
		"Float", "Duration": return "数字，例如 0.35"
		"Text": return "要显示的文字"
		_: return "填写这个参数"

func _capability_slots(capability_id: String) -> Dictionary:
	var path := ProjectSettings.globalize_path("res://coda/fixtures/ui.reward.apply.alias-registry.json")
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	var result: Dictionary = {}
	if not parsed is Dictionary:
		return result
	for layer in parsed.get("layers", {}).values():
		for item in layer:
			if String(item.get("target_id", "")) == "capability:" + capability_id:
				return item.get("slots", {})
	return result

func _capability_label(capability_id: String) -> String:
	var path := ProjectSettings.globalize_path("res://coda/fixtures/ui.reward.apply.alias-registry.json")
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		for layer in parsed.get("layers", {}).values():
			for item in layer:
				if String(item.get("target_id", "")) == "capability:" + capability_id:
					var group_parts := PackedStringArray()
					for group_name in item.get("group_path", []): group_parts.append(String(group_name))
					var group := " → ".join(group_parts)
					var label := String(item.get("labels", {}).get("zh-CN", capability_id))
					return "%s · %s" % [group, label] if not group.is_empty() else label
	return capability_id

func _capability_description(capability_id: String) -> String:
	var path := ProjectSettings.globalize_path("res://coda/fixtures/ui.reward.apply.alias-registry.json")
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		for layer in parsed.get("layers", {}).values():
			for item in layer:
				if String(item.get("target_id", "")) == "capability:" + capability_id:
					return String(item.get("descriptions", {}).get("zh-CN", ""))
	return "填写下面列出的动作参数。"

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
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/coda-cli.js")
	var asset_path := ProjectSettings.globalize_path(_selected_path)
	var alias_path := ProjectSettings.globalize_path("res://coda/fixtures/ui.reward.apply.alias-registry.json")
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
				select.add_item(_reference_label(String(allowed_ref)))
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
		var preview_actions := HBoxContainer.new()
		preview_actions.add_child(_button("确认这个修改", _commit_projection_preview))
		preview_actions.add_child(_button("保留原样", _cancel_projection_preview))
		_inspector.add_child(preview_actions)

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
	var temp_asset := "/tmp/coda-projection-preview-%s.gse.json" % stamp
	var temp_generated := "/tmp/coda-projection-preview-%s.gd" % stamp
	var file := FileAccess.open(temp_asset, FileAccess.WRITE)
	if file == null:
		return {"ok": false, "message": "无法创建临时生成预览文件。"}
	file.store_string(JSON.stringify(asset, "  ") + "\n")
	file.close()
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/coda-cli.js")
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
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/coda-cli.js")
	var asset_path := ProjectSettings.globalize_path(_selected_path)
	var exit_code := OS.execute("node", [cli, "generate", asset_path], output, true)
	return {"ok": exit_code == 0, "message": " ".join(output)}

func _generated_path() -> String:
	return "res://.coda/generated/%s.gd" % String(_selected_asset.get("event_id", "")).replace(".", "_")

func _source_map_path() -> String:
	return "%s.map.json" % _generated_path()

func _show_source_map_location() -> void:
	var path := _source_map_path()
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		_status.text = "未找到 source map；请先生成 CODA 流程。"
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
	if (first_line.begins_with("# GENERATED BY CODA.") or first_line.begins_with("# GENERATED BY GSEOS.")) and first_line.contains("event="):
		_status.text = "受管生成物完整；手改检测通过。"
		return
	_status.text = "检测到受管文件被手改；请恢复生成物或显式接管。"
	var restore := _button("恢复受管生成物", _restore_generated_artifact)
	_inspector.add_child(restore)

func _restore_generated_artifact() -> void:
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/coda-cli.js")
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
	var position := String(slot.get("position", ""))
	if position in ["before", "after"]:
		return _insert_relative(asset.get("root", []), String(slot.get("anchor_id", "")), node, position == "before")
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

func _insert_relative(nodes: Array, anchor_id: String, node: Dictionary, before: bool) -> bool:
	for index in nodes.size():
		var current: Dictionary = nodes[index]
		if String(current.get("node_id", "")) == anchor_id:
			nodes.insert(index if before else index + 1, node)
			return true
		var children: Dictionary = current.get("children", {})
		for child_slot in children.keys():
			var child_nodes: Array = children[child_slot]
			if _insert_relative(child_nodes, anchor_id, node, before):
				children[child_slot] = child_nodes
				current["children"] = children
				nodes[index] = current
				return true
	return false

func _new_event() -> void:
	var index := 1
	var path := "res://coda/events/new-event.gse.json"
	while FileAccess.file_exists(path):
		index += 1
		path = "res://coda/events/new-event-%d.gse.json" % index
	var asset := {"asset_type": "EventAsset", "schema_version": 1, "event_id": "ui.new.event.%d" % index, "display_name": "新事件", "args": [], "reentry": "reject", "recovery": "E0", "root": []}
	if not _write_asset_transaction(path, {}, asset, "创建 CODA 事件"):
		return
	_reload()

func _new_embodied_event() -> void:
	var index := 1
	var asset_path := "res://coda/events/embodied-event.gse.json"
	var source_path := "res://coda/events/embodied-event.coda"
	while FileAccess.file_exists(asset_path) or FileAccess.file_exists(source_path) or FileAccess.file_exists(asset_path + ".ownership.json"):
		index += 1
		asset_path = "res://coda/events/embodied-event-%d.gse.json" % index
		source_path = "res://coda/events/embodied-event-%d.coda" % index
	var event_id := "embodied.event.%d" % index
	var asset := {"asset_type": "EventAsset", "schema_version": 1, "event_id": event_id, "display_name": "具身事件", "args": [], "recovery": "E0", "root": []}
	var source_text := _asset_to_gse_text(asset)
	var saved := _store.save_text_owned_asset(asset_path, source_path, source_text, asset, -1, "")
	if not saved.saved:
		_status.text = _format_diagnostics(saved.receipt.get("diagnostics", []))
		return
	_selected_path = asset_path
	_reload()
	var selected_index := _asset_paths.find(asset_path)
	if selected_index >= 0: _on_event_selected(selected_index)
	_status.text = "已创建 text_owned 具身事件；CODA 源是唯一作者。"

func _rename_selected() -> void:
	if _selected_path.is_empty() or _selected_asset.is_empty():
		return
	var next := _selected_asset.duplicate(true)
	var name := _name_edit.text.strip_edges()
	if name.is_empty():
		_status.text = "显示名不能为空；未写入资产。"
		return
	next.display_name = name
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "重命名 CODA 事件"):
		return
	_selected_asset = next
	_update_disk_modified_time()
	_rebuild_tree()

func _insert_draft_node() -> void:
	if _selected_path.is_empty() or _selected_asset.is_empty():
		_status.text = "先在流程列表选择一个事件，再添加步骤；当前内容没有改变。"
		return
	if not _draft_asset.is_empty():
		_status.text = "已有未确认 draft；请先确认或取消。"
		return
	var command_id := _selected_command_id()
	var slot := _selected_slot()
	if command_id.is_empty() or slot.is_empty():
		_status.text = "先选择插入位置和步骤类型；流程尚未改变。"
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
	_editor_tabs.current_tab = 1
	_status.text = "步骤已临时放入流程树。请在“步骤设置”页按 ①②③ 填写并确认；未确认前不会写入原流程。"

func _confirm_draft() -> void:
	if _draft_asset.is_empty() or _draft_node_id.is_empty():
		return
	var draft := _find_node(_draft_asset.root, _draft_node_id)
	if draft.is_empty():
		_cancel_draft()
		return
	var params: Dictionary = {}
	if String(draft.get("command_id", "")) in ["do", "await"]:
		if _draft_capability_select == null or _draft_capability_select.selected <= 0:
			_status.text = "先选一个已登记的动作；流程尚未保存。"
			return
		var capability_id := String(_draft_capability_select.get_item_metadata(_draft_capability_select.selected))
		var action_args: Dictionary = {}
		for field_id in _draft_action_arg_controls:
			var field: Dictionary = _draft_action_arg_controls[field_id]
			var text := String(field.control.text).strip_edges()
			if String(field.type) == "Binding":
				if not text.is_empty(): params["bind"] = text
				continue
			if text.is_empty():
				_status.text = "请填写“%s”；流程尚未保存。" % field.label
				return
			var parsed := _parse_typed_draft_value(text, String(field.type))
			if not parsed.ok:
				_status.text = "%s：%s；流程尚未保存。" % [field.label, parsed.message]
				return
			action_args[String(field_id)] = parsed.value
		params["capability"] = capability_id
		params["args"] = action_args
	elif String(draft.get("command_id", "")) == "let":
		var edited := _read_let_editor()
		if not edited.ok:
			_status.text = "%s；流程尚未保存。" % edited.message
			return
		params["name"] = edited.name
		params["value"] = edited.value
	elif String(draft.get("command_id", "")) == "if":
		var parsed_condition := _read_condition_editor()
		if not parsed_condition.ok:
			_status.text = "%s；流程尚未保存。" % parsed_condition.message
			return
		params["condition"] = parsed_condition.value
	else:
		for field in _draft_param_controls.keys():
			var control: Control = _draft_param_controls[field]
			if control is OptionButton:
				var select := control as OptionButton
				if select.selected <= 0:
					_status.text = "请选择要读取的对象；流程尚未保存。"
					return
				params[field] = select.get_item_metadata(select.selected)
				continue
			var text := String((control as LineEdit).text).strip_edges()
			if text.is_empty():
				_status.text = "请补全“%s”；流程尚未保存。" % field
				return
			var parsed = _parse_inspector_value(text)
			params[field] = parsed
	draft["params"] = params
	draft.erase("draft")
	if not _write_asset_transaction(_selected_path, _selected_asset, _draft_asset, "确认 CODA 草稿步骤"):
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

func _parse_typed_draft_value(text: String, type: String) -> Dictionary:
	if type == "NodeRef":
		return {"ok": true, "value": {"ref": text}}
	if type == "Int":
		if text.is_valid_int(): return {"ok": true, "value": int(text)}
		if _is_flow_symbol(text): return {"ok": true, "value": {"ref": text}}
		return {"ok": false, "message": "请填整数或前面步骤产生的名称"}
	if type in ["Float", "Duration"]:
		if text.is_valid_float(): return {"ok": true, "value": float(text)}
		if _is_flow_symbol(text): return {"ok": true, "value": {"ref": text}}
		return {"ok": false, "message": "请填数字或前面步骤产生的名称"}
	if type == "Text":
		return {"ok": true, "value": text}
	return {"ok": true, "value": _parse_inspector_value(text)}

func _is_flow_symbol(name: String) -> bool:
	for argument in _selected_asset.get("args", []):
		if String(argument.get("id", "")) == name: return true
	return _collect_flow_symbols(_selected_asset.get("root", []), name)

func _collect_flow_symbols(nodes: Array, name: String) -> bool:
	for node in nodes:
		var params: Dictionary = node.get("params", {})
		if String(params.get("name", "")) == name or String(params.get("bind", "")) == name:
			return true
		if String(params.get("args", {}).get("bind", "")) == name:
			return true
		for children in node.get("children", {}).values():
			if _collect_flow_symbols(children, name): return true
	return false

func _cancel_draft() -> void:
	if _draft_asset.is_empty():
		return
	_draft_asset = {}
	_draft_node_id = ""
	_selected_node_id = ""
	_rebuild_tree()
	_refresh_slot_options()
	_status.text = "已取消新增步骤；原流程未改变。"

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
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "删除 CODA 步骤"):
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
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "复制 CODA 步骤"):
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
	if not _write_asset_transaction(_selected_path, _selected_asset, next, "移动 CODA 步骤"):
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
	_preview_condition_edit()

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

func _recover_selected_transaction() -> void:
	if _selected_path.is_empty():
		_status.text = "请先选择发生事务中断的 EventAsset。"
		return
	var recovered := _store.recover_transaction(_selected_path)
	if not recovered.ok:
		_status.text = _format_diagnostics(recovered.receipt.get("diagnostics", []))
		return
	var index := _asset_paths.find(_selected_path)
	if index >= 0: _on_event_selected(index)
	if recovered.recovery == "completed":
		_status.text = "已完成中断前已提交的 authoring 事务，并清理恢复日志。"
	else:
		_status.text = "已回滚未完成的 authoring 事务并恢复其上一致版本。"

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

func _migrate_selected_to_text_owned() -> void:
	if _selected_asset.is_empty() or _selected_ownership.get("authoring_mode", "graph_owned") != "graph_owned":
		_status.text = "仅 graph_owned 资产可执行显式迁移。"
		return
	if not _can_format_asset_to_gse(_selected_asset.get("root", [])):
		_status.text = "当前资产含文本投影器不支持的节点/分支；迁移已拒绝。"
		return
	var source_path := _selected_path.trim_suffix(".gse.json") + ".coda"
	if FileAccess.file_exists(source_path):
		_status.text = "迁移目标 CODA 源已存在；为避免覆盖，迁移已拒绝。"
		return
	var source_text := _asset_to_gse_text(_selected_asset)
	var temp_path := "res://.coda/migration-%d.coda" % Time.get_ticks_msec()
	var file := FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		_status.text = "无法创建迁移校验暂存文件；原资产未改变。"
		return
	file.store_string(source_text)
	file.close()
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/coda-cli.js")
	var exit_code := OS.execute("node", [cli, "parse", ProjectSettings.globalize_path(temp_path)], output, true)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(temp_path))
	var parsed = JSON.parse_string("\n".join(output))
	if exit_code != 0 or not parsed is Dictionary or not parsed.get("receipt", {}).get("ok", false) or not parsed.get("asset") is Dictionary:
		_status.text = "迁移源未通过 CODA parse；原资产未改变。"
		return
	var candidate: Dictionary = parsed.asset.duplicate(true)
	candidate["recovery"] = _selected_asset.get("recovery", "E0")
	var migrated := _store.save_text_owned_asset(_selected_path, source_path, source_text, candidate, int(_selected_ownership.get("owner_revision", -1)), String(_selected_ownership.get("source", {}).get("fingerprint", "")))
	if not migrated.saved:
		_status.text = _format_diagnostics(migrated.receipt.get("diagnostics", []))
		return
	_selected_asset = migrated.asset
	_selected_ownership = migrated.ownership
	_rebuild_tree()
	_refresh_slot_options()
	_status.text = "已显式迁移为 text_owned；CODA 源现为唯一作者，EventAsset 仅作派生投影。"

func _cancel_text_import() -> void:
	_text_transaction.cancel()
	_text_import_candidate = {}
	_text_import_panel.visible = false
	_text_import_diff.text = ""

func _preview_text_import() -> void:
	if _selected_asset.is_empty():
		return
	var temp_path := "res://.coda/text-import-%d.gse" % Time.get_ticks_msec()
	var file := FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		_text_import_status.text = "无法创建文本 draft；资产未改变。"
		return
	file.store_string(_text_import_edit.text)
	file.close()
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/coda-cli.js")
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
	var attributes: Array[String] = ["id: " + event_id]
	if asset.has("reentry"): attributes.append("reentry: " + String(asset.reentry))
	if asset.has("recovery"): attributes.append("recovery: " + String(asset.recovery))
	var header_attributes := " [%s]" % ", ".join(attributes)
	var header := "event %s(%s)%s:" % [display_name, ", ".join(argument_names), header_attributes] if not argument_names.is_empty() else "event %s%s:" % [display_name, header_attributes]
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
