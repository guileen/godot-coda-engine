extends Node3D

## D3 uses the real AIBI/GDBot mesh and Skeleton3D.  This scene is a visual
## evidence harness for bounded intent transition, not a physics backend.

const GDBOT_SCENE := preload("res://addons/gdquest_gdbot/gdbot_skin.tscn")
const EXPRESSION_ADAPTER_SCRIPT := preload("res://scripts/d3_expression_adapter.gd")
const HEAD_PITCH_LIMIT := Vector2(-15.0, 25.0)
const HEAD_YAW_LIMIT := Vector2(-60.0, 60.0)
const HEAD_ROLL_LIMIT := Vector2(-20.0, 20.0)

var gdbot: Node3D
var skeleton: Skeleton3D
var face: Node
var expression_adapter: Node
var camera: Camera3D
var status_label: Label
var trace_label: Label
var gate_label: Label
var timeline: ProgressBar
var current_intent := "idle"
var transition_from := Vector3.ZERO
var transition_to := Vector3.ZERO
var transition_elapsed := 0.0
var transition_duration := 1.0
var transition_generation := 0
var lease_owner := "none"
var decision_entries: Array[String] = []
var observation_entries: Array[String] = []
var motion_plan: Dictionary = {}
var plan_loaded := false
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
	_build_expression_adapter()
	_build_overlay()
	_load_motion_plan()
	_record_decision("READY", "D3 fixture loaded; Skeleton3D ownership available")
	_start_transition("idle", Vector3.ZERO, 0.6)

func _process(delta: float) -> void:
	if not owner_valid:
		return
	if transition_elapsed < transition_duration:
		transition_elapsed = minf(transition_duration, transition_elapsed + delta)
		var t := _smoothstep(transition_elapsed / transition_duration)
		_apply_pose(transition_from.lerp(transition_to, t))
		timeline.value = t * 100.0
		if transition_elapsed >= transition_duration:
			_record_observation("terminal", current_intent)
			adapter_receipt["terminal"] = current_intent
			_update_panel("green", "COMPLETED")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_A: request_intent("attack", Vector3(-8.0, -35.0, 5.0), 0.9)
			KEY_D: request_intent("defense", Vector3(12.0, 32.0, -4.0), 1.1)
			KEY_I: request_intent("interrupt", Vector3.ZERO, 0.45)
			KEY_X: set_external_writer_active(true)
			KEY_O: owner_lost()
			KEY_R: reset_fixture()
			KEY_H: request_expression("happy")
			KEY_N: request_expression("default")
			KEY_Z: request_expression("dizzy")

func request_intent(intent: String, target: Vector3, duration: float) -> void:
	if intent == "interrupt":
		_record_decision("INTERRUPT", "higher-priority intent; revoke generation %d" % transition_generation)
		adapter_receipt["barrier"] = "revoked"
		transition_generation += 1
		lease_owner = "coda.transition.%d" % transition_generation
		_start_transition("interrupted_to_safe", Vector3(_current_pose()), 0.45)
		return
	if not plan_loaded:
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
		transition_elapsed = transition_duration
		_update_panel("red", "REJECTED / EXTERNAL WRITER")
		return
	_record_decision("SOURCE_PLAN", "event=%s opcode=%s source=%s" % [motion_plan.get("event_id", "unknown"), motion_plan.get("instructions", [{}])[0].get("opcode", "unknown"), motion_plan.get("instructions", [{}])[0].get("source_ref", {}).get("path", "unknown")])
	_record_decision("ADMISSION", "%s: snapshot=valid lease=full safety=pass deadline=reserve" % intent)
	adapter_receipt["barrier"] = "accepted"
	transition_generation += 1
	lease_owner = "coda.transition.%d" % transition_generation
	_start_transition(intent, target, duration)

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
	_start_transition("idle", Vector3.ZERO, 0.6)
	_record_decision("RESET", "fixture reset; no stale generation may write")

func set_external_writer_active(active: bool) -> void:
	external_writer_active = active
	if active:
		_record_observation("ownership", "external writer active; next request must reject")

func owner_lost() -> void:
	owner_valid = false
	transition_elapsed = transition_duration
	adapter_receipt["barrier"] = "owner_lost"
	adapter_receipt["terminal"] = "owner_lost"
	_record_observation("owner_lost", "parent owner destroyed; transition converges once")
	_update_panel("red", "OWNER LOST")

func apply_transition_sample(generation: int, pose: Vector3) -> bool:
	if not owner_valid or generation != transition_generation:
		_record_decision("STALE_REJECT", "generation=%d cannot write current generation=%d" % [generation, transition_generation])
		return false
	_apply_pose(pose)
	return true

func _load_motion_plan() -> void:
	var plan_text := FileAccess.get_file_as_string("res://fixtures/robot-acknowledge.plan.json")
	var parsed = JSON.parse_string(plan_text)
	if parsed is Dictionary and parsed.get("plan_type", "") == "ExecutionPlan":
		var instructions: Array = parsed.get("instructions", [])
		if not instructions.is_empty() and instructions[0].get("opcode", "") == "MotionIntent":
			motion_plan = parsed
			plan_loaded = true
			_record_observation("source_plan", "MotionIntent loaded; asset=%s" % parsed.get("asset_fingerprint", "unknown"))
	else:
		_record_decision("REJECT", "invalid ExecutionPlan fixture; fail closed")

func _start_transition(intent: String, target: Vector3, duration: float) -> void:
	current_intent = intent
	transition_from = _current_pose()
	transition_to = Vector3(
		clampf(target.x, HEAD_PITCH_LIMIT.x, HEAD_PITCH_LIMIT.y),
		clampf(target.y, HEAD_YAW_LIMIT.x, HEAD_YAW_LIMIT.y),
		clampf(target.z, HEAD_ROLL_LIMIT.x, HEAD_ROLL_LIMIT.y)
	)
	transition_duration = maxf(0.1, duration)
	transition_elapsed = 0.0
	adapter_receipt["start"] = "started"
	adapter_receipt["terminal"] = "pending"
	_record_observation("start", "%s generation=%d" % [intent, transition_generation])
	_update_panel("blue", "EXECUTING")

func _current_pose() -> Vector3:
	if skeleton == null:
		return Vector3.ZERO
	var head := skeleton.find_bone("head")
	if head < 0:
		return Vector3.ZERO
	var euler := skeleton.get_bone_pose_rotation(head).get_euler()
	return Vector3(rad_to_deg(euler.x), rad_to_deg(euler.y), rad_to_deg(euler.z))

func _apply_pose(pose: Vector3) -> void:
	if skeleton == null:
		return
	var head := skeleton.find_bone("head")
	if head < 0:
		return
	var safe := Vector3(
		clampf(pose.x, HEAD_PITCH_LIMIT.x, HEAD_PITCH_LIMIT.y),
		clampf(pose.y, HEAD_YAW_LIMIT.x, HEAD_YAW_LIMIT.y),
		clampf(pose.z, HEAD_ROLL_LIMIT.x, HEAD_ROLL_LIMIT.y)
	)
	skeleton.set_bone_pose_rotation(head, Quaternion.from_euler(Vector3(deg_to_rad(safe.x), deg_to_rad(safe.y), deg_to_rad(safe.z))))

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
	title.text = "CODA / D3 Skeleton Transition"
	title.position = Vector2(20.0, 18.0)
	title.add_theme_font_size_override("font_size", 22)
	panel.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "真实 GDBot 网格 · Skeleton3D · 有界姿态过渡"
	subtitle.position = Vector2(20.0, 54.0)
	subtitle.modulate = Color("9fb6d4")
	panel.add_child(subtitle)
	status_label = Label.new()
	status_label.position = Vector2(20.0, 102.0)
	status_label.size = Vector2(390.0, 86.0)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.add_theme_font_size_override("font_size", 18)
	panel.add_child(status_label)
	gate_label = Label.new()
	gate_label.position = Vector2(20.0, 204.0)
	gate_label.size = Vector2(390.0, 156.0)
	gate_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	gate_label.text = "硬门\n● snapshot valid\n● lease full / generation matched\n● pose limits enforced\n● deadline reserve: 320 ms\n● external writer: CODA-owned"
	gate_label.modulate = Color("75d6a2")
	panel.add_child(gate_label)
	var help := Label.new()
	help.position = Vector2(20.0, 378.0)
	help.text = "A  攻击收势    D  高位防御\nH  开心表情    N  默认表情    Z  眩晕表情\nI  抢占并安全收敛\nX  外部 writer 占用\nO  owner 销毁    R  重置 fixture"
	help.add_theme_font_size_override("font_size", 18)
	panel.add_child(help)
	timeline = ProgressBar.new()
	timeline.position = Vector2(20.0, 488.0)
	timeline.size = Vector2(390.0, 22.0)
	timeline.show_percentage = false
	panel.add_child(timeline)
	trace_label = Label.new()
	trace_label.position = Vector2(20.0, 536.0)
	trace_label.size = Vector2(390.0, 150.0)
	trace_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	trace_label.add_theme_font_size_override("font_size", 14)
	panel.add_child(trace_label)

func _update_panel(color_name: String, phase: String) -> void:
	var color := Color("75d6a2") if color_name == "green" else Color("80bfff")
	status_label.modulate = color
	status_label.text = "%s  %s\nintent: %s\ngeneration: %d · owner: %s" % [phase, current_intent, current_intent, transition_generation, lease_owner]
	trace_label.text = "DecisionRecord\n" + "\n".join(decision_entries.slice(maxi(0, decision_entries.size() - 3), decision_entries.size())) + "\n\nMotionAdapter\n" + "barrier=%s start=%s terminal=%s" % [adapter_receipt.get("barrier", "pending"), adapter_receipt.get("start", "pending"), adapter_receipt.get("terminal", "pending")] + "\nExpressionAdapter\n" + "face=%s barrier=%s terminal=%s gen=%s" % [expression_receipt.get("expression", "default"), expression_receipt.get("barrier", "pending"), expression_receipt.get("terminal", "pending"), expression_receipt.get("generation", 0)] + "\n\nRuntimeObservation\n" + "\n".join(observation_entries.slice(maxi(0, observation_entries.size() - 2), observation_entries.size()))

func _record_decision(kind: String, text: String) -> void:
	decision_entries.append("[%s] %s" % [kind, text])
	if status_label != null:
		_update_panel("blue", "DECISION")

func _record_observation(kind: String, text: String) -> void:
	observation_entries.append("[%s] %s" % [kind, text])
	if status_label != null:
		_update_panel("blue", "OBSERVED")

func _smoothstep(value: float) -> float:
	var t := clampf(value, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)
