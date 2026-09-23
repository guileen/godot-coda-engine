class_name GSEOS_RewardEventRunner
extends RefCounted

var capabilities: GSEOS_RewardCapabilities
var registry: GSEOS_EventRegistry

func _init(capability_registry: GSEOS_CapabilityRegistry, event_registry: GSEOS_EventRegistry) -> void:
	capabilities = GSEOS_RewardCapabilities.new(capability_registry)
	registry = event_registry

func run(args: Dictionary, owner: Node, handle: GSEOS_RunHandle) -> Variant:
	var reward := int(args.get("reward", 0))
	var target_hud = args.get("target_hud")
	if reward <= 0:
		handle.finish(GSEOS_RunHandle.Status.COMPLETED, {"status": "COMPLETED", "value": null})
		return null
	if not is_instance_valid(target_hud):
		handle.finish(GSEOS_RunHandle.Status.CANCELLED, {"status": "CANCELLED", "reason": "owner_invalid"})
		return null

	# Generated source-map equivalents for the reward fixture.
	var old_score = capabilities.read({"target": target_hud, "field": "score"})
	var new_score := int(old_score) + reward
	var wait = capabilities.animate_number({"target": target_hud, "from": old_score, "to": new_score, "duration": 0.65})
	if not wait is GSEOS_WaitRegistration:
		handle.finish(GSEOS_RunHandle.Status.FAILED, {"status": "FAILED", "code": "WAIT_ADAPTER_FAILED"})
		return null
	handle.status = GSEOS_RunHandle.Status.WAITING
	wait.settled.connect(func(result: Dictionary):
		if handle.status != GSEOS_RunHandle.Status.WAITING:
			return
		if not is_instance_valid(owner) or not is_instance_valid(target_hud):
			handle.finish(GSEOS_RunHandle.Status.CANCELLED, {"status": "CANCELLED", "reason": "owner_invalid"})
			return
		if result.get("status") != "COMPLETED":
			handle.finish(GSEOS_RunHandle.Status.CANCELLED, {"status": "CANCELLED", "reason": result.get("reason", "wait_failed")})
			return
		var row_owner = target_hud.find_child("RewardHistory", true, false)
		if not is_instance_valid(row_owner):
			row_owner = target_hud
		var old_row = row_owner.find_child("OldRewardRow", false, false)
		if is_instance_valid(old_row):
			capabilities.remove_node({"target": old_row})
		var new_row = capabilities.create_reward_row({"owner": row_owner, "value": new_score})
		capabilities.set_text({"target": new_row, "content": "奖励：%d" % new_score})
		var published := registry.publish("combat.hit_resolved@1", {"damage": reward, "score": new_score})
		handle.finish(GSEOS_RunHandle.Status.COMPLETED, {"status": "COMPLETED", "value": {"score": new_score, "published": published.ok}})
	)
	return null
