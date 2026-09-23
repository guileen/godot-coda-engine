class_name GSEOS_RewardCapabilities
extends RefCounted

var registry: GSEOS_CapabilityRegistry

func _init(target_registry: GSEOS_CapabilityRegistry) -> void:
	registry = target_registry
	registry.register("read", 1, Callable(self, "read"), {"main_thread": true, "awaitable": false})
	registry.register("ui.animate_number", 1, Callable(self, "animate_number"), {"main_thread": true, "awaitable": true, "cancellation": "safe_point"})
	registry.register("ui.remove_node", 1, Callable(self, "remove_node"), {"main_thread": true, "awaitable": false})
	registry.register("ui.create_reward_row", 1, Callable(self, "create_reward_row"), {"main_thread": true, "awaitable": false})
	registry.register("ui.set_text", 1, Callable(self, "set_text"), {"main_thread": true, "awaitable": false})

func read(args: Dictionary) -> Variant:
	var target = args.get("target")
	var field := String(args.get("field", ""))
	if not is_instance_valid(target) or not target.has_meta("_gseos_fields"):
		return null
	var fields: Dictionary = target.get_meta("_gseos_fields", {})
	return fields.get(field)

func animate_number(args: Dictionary) -> Variant:
	var target := args.get("target") as Node
	if not is_instance_valid(target):
		return null
	var wait := GSEOS_WaitRegistration.new()
	var from_value := float(args.get("from", 0.0))
	var to_value := float(args.get("to", from_value))
	var duration := maxf(0.01, float(args.get("duration", 0.35)))
	var tween: Tween = target.create_tween()
	tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_method(func(value: float):
		if not is_instance_valid(target):
			return
		var fields: Dictionary = target.get_meta("_gseos_fields", {})
		fields["score"] = int(round(value))
		target.set_meta("_gseos_fields", fields)
		var score_label := target.find_child("ScoreValue", true, false) as Label
		if score_label != null:
			score_label.text = "积分：%d" % int(round(value))
	, from_value, to_value, duration)
	wait._cleanup = func():
		if is_instance_valid(tween):
			tween.kill()
	tween.finished.connect(func():
		wait.finish({"status": "COMPLETED"})
	)
	return wait

func remove_node(args: Dictionary) -> Variant:
	var target = args.get("target")
	if is_instance_valid(target):
		target.queue_free()
	return null

func create_reward_row(args: Dictionary) -> Variant:
	var owner = args.get("owner")
	if not is_instance_valid(owner):
		return null
	var row := Label.new()
	row.name = "RewardRow"
	owner.add_child(row)
	return row

func set_text(args: Dictionary) -> Variant:
	var target = args.get("target")
	if is_instance_valid(target) and target is Label:
		target.text = String(args.get("content", ""))
	return null
