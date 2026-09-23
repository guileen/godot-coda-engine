extends SceneTree

const REWARD_RUNNER := preload("res://addons/coda/runtime/reward_event_runner.gd")

var registry: CODA_EventRegistry
var capability_registry: CODA_CapabilityRegistry
var hud: Node
var completed_result: Dictionary
var received_payload: Dictionary
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	registry = CODA_EventRegistry.new()
	capability_registry = CODA_CapabilityRegistry.new()
	var runner := REWARD_RUNNER.new(capability_registry, registry)
	registry.register("ui.reward.apply", Callable(runner, "run"), "reject")
	registry.subscribe("combat.hit_resolved@1", Callable(self, "_on_hit_resolved"))

	hud = Node.new()
	hud.name = "HUD"
	hud.set_meta("_coda_fields", {"score": 100})
	root.add_child(hud)
	var score_value := Label.new()
	score_value.name = "ScoreValue"
	score_value.text = "积分：100"
	hud.add_child(score_value)
	var old_row := Label.new()
	old_row.name = "OldRewardRow"
	hud.add_child(old_row)

	var handle := registry.start("ui.reward.apply", {"reward": 25, "target_hud": hud}, hud)
	if handle.status != CODA_RunHandle.Status.WAITING:
		failures.append("reward event did not suspend at await")
	handle.completed.connect(_on_reward_completed)
	call_deferred("_verify_intermediate_animation")

func _on_hit_resolved(payload: Dictionary) -> Dictionary:
	received_payload = payload.duplicate(true)
	return {"ok": true}

func _on_reward_completed(result: Dictionary) -> void:
	completed_result = result
	call_deferred("_verify_reward")

func _verify_intermediate_animation() -> void:
	await create_timer(0.25).timeout
	var fields: Dictionary = hud.get_meta("_coda_fields", {})
	var intermediate_score := int(fields.get("score", 100))
	if intermediate_score <= 100 or intermediate_score >= 125:
		failures.append("visible score tween did not pass through an intermediate value: %d" % intermediate_score)
	var score_value := hud.get_node_or_null("ScoreValue") as Label
	if score_value == null or score_value.text != "积分：%d" % intermediate_score:
		failures.append("ScoreValue label did not display the animated score")

func _verify_reward() -> void:
	await process_frame
	await process_frame
	if completed_result.get("status") != "COMPLETED":
		failures.append("reward event did not complete: %s" % completed_result)
	var row := hud.get_node_or_null("RewardRow")
	if hud.get_node_or_null("OldRewardRow") != null or not is_instance_valid(row) or row.text != "奖励：125":
		failures.append("reward UI chain did not remove/create/set text")
	var score_value := hud.get_node_or_null("ScoreValue") as Label
	if score_value == null or score_value.text != "积分：125":
		failures.append("visible score animation did not end at 125")
	if received_payload.get("score") != 125:
		failures.append("versioned publish payload was not received")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
	else:
		print("CODA reward chain integration passed")
		hud.queue_free()
		registry.clear()
		capability_registry.clear()
		await process_frame
		quit(0)
