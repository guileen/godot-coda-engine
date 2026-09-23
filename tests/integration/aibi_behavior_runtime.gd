extends SceneTree

const BEHAVIOR_RUNTIME := preload("res://addons/gseos/runtime/behavior_runtime.gd")

var failures: Array[String] = []
var capability_calls: Array[Dictionary] = []

func _initialize() -> void:
	var asset: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://gseos/events/aibi.behavior.runtime.gse.json"))
	var capabilities: GSEOS_CapabilityRegistry = GSEOS_CapabilityRegistry.new()
	for capability in ["face.set_expression@1", "body.plan_action@1", "audio.play_speech@1", "audio.stop_speech@1"]:
		capabilities.register(capability.get_slice("@", 0), int(capability.get_slice("@", 1)), Callable(self, "_record_capability"))
	var runtime := BEHAVIOR_RUNTIME.new(asset, capabilities)
	_check(runtime.valid, "AIBI behavior EventAsset must load through the Godot adapter")
	for event_id in ["wake_word", "speech_end", "llm_response"]:
		runtime.enqueue(event_id)
		runtime.drain()
	_check(runtime.state == "speaking", "normal behavior must reach speaking")
	runtime.enqueue("interrupt")
	runtime.drain()
	runtime.enqueue("tts_done")
	var interrupted: Dictionary = runtime.drain()
	_check(interrupted.final_state == "listening", "interrupt must win and late completion must not move state")
	_check(String(interrupted.plan_fingerprint).begins_with("sha256:"), "Godot behavior traces must carry a versioned asset fingerprint")
	_check(_count(interrupted.entries, "EffectCancelled", "speech") == 1, "speech must cancel exactly once")
	_check(_count(interrupted.entries, "EffectConverged", "speech_safe_stop") == 1, "speech must converge exactly once")
	_check(_contains_reason(interrupted.entries, "STALE_COMPLETION"), "late tts_done must be observable and harmless")

	for case in [["touch_head", "idle"], ["boredom_high", "curious"], ["poked_5x", "angry"], ["energy_low", "sleepy"], ["energy_empty", "sleeping"]]:
		var surface := BEHAVIOR_RUNTIME.new(asset, capabilities)
		surface.enqueue(String(case[0]))
		surface.drain()
		_check(surface.state == String(case[1]), "AIBI state surface must include " + String(case[1]))
		for key in ["happiness", "energy", "boredom", "affection"]:
			_check(float(surface.blackboard[key]) >= 0.0 and float(surface.blackboard[key]) <= 1.0, "mood values must remain in 0..1")
	var hierarchy: Dictionary = asset.duplicate(true)
	hierarchy.behavior_runtime.states.append({"state_id": "focused", "parent_state_id": "idle"})
	hierarchy.behavior_runtime.initial_state = "focused"
	var inherited := BEHAVIOR_RUNTIME.new(hierarchy, capabilities)
	inherited.enqueue("wake_word")
	inherited.drain()
	_check(inherited.state == "listening", "Godot runtime must inherit a parent-state event rule")
	var concurrent: Dictionary = asset.duplicate(true)
	concurrent.behavior_runtime.effects.append({"effect_id": "speech_gesture", "capability": "body.plan_action@1", "args": {"action": "speak"}, "cancellable": true, "owner_state": "speaking", "convergence_effect_id": "speech_safe_stop"})
	for rule in concurrent.behavior_runtime.rules:
		if rule.rule_id == "think_response":
			rule.effects.append("speech_gesture")
	var concurrent_runtime := BEHAVIOR_RUNTIME.new(concurrent, capabilities)
	for event_id in ["wake_word", "speech_end", "llm_response", "interrupt"]:
		concurrent_runtime.enqueue(event_id)
		concurrent_runtime.drain()
	var concurrent_trace: Dictionary = concurrent_runtime.trace()
	_check(_count(concurrent_trace.entries, "EffectCancelled", "speech") == 1 and _count(concurrent_trace.entries, "EffectCancelled", "speech_gesture") == 1, "Godot must cancel each concurrent effect once")
	_check(_count(concurrent_trace.entries, "EffectConverged", "speech_safe_stop") == 2, "Godot must converge each concurrent effect once")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
	else:
		print("CODA AIBI behavior runtime Godot integration passed")
		quit(0)

func _record_capability(args: Dictionary) -> Dictionary:
	capability_calls.append(args.duplicate(true))
	return {"ok": true}

func _count(entries: Array, kind: String, effect_id: String) -> int:
	var total := 0
	for entry in entries:
		if entry.kind == kind and (entry.get("effect_id", "") == effect_id or entry.get("cancelled_effect_id", "") == effect_id):
			total += 1
	return total

func _contains_reason(entries: Array, reason: String) -> bool:
	for entry in entries:
		if entry.get("reason", "") == reason:
			return true
	return false

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
