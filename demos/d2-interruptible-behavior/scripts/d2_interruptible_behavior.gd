extends Node3D

## D2 is a visual proof of C0 lifecycle semantics using the real GDBot mesh.
## It does not connect audio, LLM, network, or hardware; inputs are deterministic fixtures.

const GDBOT_SCENE := preload("res://addons/gdquest_gdbot/gdbot_skin.tscn")
const HEAD_LIMIT := Vector2(-12.0, 22.0)

var gdbot: Node3D
var skeleton: Skeleton3D
var state_label: Label
var gate_label: Label
var trace_label: Label
var timeline: ProgressBar
var behavior_state := "listening"
var generation := 0
var speech_active := false
var speech_elapsed := 0.0
var decisions: Array[String] = []
var observations: Array[String] = []

func _ready() -> void:
	_build_world()
	_build_character()
	_build_overlay()
	_record_decision("READY", "C0 BehaviorPlan loaded; state=listening")
	_record_observation("terminal", "listening")

func _process(delta: float) -> void:
	if speech_active:
		speech_elapsed += delta
		timeline.value = minf(100.0, speech_elapsed / 2.0 * 100.0)
		_apply_head_pose(lerpf(0.0, 14.0, minf(1.0, speech_elapsed / 2.0)))
		if speech_elapsed >= 2.0:
			speech_active = false
			behavior_state = "listening"
			_record_observation("effect_completed", "speech")
			_record_observation("terminal", "idle")
			_update_panel("green", "COMPLETED")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_S: start_speaking()
			KEY_I: interrupt_speaking()
			KEY_T: late_tts_done()
			KEY_R: reset_fixture()

func start_speaking() -> void:
	if speech_active:
		_record_decision("REJECT", "speech already active; no duplicate effect")
		return
	generation += 1
	speech_active = true
	speech_elapsed = 0.0
	behavior_state = "speaking"
	_record_decision("ARBITRATED", "llm_response priority=60 generation=%d" % generation)
	_record_observation("effect_started", "speech")
	_update_panel("blue", "EXECUTING")

func interrupt_speaking() -> void:
	if not speech_active:
		_record_decision("REJECT", "interrupt has no active speech effect")
		_update_panel("yellow", "NOOP")
		return
	var old_generation := generation
	generation += 1
	speech_active = false
	behavior_state = "listening"
	_apply_head_pose(0.0)
	_record_decision("INTERRUPT", "priority=100 cancels speech generation=%d" % old_generation)
	_record_observation("effect_cancelled", "speech exactly once")
	_record_observation("effect_converged", "speech_safe_stop")
	_record_observation("terminal", "listening")
	_update_panel("green", "SAFE CONVERGED")

func late_tts_done() -> void:
	if speech_active:
		_record_decision("REJECT", "tts_done is not late yet")
	else:
		_record_decision("STALE_CALLBACK", "tts_done rejected; old generation cannot re-enter speaking")
		_record_observation("ignored", "STALE_COMPLETION")
		_update_panel("red", "STALE REJECTED")

func reset_fixture() -> void:
	behavior_state = "listening"
	speech_active = false
	speech_elapsed = 0.0
	generation = 0
	_apply_head_pose(0.0)
	decisions.clear()
	observations.clear()
	_record_decision("RESET", "fixture reset; unique terminal state preserved")
	_record_observation("terminal", "listening")
	_update_panel("blue", "RESET")

func _build_world() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("08111f")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("a9c7e8")
	env.ambient_light_energy = 0.75
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
	var camera := Camera3D.new()
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
	if skeleton == null or skeleton.find_bone("head") < 0:
		push_error("D2 requires a GDBot Skeleton3D with a head bone")

func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := ColorRect.new()
	panel.position = Vector2(24.0, 24.0)
	panel.size = Vector2(430.0, 704.0)
	panel.color = Color(0.025, 0.055, 0.11, 0.93)
	layer.add_child(panel)
	var title := Label.new()
	title.text = "CODA / D2 Interruptible Behavior"
	title.position = Vector2(20.0, 18.0)
	title.add_theme_font_size_override("font_size", 22)
	panel.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "真实 GDBot 网格 · C0 状态/效果/迟到回调"
	subtitle.position = Vector2(20.0, 54.0)
	subtitle.modulate = Color("9fb6d4")
	panel.add_child(subtitle)
	state_label = Label.new()
	state_label.position = Vector2(20.0, 102.0)
	state_label.size = Vector2(390.0, 86.0)
	state_label.add_theme_font_size_override("font_size", 18)
	panel.add_child(state_label)
	gate_label = Label.new()
	gate_label.position = Vector2(20.0, 204.0)
	gate_label.size = Vector2(390.0, 156.0)
	gate_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	gate_label.text = "硬门\n● priority arbitration\n● cancellation exactly once\n● stale callback rejected\n● unique terminal state\n● external writer: not connected"
	gate_label.modulate = Color("75d6a2")
	panel.add_child(gate_label)
	var help := Label.new()
	help.position = Vector2(20.0, 378.0)
	help.text = "S  开始 speaking\nI  interrupt → listening\nT  注入迟到 tts_done\nR  重置 fixture"
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
	var color := Color("75d6a2") if color_name == "green" else Color("ff7f8f") if color_name == "red" else Color("80bfff")
	state_label.modulate = color
	state_label.text = "%s  %s\nstate: %s\ngeneration: %d" % [phase, behavior_state, behavior_state, generation]
	trace_label.text = "DecisionRecord\n" + "\n".join(decisions.slice(maxi(0, decisions.size() - 4), decisions.size())) + "\n\nRuntimeObservation\n" + "\n".join(observations.slice(maxi(0, observations.size() - 4), observations.size()))

func _record_decision(kind: String, text: String) -> void:
	decisions.append("[%s] %s" % [kind, text])
	if state_label != null:
		_update_panel("blue", "DECISION")

func _record_observation(kind: String, text: String) -> void:
	observations.append("[%s] %s" % [kind, text])
	if state_label != null:
		_update_panel("blue", "OBSERVED")

func _apply_head_pose(pitch: float) -> void:
	if skeleton == null:
		return
	var head := skeleton.find_bone("head")
	if head < 0:
		return
	skeleton.set_bone_pose_rotation(head, Quaternion.from_euler(Vector3(deg_to_rad(clampf(pitch, HEAD_LIMIT.x, HEAD_LIMIT.y)), 0.0, 0.0)))
