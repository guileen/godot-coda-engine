extends SceneTree

const REWARD_RUNNER := preload("res://addons/gseos/runtime/reward_event_runner.gd")

var registry: GSEOS_EventRegistry
var capability_registry: GSEOS_CapabilityRegistry
var hud: Node
var completed_result: Dictionary
var received_payload: Dictionary
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	registry = GSEOS_EventRegistry.new()
	capability_registry = GSEOS_CapabilityRegistry.new()
	var runner := REWARD_RUNNER.new(capability_registry, registry)
	registry.register("ui.reward.apply", Callable(runner, "run"), "reject")
	registry.subscribe("combat.hit_resolved@1", Callable(self, "_on_hit_resolved"))

	hud = Node.new()
	hud.name = "HUD"
	hud.set_meta("_gseos_fields", {"score": 100})
	root.add_child(hud)
	var old_row := Label.new()
	old_row.name = "OldRewardRow"
	hud.add_child(old_row)

	var handle := registry.start("ui.reward.apply", {"reward": 25, "target_hud": hud}, hud)
	if handle.status != GSEOS_RunHandle.Status.WAITING:
		failures.append("reward event did not suspend at await")
	handle.completed.connect(_on_reward_completed)

func _on_hit_resolved(payload: Dictionary) -> Dictionary:
	received_payload = payload.duplicate(true)
	return {"ok": true}

func _on_reward_completed(result: Dictionary) -> void:
	completed_result = result
	call_deferred("_verify_reward")

func _verify_reward() -> void:
	await process_frame
	await process_frame
	if completed_result.get("status") != "COMPLETED":
		failures.append("reward event did not complete: %s" % completed_result)
	var row := hud.get_node_or_null("RewardRow")
	if hud.get_node_or_null("OldRewardRow") != null or not is_instance_valid(row) or row.text != "奖励：125":
		failures.append("reward UI chain did not remove/create/set text")
	if received_payload.get("score") != 125:
		failures.append("versioned publish payload was not received")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
	else:
		print("GSEOS reward chain integration passed")
		hud.queue_free()
		registry.clear()
		capability_registry.clear()
		await process_frame
		quit(0)
