extends Control

const CAPABILITY_REGISTRY := preload("res://addons/gseos/runtime/capability_registry.gd")
const EVENT_REGISTRY := preload("res://addons/gseos/runtime/event_registry.gd")
const REWARD_RUNNER := preload("res://addons/gseos/runtime/reward_event_runner.gd")

var capability_registry: GSEOS_CapabilityRegistry
var event_registry: GSEOS_EventRegistry
var hud: PanelContainer
var score_label: Label
var reward_history: VBoxContainer
var status_label: Label
var reward_button: Button
var reset_button: Button
var _running := false
var received_payload: Dictionary = {}
var _accent := Color("74d6a0")
var _panel := Color("172338")

func _ready() -> void:
	_build_interface()
	capability_registry = CAPABILITY_REGISTRY.new()
	event_registry = EVENT_REGISTRY.new()
	var runner := REWARD_RUNNER.new(capability_registry, event_registry)
	event_registry.register("ui.reward.apply", Callable(runner, "run"), "reject")
	event_registry.subscribe("combat.hit_resolved@1", Callable(self, "_on_hit_resolved"))
	_reset_example()

func _exit_tree() -> void:
	if event_registry != null:
		event_registry.clear()
	if capability_registry != null:
		capability_registry.clear()

func _build_interface() -> void:
	var background := ColorRect.new()
	background.color = Color("0c1322")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(680.0, 0.0)
	column.add_theme_constant_override("separation", 18)
	center.add_child(column)
	var eyebrow := Label.new()
	eyebrow.text = "CODA · 可直接体验的流程样例"
	eyebrow.add_theme_color_override("font_color", _accent)
	column.add_child(eyebrow)
	var title := Label.new()
	title.text = "领取关卡奖励"
	title.add_theme_font_size_override("font_size", 34)
	column.add_child(title)
	var explanation := Label.new()
	explanation.text = "点击领取后，积分会从 100 动画增加到 125；旧奖励条目会被替换，结算结果会显示在下方。"
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	explanation.add_theme_color_override("font_color", Color("b2bfd2"))
	column.add_child(explanation)
	hud = PanelContainer.new()
	hud.custom_minimum_size = Vector2(0.0, 174.0)
	hud.add_theme_stylebox_override("panel", _make_panel_style())
	column.add_child(hud)
	var hud_column := VBoxContainer.new()
	hud_column.add_theme_constant_override("separation", 12)
	hud.add_child(hud_column)
	score_label = Label.new()
	score_label.name = "ScoreValue"
	score_label.add_theme_font_size_override("font_size", 32)
	hud_column.add_child(score_label)
	var divider := HSeparator.new()
	hud_column.add_child(divider)
	reward_history = VBoxContainer.new()
	reward_history.name = "RewardHistory"
	hud_column.add_child(reward_history)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	column.add_child(actions)
	reward_button = Button.new()
	reward_button.text = "领取奖励  +25"
	reward_button.custom_minimum_size = Vector2(210.0, 48.0)
	reward_button.pressed.connect(_claim_reward)
	actions.add_child(reward_button)
	reset_button = Button.new()
	reset_button.text = "重置样例"
	reset_button.custom_minimum_size = Vector2(120.0, 48.0)
	reset_button.pressed.connect(_reset_example)
	actions.add_child(reset_button)
	status_label = Label.new()
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.custom_minimum_size.y = 72.0
	status_label.add_theme_color_override("font_color", Color("b2bfd2"))
	column.add_child(status_label)
	var flow := Label.new()
	flow.text = "流程：读取当前积分 → 加上奖励 → 播放数值变化 → 替换奖励条目 → 发布结算结果"
	flow.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	flow.add_theme_color_override("font_color", Color("8d9bb0"))
	column.add_child(flow)

func _claim_reward() -> void:
	if event_registry == null or not is_instance_valid(hud):
		return
	reward_button.disabled = true
	reset_button.disabled = true
	_running = true
	status_label.text = "正在结算：数值动画完成后，奖励条目会更新。"
	var handle := event_registry.start("ui.reward.apply", {"reward": 25, "target_hud": hud}, hud)
	handle.completed.connect(_on_reward_completed)

func _on_reward_completed(result: Dictionary) -> void:
	reward_button.disabled = false
	reset_button.disabled = false
	_running = false
	var value: Dictionary = result.get("value", {})
	if result.get("status") == "COMPLETED":
		status_label.text = "结算完成：当前积分 %s；通知已发布。" % value.get("score", "?")
		status_label.add_theme_color_override("font_color", _accent)
	else:
		status_label.text = "结算未完成：%s" % result.get("reason", result.get("status", "未知原因"))
		status_label.add_theme_color_override("font_color", Color("ff8e8e"))

func _on_hit_resolved(payload: Dictionary) -> Dictionary:
	received_payload = payload.duplicate(true)
	var receipt := Label.new()
	receipt.text = "结算通知：奖励 +%s · 新积分 %s" % [payload.get("damage", "?"), payload.get("score", "?")]
	receipt.add_theme_color_override("font_color", Color("92c6ff"))
	reward_history.add_child(receipt)
	return {"ok": true}

func _reset_example() -> void:
	if _running or not is_instance_valid(hud):
		return
	for child in reward_history.get_children():
		child.free()
	hud.set_meta("_gseos_fields", {"score": 100})
	score_label.text = "积分：100"
	var old_row := Label.new()
	old_row.name = "OldRewardRow"
	old_row.text = "上一条奖励：完成关卡 +10"
	old_row.add_theme_color_override("font_color", Color("b2bfd2"))
	reward_history.add_child(old_row)
	status_label.text = "准备就绪。点击“领取奖励”观察整个流程。"
	status_label.add_theme_color_override("font_color", Color("b2bfd2"))
	reward_button.disabled = false
	received_payload = {}

func _make_panel_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = _panel
	style.border_color = Color("30415b")
	style.set_border_width_all(1)
	style.set_corner_radius_all(12)
	style.content_margin_left = 20.0
	style.content_margin_right = 20.0
	style.content_margin_top = 18.0
	style.content_margin_bottom = 18.0
	return style
