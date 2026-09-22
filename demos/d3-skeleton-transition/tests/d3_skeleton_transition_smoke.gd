extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	var scene := load("res://scenes/d3_skeleton_transition.tscn") as PackedScene
	_check(scene != null, "D3 scene must load")
	if scene == null:
		quit(1)
		return
	var instance = scene.instantiate()
	root.add_child(instance)
	await process_frame
	var skeleton := instance.get("skeleton") as Skeleton3D
	_check(skeleton != null, "D3 must instantiate a Skeleton3D")
	_check(skeleton != null and skeleton.find_bone("head") >= 0, "GDBot Skeleton3D must expose the head bone")
	_check(instance.get("face") != null, "D3 must expose the real GDBot face animation target")
	_check(instance.get("expression_adapter") != null, "D3 must instantiate a separate expression Adapter")
	_check(bool(instance.get("plan_loaded")), "D3 must load the CODA MotionIntent ExecutionPlan fixture")
	_check(String(instance.get("motion_plan").get("event_id", "")) == "robot.acknowledge.user", "D3 plan must preserve the CODA event source")
	_check(String(instance.get("adapter_receipt").get("backend", "")) == "godot.motion@1", "D3 must expose a Godot backend receipt")
	_check(String(instance.get("adapter_receipt").get("execution_authority", "")) == "adapter_only", "D3 receipt must keep execution authority in the Adapter")
	var initial_generation := int(instance.get("transition_generation"))
	instance.request_intent("attack", Vector3(-8.0, -35.0, 5.0), 0.2)
	_check(int(instance.get("transition_generation")) > initial_generation, "intent admission must create a new generation")
	_check(String(instance.get("lease_owner")).begins_with("coda.transition."), "intent admission must own a lease")
	_check(String(instance.get("adapter_receipt").get("barrier", "")) == "accepted", "D3 must close the admission barrier before Adapter start")
	instance.request_expression("happy")
	_check(String(instance.get("expression_receipt").get("expression", "")) == "happy", "expression intent must reach the real GDBot face")
	_check(String(instance.get("expression_receipt").get("terminal", "")) == "applied", "expression Adapter must close its terminal receipt")
	instance.set_external_writer_active(true)
	var expression_generation := int(instance.get("expression_receipt").get("generation", 0))
	instance.request_expression("dizzy")
	_check(int(instance.get("expression_receipt").get("generation", 0)) == expression_generation, "external writer must block expression generation")
	instance.set_external_writer_active(false)
	await process_frame
	instance.request_intent("interrupt", Vector3.ZERO, 0.1)
	_check(String(instance.get("current_intent")) == "interrupted_to_safe", "interrupt must enter bounded safe convergence")
	_check(int(instance.get("transition_generation")) > initial_generation + 1, "interrupt must revoke the previous generation")
	_check(float(instance.get("transition_to").y) >= -60.0 and float(instance.get("transition_to").y) <= 60.0, "head yaw must remain within the declared hard limit")
	_check(instance.apply_transition_sample(initial_generation, Vector3(0.0, 60.0, 0.0)) == false, "late sample from an old generation must not write")
	instance.set_external_writer_active(true)
	var rejected_generation := int(instance.get("transition_generation"))
	instance.request_intent("defense", Vector3(12.0, 32.0, -4.0), 0.2)
	_check(int(instance.get("transition_generation")) == rejected_generation, "external writer rejection must not create a new generation")
	_check(String(instance.get("adapter_receipt").get("barrier", "")) == "rejected", "external writer must be rejected at the ownership barrier")
	_check(String(instance.get("adapter_receipt").get("terminal", "")) == "rejected", "external writer rejection must close a terminal receipt")
	instance.reset_fixture()
	instance.request_intent("attack", Vector3(-8.0, -35.0, 5.0), 0.2)
	var owner_generation := int(instance.get("transition_generation"))
	instance.owner_lost()
	instance.request_intent("defense", Vector3(12.0, 32.0, -4.0), 0.2)
	_check(int(instance.get("transition_generation")) == owner_generation, "owner loss must prevent a new Adapter generation")
	_check(String(instance.get("adapter_receipt").get("terminal", "")) == "owner_lost", "owner loss must close exactly one owner_lost terminal receipt")
	instance.queue_free()
	if failures.is_empty():
		print("D3 Skeleton3D transition smoke passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
