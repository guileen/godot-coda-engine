extends SceneTree

const GENERATED := preload("res://.gseos/generated/ui_reward_apply.gd")
const FACADE := preload("res://addons/gseos/runtime/generated_runtime_facade.gd")

var failures: Array[String] = []
var received: Dictionary = {}

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	var capability_registry := GSEOS_CapabilityRegistry.new()
	var event_registry := GSEOS_EventRegistry.new()
	var capabilities := GSEOS_RewardCapabilities.new(capability_registry)
	event_registry.subscribe("combat.hit_resolved@1", Callable(self, "_on_hit"))
	var runtime := FACADE.new(capability_registry, event_registry)
	var hud := Node.new()
	hud.name = "GeneratedHUD"
	hud.set_meta("_gseos_fields", {"score": 100})
	root.add_child(hud)
	var old_row := Label.new()
	old_row.name = "OldRewardRow"
	hud.add_child(old_row)
	var result = await GENERATED.new().run(runtime, {"reward": 25, "target_hud": hud, "old_row": old_row}, hud)
	await process_frame
	var row := hud.get_node_or_null("RewardRow")
	if result != null or hud.get_node_or_null("OldRewardRow") != null or not is_instance_valid(row) or row.text != "+125":
		failures.append("generated runner did not execute the complete reward chain")
	if received.get("score") != 125:
		failures.append("generated runner publish payload was not received")
	var trace: Dictionary = runtime.last_trace
	if trace.get("trace_type", "") != "RuntimeTrace" or trace.get("event_id", "") != "ui.reward.apply" or trace.get("steps", []).is_empty():
		failures.append("generated runner did not expose a runtime trace")
	else:
		var saw_duration := false
		var saw_target := false
		for step in trace.steps:
			if step.get("node_id", "") == "animate-score" and step.get("slot", "") == "duration":
				saw_duration = true
			if step.get("node_id", "") == "animate-score" and step.get("slot", "") == "target":
				saw_target = true
		if not saw_duration or not saw_target:
			failures.append("generated runner trace did not retain capability slot locations")
	if failures.is_empty():
		print("CODA generated runner integration passed")
	else:
		for failure in failures:
			push_error(failure)
	hud.queue_free()
	capability_registry.clear()
	event_registry.clear()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func _on_hit(payload: Dictionary) -> Dictionary:
	received = payload.duplicate(true)
	return {"ok": true}
