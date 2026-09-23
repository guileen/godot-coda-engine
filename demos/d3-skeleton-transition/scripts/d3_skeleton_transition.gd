extends Node3D

## D3 uses the real AIBI/GDBot mesh and Skeleton3D.  This scene is a visual
## evidence harness for bounded intent transition, not a physics backend.

const GDBOT_SCENE := preload("res://addons/gdquest_gdbot/gdbot_skin.tscn")
const EXPRESSION_ADAPTER_SCRIPT := preload("res://scripts/d3_expression_adapter.gd")
const ROBOT_ADAPTER_SCRIPT := preload("res://scripts/gdbot_robot_adapter.gd")
const AIBI_ADAPTER_BRIDGE_SCRIPT := preload("res://scripts/coda_aibi_robot_adapter_bridge.gd")
const SAFE_NEUTRAL_POSE := {"head_pitch": 0.0, "head_yaw": 0.0, "head_roll": 0.0}

var gdbot: Node3D
var skeleton: Skeleton3D
var face: Node
var expression_adapter: Node
var robot_adapter: Variant
var camera: Camera3D
var status_label: Label
var trace_label: Label
var gate_label: Label
var timeline: ProgressBar
var attack_button: Button
var guard_button: Button
var interrupt_button: Button
var external_writer_button: Button
var owner_lost_button: Button
var reset_button: Button
var current_intent := "idle"
var transition_generation := 0
var lease_owner := "none"
var decision_entries: Array[String] = []
var observation_entries: Array[String] = []
var motion_plans: Dictionary = {}
var motion_plan: Dictionary = {}
var plan_loaded := false
var _active_priority := -1
var _pending_plan: Dictionary = {}
var external_writer_active := false
var owner_valid := true
var adapter_receipt: Dictionary = {
	"backend": "godot.motion@1",
	"execution_authority": "adapter_only",
	"barrier": "pending",
	"start": "pending",
	"terminal": "pending"
}
var expression_receipt: Dictionary = {}

func _ready() -> void:
	_build_world()
	_build_character()
	_build_robot_adapter()
	_build_expression_adapter()
	_build_overlay()
	_load_motion_plan()
	_record_decision("READY", "D3 fixture loaded; Skeleton3D ownership available")

func _process(delta: float) -> void:
	if robot_adapter == null:
		return
	robot_adapter.tick(delta)
	_sync_demo_controls()
	if timeline != null:
		timeline.value = robot_adapter.progress() * 100.0

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_A: request_intent("robot.attack_recover@1")
			KEY_D: request_intent("robot.high_guard@1")
			KEY_I: request_intent("interrupt")
			KEY_X: set_external_writer_active(true)
			KEY_O: owner_lost()
			KEY_R: reset_fixture()
			KEY_H: request_expression("happy")
			KEY_N: request_expression("default")
			KEY_Z: request_expression("dizzy")

func request_intent(intent: String) -> void:
	if intent == "interrupt":
		_interrupt_to_safe("user_interrupt")
		return
	if robot_adapter == null or not plan_loaded:
		_record_decision("REJECT", "CODA MotionIntent plan unavailable; no Adapter write")
		_update_panel("red", "REJECTED")
		return
	if not owner_valid:
		_record_decision("REJECT", "owner lost; no Adapter write")
		adapter_receipt["barrier"] = "owner_lost"
		adapter_receipt["terminal"] = "owner_lost"
		_update_panel("red", "REJECTED / OWNER LOST")
		return
	if external_writer_active:
		_record_decision("REJECT", "external writer active; ownership barrier denied; no generation change")
		adapter_receipt["barrier"] = "rejected"
		adapter_receipt["terminal"] = "rejected"
		_update_panel("red", "REJECTED / EXTERNAL WRITER")
		return
	var artifact: Dictionary = motion_plans.get(intent, {})
	if artifact.is_empty():
		_record_decision("REJECT", "没有找到该意图对应的已生成 TransitionPlan")
		adapter_receipt["terminal"] = "rejected"
		_update_panel("red", "REJECTED / PLAN MISSING")
		return
	if robot_adapter.is_executing():
		var requested_priority := int(artifact.get("motion_envelope", {}).get("priority", 0))
		if requested_priority <= _active_priority:
			_record_decision("REJECT", "现有意图优先级不低于新请求")
			return
		_pending_plan = artifact
		_interrupt_to_safe("priority_preemption", true)
		return
	_start_plan(artifact)

func _start_plan(artifact: Dictionary) -> void:
	var plan: Dictionary = artifact.get("transition_plan", {})
	if not robot_adapter.can_start_plan(plan):
		_record_decision("REJECT", "计划起点与 Adapter 当前姿态不一致；拒绝写入")
		adapter_receipt["barrier"] = "rejected"
		adapter_receipt["terminal"] = "rejected"
		_update_panel("red", "REJECTED / START STATE")
		return
	transition_generation += 1
	lease_owner = "coda.transition.%d" % transition_generation
	var admitted_plan := plan.duplicate(true)
	# The generated plan is an immutable motion decision; the runtime binds it to this fresh lease epoch.
	admitted_plan["lease"]["generation"] = transition_generation
	var submitted: Dictionary = robot_adapter.submit_transition_plan(admitted_plan, transition_generation)
	if not submitted.get("ok", false):
		_record_decision("ADAPTER_REJECT", String(submitted.get("error", "unknown")))
		adapter_receipt["barrier"] = "rejected"
		adapter_receipt["terminal"] = "rejected"
		_update_panel("red", "REJECTED / ADAPTER")
		return
	motion_plan = artifact
	current_intent = String(artifact.get("source_asset", "motion_intent"))
	_active_priority = int(artifact.get("motion_envelope", {}).get("priority", 0))
	adapter_receipt["barrier"] = "accepted"
	adapter_receipt["start"] = "started"
	adapter_receipt["terminal"] = "pending"
	adapter_receipt["plan_id"] = plan.get("plan_id", "")
	_record_decision("GENERATED_PLAN", "%s → %s" % [artifact.get("source_asset", ""), plan.get("plan_id", "")])
	_record_observation("adapter_start", "generation=%d segments=%d" % [transition_generation, plan.get("segments", []).size()])
	_update_panel("blue", "EXECUTING GENERATED PLAN")

func _interrupt_to_safe(reason: String, preserve_pending := false) -> void:
	if robot_adapter == null or not owner_valid:
		return
	_record_decision("INTERRUPT", "%s; revoke generation %d" % [reason, transition_generation])
	var revoked_generation := transition_generation
	transition_generation += 1
	lease_owner = "coda.safety.%d" % transition_generation
	if not preserve_pending:
		_pending_plan = {}
	adapter_receipt["barrier"] = "revoked"
	adapter_receipt["terminal"] = "preempted"
	var recovery: Dictionary = robot_adapter.interrupt_to(SAFE_NEUTRAL_POSE, transition_generation, 320)
	if not recovery.get("ok", false):
		adapter_receipt["barrier"] = "rejected"
		adapter_receipt["terminal"] = "rejected"
		_record_decision("RECOVERY_REJECT", String(recovery.get("error", "unknown")))
		_update_panel("red", "RECOVERY REJECTED")
		return
	current_intent = "安全收敛"
	adapter_receipt["start"] = "recovery_started"
	_record_observation("generation_revoked", "generation=%d" % revoked_generation)
	_update_panel("blue", "SAFE CONVERGENCE")

func request_expression(expression_name: String) -> void:
	if not plan_loaded or not owner_valid or external_writer_active:
		_record_decision("EXPRESSION_REJECT", "%s blocked by plan/owner/external writer" % expression_name)
		return
	if not expression_adapter.acquire():
		expression_receipt = expression_adapter.last_receipt
		_record_decision("EXPRESSION_REJECT", "%s ownership barrier" % expression_name)
		return
	if expression_adapter.apply_expression(expression_name):
		expression_receipt = expression_adapter.last_receipt
		_record_observation("expression", "%s generation=%d" % [expression_name, expression_receipt.get("generation", 0)])
		_update_panel("green", "EXPRESSION %s" % expression_name.to_upper())
	else:
		expression_receipt = expression_adapter.last_receipt
		_record_decision("EXPRESSION_REJECT", "%s Adapter rejection" % expression_name)

func reset_fixture() -> void:
	transition_generation = 0
	lease_owner = "none"
	external_writer_active = false
	owner_valid = true
	if expression_adapter != null:
		expression_adapter.reset()
		expression_receipt = expression_adapter.last_receipt
	if robot_adapter != null:
		robot_adapter.reset()
	_active_priority = -1
	_pending_plan = {}
	current_intent = "idle"
	_sync_demo_controls()
	_record_decision("RESET", "fixture reset; no stale generation may write")

func set_external_writer_active(active: bool) -> void:
	external_writer_active = active
	_sync_demo_controls()
	if active:
		_record_observation("ownership", "external writer active; next request must reject")

func owner_lost() -> void:
	owner_valid = false
	_sync_demo_controls()
	transition_generation += 1
	if robot_adapter != null:
		robot_adapter.interrupt_to(SAFE_NEUTRAL_POSE, transition_generation, 320)
	adapter_receipt["barrier"] = "owner_lost"
	adapter_receipt["terminal"] = "owner_lost"
	_record_observation("owner_lost", "parent owner lost; Adapter safety convergence owns the only remaining writer")
	_update_panel("red", "OWNER LOST")

func apply_transition_sample(generation: int, pose: Vector3) -> bool:
	if robot_adapter == null or not owner_valid or generation != transition_generation:
		_record_decision("STALE_REJECT", "generation=%d cannot write current generation=%d" % [generation, transition_generation])
		return false
	return robot_adapter.set_pose(generation, {"head_pitch": pose.x, "head_yaw": pose.y, "head_roll": pose.z})

func _load_motion_plan() -> void:
	var paths := ["res://fixtures/generated/robot-attack-recover.json", "res://fixtures/generated/robot-high-guard.json"]
	for path in paths:
		if not FileAccess.file_exists(path):
			_record_decision("REJECT", "缺少 CODA 生成计划；先生成 D3 plans: %s" % path)
			continue
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary and parsed.get("artifact_type") == "CODAD3GeneratedMotion":
			var artifact: Dictionary = parsed
			var transition: Dictionary = artifact.get("transition_plan", {})
			var intent_id := String(artifact.get("motion_envelope", {}).get("intent", ""))
			if transition.get("plan_type") == "TransitionPlan" and transition.get("execution_authority") == "adapter_only":
				motion_plans[intent_id] = artifact
				if motion_plan.is_empty(): motion_plan = artifact
				_record_observation("generated_plan", "%s segments=%d" % [intent_id, transition.get("segments", []).size()])
	if not motion_plans.is_empty():
		plan_loaded = true
	else:
		_record_decision("REJECT", "没有可执行的 CODA TransitionPlan")

func _current_pose() -> Vector3:
	if robot_adapter == null:
		return Vector3.ZERO
	return Vector3(float(robot_adapter.current.get("head_pitch", 0.0)), float(robot_adapter.current.get("head_yaw", 0.0)), float(robot_adapter.current.get("head_roll", 0.0)))


func _build_robot_adapter() -> void:
	var aibi_adapter_path := OS.get_environment("CODA_AIBI_ROBOT_JOINT_ADAPTER")
	if not aibi_adapter_path.is_empty():
		var aibi_adapter_script: Variant = load(aibi_adapter_path)
		if aibi_adapter_script == null:
			push_error("CODA_AIBI_ROBOT_JOINT_ADAPTER could not be loaded: %s" % aibi_adapter_path)
			return
		var aibi_adapter: Variant = aibi_adapter_script.new()
		robot_adapter = AIBI_ADAPTER_BRIDGE_SCRIPT.new(aibi_adapter, skeleton)
		_record_decision("ADAPTER", "AIBI RobotJointAdapter connected through CODA lease/plan bridge")
	else:
		robot_adapter = ROBOT_ADAPTER_SCRIPT.new(skeleton)
		_record_decision("ADAPTER", "CODA reference RobotJointAdapter active; set CODA_AIBI_ROBOT_JOINT_ADAPTER to test AIBI source")
	robot_adapter.command_rejected.connect(func(reason: String): _record_decision("ADAPTER_REJECT", reason))
	robot_adapter.terminal_receipt.connect(_on_adapter_terminal)

func _on_adapter_terminal(generation: int, terminal: String) -> void:
	if generation != transition_generation:
		_record_decision("STALE_RECEIPT_REJECT", "generation=%d" % generation)
		return
	adapter_receipt["terminal"] = "owner_lost" if not owner_valid else terminal
	_record_observation("terminal", "generation=%d state=%s" % [generation, adapter_receipt["terminal"]])
	if not owner_valid:
		return
	if not _pending_plan.is_empty():
		var pending := _pending_plan
		_pending_plan = {}
		_start_plan(pending)
	else:
		current_intent = "idle"
		_active_priority = -1
		_update_panel("green", "COMPLETED")

func _build_world() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("08111f")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("a9c7e8")
	env.ambient_light_energy = 0.7
	environment.environment = env
	add_child(environment)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-42.0, -28.0, 0.0)
	key.light_color = Color("d9edff")
	key.light_energy = 1.7
	add_child(key)
	var fill := OmniLight3D.new()
	fill.position = Vector3(-2.0, 2.0, 2.5)
	fill.light_color = Color("ffd7a3")
	fill.light_energy = 5.0
	fill.omni_range = 8.0
	add_child(fill)

	camera = Camera3D.new()
	camera.position = Vector3(0.0, 1.0, 3.6)
	camera.fov = 42.0
	add_child(camera)
	camera.look_at(Vector3(0.0, 0.75, 0.0), Vector3.UP)

	var floor := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(7.0, 5.0)
	floor.mesh = plane
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("15243a")
	material.roughness = 0.86
	floor.material_override = material
	floor.position.y = -0.72
	add_child(floor)

func _build_character() -> void:
	gdbot = GDBOT_SCENE.instantiate()
	gdbot.name = "GDBot"
	add_child(gdbot)
	skeleton = gdbot.get_node_or_null("gdbot/Armature/Skeleton3D") as Skeleton3D
	face = gdbot.get_node_or_null("SubViewport/GDbotFace")
	if skeleton == null or skeleton.find_bone("head") < 0:
		push_error("D3 requires a GDBot Skeleton3D with a head bone")
	if face == null:
		push_error("D3 requires the real GDBot face animation target")

func _build_expression_adapter() -> void:
	expression_adapter = EXPRESSION_ADAPTER_SCRIPT.new()
	add_child(expression_adapter)
	expression_adapter.attach_face(face)
	if expression_adapter.acquire():
		expression_adapter.apply_expression("default")
		expression_receipt = expression_adapter.last_receipt

func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := ColorRect.new()
	panel.position = Vector2(24.0, 24.0)
	panel.size = Vector2(430.0, 704.0)
	panel.color = Color(0.025, 0.055, 0.11, 0.93)
	layer.add_child(panel)
	var title := Label.new()
	title.text = "CODA / 具身姿态演示"
	title.position = Vector2(20.0, 18.0)
	title.add_theme_font_size_override("font_size", 22)
	panel.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "GDBot 骨骼姿态演示 · 点击按钮即可体验"
	subtitle.position = Vector2(20.0, 54.0)
	subtitle.modulate = Color("9fb6d4")
	panel.add_child(subtitle)
	status_label = Label.new()
	status_label.position = Vector2(20.0, 91.0)
	status_label.size = Vector2(390.0, 64.0)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.add_theme_font_size_override("font_size", 18)
	panel.add_child(status_label)
	gate_label = Label.new()
	gate_label.position = Vector2(20.0, 164.0)
	gate_label.size = Vector2(390.0, 108.0)
	gate_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	gate_label.text = "执行边界\n✓ 动作来自 CODA 生成的计划\n✓ 中断后旧动作不能继续写姿态\n✓ 其他脚本占用或对象失效时拒绝新动作\n本示例只演示 GDBot 头部骨骼姿态，不是全身或真机控制。"
	gate_label.modulate = Color("75d6a2")
	panel.add_child(gate_label)
	var help := Label.new()
	help.position = Vector2(20.0, 278.0)
	help.size = Vector2(390.0, 32.0)
	help.text = "先点一个动作观察头部转向；执行中可切换防御或中断。"
	help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help.modulate = Color("c3d2e5")
	panel.add_child(help)
	var action_row := HBoxContainer.new()
	action_row.position = Vector2(20.0, 314.0)
	action_row.size = Vector2(390.0, 42.0)
	action_row.add_theme_constant_override("separation", 8)
	attack_button = _demo_button("攻击后收势")
	attack_button.pressed.connect(func(): request_intent("robot.attack_recover@1"))
	guard_button = _demo_button("高位防御")
	guard_button.pressed.connect(func(): request_intent("robot.high_guard@1"))
	action_row.add_child(attack_button)
	action_row.add_child(guard_button)
	panel.add_child(action_row)
	interrupt_button = _demo_button("中断并回到安全姿态")
	interrupt_button.position = Vector2(20.0, 362.0)
	interrupt_button.size = Vector2(390.0, 40.0)
	interrupt_button.pressed.connect(func(): request_intent("interrupt"))
	panel.add_child(interrupt_button)
	var expression_row := HBoxContainer.new()
	expression_row.position = Vector2(20.0, 410.0)
	expression_row.size = Vector2(390.0, 40.0)
	expression_row.add_theme_constant_override("separation", 6)
	var expression_title := Label.new()
	expression_title.text = "表情"
	expression_title.custom_minimum_size.x = 42.0
	expression_row.add_child(expression_title)
	for expression in [{"label": "开心", "id": "happy"}, {"label": "自然", "id": "default"}, {"label": "眩晕", "id": "dizzy"}]:
		var expression_button := _demo_button(String(expression.label))
		expression_button.pressed.connect(func(): request_expression(String(expression.id)))
		expression_row.add_child(expression_button)
	panel.add_child(expression_row)
	var test_row := HBoxContainer.new()
	test_row.position = Vector2(20.0, 456.0)
	test_row.size = Vector2(390.0, 40.0)
	test_row.add_theme_constant_override("separation", 6)
	external_writer_button = _demo_button("模拟外部占用")
	external_writer_button.pressed.connect(func(): set_external_writer_active(not external_writer_active))
	owner_lost_button = _demo_button("模拟对象失效")
	owner_lost_button.pressed.connect(owner_lost)
	reset_button = _demo_button("重置演示")
	reset_button.pressed.connect(_reset_demo)
	test_row.add_child(external_writer_button)
	test_row.add_child(owner_lost_button)
	test_row.add_child(reset_button)
	panel.add_child(test_row)
	timeline = ProgressBar.new()
	timeline.position = Vector2(20.0, 508.0)
	timeline.size = Vector2(390.0, 22.0)
	timeline.show_percentage = false
	panel.add_child(timeline)
	var evidence_title := Label.new()
	evidence_title.position = Vector2(20.0, 536.0)
	evidence_title.text = "执行记录与回执（核对用）"
	evidence_title.add_theme_color_override("font_color", Color("9fb6d4"))
	panel.add_child(evidence_title)
	trace_label = Label.new()
	trace_label.position = Vector2(20.0, 560.0)
	trace_label.size = Vector2(390.0, 128.0)
	trace_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	trace_label.add_theme_font_size_override("font_size", 12)
	panel.add_child(trace_label)
	_sync_demo_controls()

func _demo_button(label: String) -> Button:
	var button := Button.new()
	button.text = label
	button.custom_minimum_size.y = 38.0
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return button

func _sync_demo_controls() -> void:
	if external_writer_button != null:
		external_writer_button.text = "释放外部占用" if external_writer_active else "模拟外部占用"
	if owner_lost_button != null:
		owner_lost_button.disabled = not owner_valid
	if reset_button != null:
		reset_button.disabled = robot_adapter != null and robot_adapter.is_executing()

func _reset_demo() -> void:
	reset_fixture()
	_update_panel("green", "RESET")

func _update_panel(color_name: String, phase: String) -> void:
	_sync_demo_controls()
	var color := Color("75d6a2") if color_name == "green" else Color("ff8080") if color_name == "red" else Color("80bfff")
	status_label.modulate = color
	var phase_labels := {
		"DECISION": "演示已就绪，等待操作",
		"OBSERVED": "状态记录已更新",
		"EXECUTING GENERATED PLAN": "正在执行 CODA 生成的动作",
		"SAFE CONVERGENCE": "正在回到安全姿态",
		"COMPLETED": "动作执行完成",
		"OWNER LOST": "演示对象失效，拒绝新动作",
		"RECOVERY REJECTED": "安全回中请求被拒绝",
		"REJECTED": "动作未执行：没有可用的计划",
		"REJECTED / OWNER LOST": "动作未执行：演示对象已失效",
		"REJECTED / EXTERNAL WRITER": "动作未执行：其他脚本正在占用",
		"REJECTED / PLAN MISSING": "动作未执行：缺少生成计划",
		"REJECTED / ADAPTER": "动作未执行：姿态适配器拒绝计划",
		"REJECTED / START STATE": "动作未执行：当前姿态与计划起点不一致",
		"EXPRESSION HAPPY": "表情已切换：开心",
		"EXPRESSION DEFAULT": "表情已切换：自然",
		"EXPRESSION DIZZY": "表情已切换：眩晕",
		"RESET": "已重置，可以重新开始",
	}
	var phase_text := String(phase_labels.get(phase, "表情已更新" if phase.begins_with("EXPRESSION ") else "状态：%s" % phase))
	var intent_labels := {
		"idle": "中立姿态",
		"robot.attack.recover": "攻击后收势",
		"robot.high.guard": "高位防御",
		"安全收敛": "回到中立姿态",
	}
	status_label.text = "%s\n当前动作：%s" % [phase_text, intent_labels.get(current_intent, current_intent)]
	trace_label.text = "generation=%d · owner=%s\nDecisionRecord\n" % [transition_generation, lease_owner] + "\n".join(decision_entries.slice(maxi(0, decision_entries.size() - 3), decision_entries.size())) + "\nMotionAdapter · barrier=%s start=%s terminal=%s" % [adapter_receipt.get("barrier", "pending"), adapter_receipt.get("start", "pending"), adapter_receipt.get("terminal", "pending")] + "\nExpressionAdapter · face=%s terminal=%s gen=%s" % [expression_receipt.get("expression", "default"), expression_receipt.get("terminal", "pending"), expression_receipt.get("generation", 0)] + "\nRuntimeObservation\n" + "\n".join(observation_entries.slice(maxi(0, observation_entries.size() - 2), observation_entries.size()))

func _record_decision(kind: String, text: String) -> void:
	decision_entries.append("[%s] %s" % [kind, text])
	if status_label != null:
		_update_panel("blue", "DECISION")

func _record_observation(kind: String, text: String) -> void:
	observation_entries.append("[%s] %s" % [kind, text])
	if status_label != null:
		_update_panel("blue", "OBSERVED")
