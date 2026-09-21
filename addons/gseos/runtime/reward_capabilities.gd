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
	var target = args.get("target")
	if not is_instance_valid(target):
		return null
	var wait := GSEOS_WaitRegistration.new()
	var timer := Timer.new()
	timer.one_shot = true
	timer.wait_time = float(args.get("duration", 0.0))
	target.add_child(timer)
	wait._cleanup = func():
		if is_instance_valid(timer):
			timer.queue_free()
	timer.timeout.connect(func():
		wait.finish({"status": "COMPLETED"})
	)
	timer.start()
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
