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
	_check(instance.get("attack_button") is Button, "D3 must provide an on-screen attack intent button")
	_check(instance.get("guard_button") is Button, "D3 must provide an on-screen high-priority guard button")
	_check(instance.get("interrupt_button") is Button, "D3 must provide an on-screen safe interrupt button")
	_check(instance.get("external_writer_button") is Button and instance.get("reset_button") is Button, "D3 must provide visible failure-injection and reset controls")
	var skeleton := instance.get("skeleton") as Skeleton3D
	_check(skeleton != null, "D3 must instantiate a Skeleton3D")
	_check(skeleton != null and skeleton.find_bone("head") >= 0, "GDBot Skeleton3D must expose the head bone")
	_check(instance.get("face") != null, "D3 must expose the real GDBot face animation target")
	_check(instance.get("expression_adapter") != null, "D3 must instantiate a separate expression Adapter")
	_check(instance.get("plan_loaded") == true, "D3 must load CODA generated TransitionPlans")
	var plans: Dictionary = instance.get("motion_plans")
	_check(plans.has("robot.attack_recover@1") and plans.has("robot.high_guard@1"), "both CODA motion intents must have generated TransitionPlans")
	var adapter = instance.get("robot_adapter")
	var configured_aibi_path := OS.get_environment("CODA_AIBI_ROBOT_JOINT_ADAPTER")
	if not configured_aibi_path.is_empty():
		var wrapped_aibi_adapter: Variant = adapter.get("backend") if adapter != null else null
		_check(wrapped_aibi_adapter != null, "configured AIBI source must be the active trajectory backend")
		_check(wrapped_aibi_adapter != null and String(wrapped_aibi_adapter.get_script().resource_path) == configured_aibi_path, "D3 must load the exact configured AIBI RobotJointAdapter source")
	var initial_generation := int(instance.get("transition_generation"))
	instance.attack_button.pressed.emit()
	_check(instance.reset_button.disabled, "reset button must not interrupt a live transition by teleporting the pose")
	_check(int(instance.get("transition_generation")) > initial_generation, "admitted CODA plan must create a fresh lease generation")
	_check(String(instance.get("lease_owner")).begins_with("coda.transition."), "admitted intent must own a lease")
	_check(String(instance.get("adapter_receipt").get("barrier", "")) == "accepted", "D3 must close the admission barrier before Adapter start")
	_check(String(instance.get("motion_plan").get("source_asset", "")) == "robot.attack.recover", "Adapter must receive a plan generated from the CODA source asset")
	var attack_phase: Dictionary = adapter.phase_snapshot()
	_check(String(attack_phase.get("phase_id", "")) == "robot.attack.recover.approach" and int(attack_phase.get("segment_index", 0)) == 1 and int(attack_phase.get("segment_count", 0)) == 2, "D3 must expose the generated plan's first semantic phase")
	instance.request_expression("happy")
	_check(String(instance.get("expression_receipt").get("expression", "")) == "happy", "expression intent must reach the real GDBot face")
	_check(String(instance.get("expression_receipt").get("terminal", "")) == "applied", "expression Adapter must close its terminal receipt")
	instance.external_writer_button.pressed.emit()
	_check(instance.external_writer_active, "external-writer button must enable the rejection case")
	await create_timer(0.45).timeout
	attack_phase = adapter.phase_snapshot()
	_check(String(attack_phase.get("phase_id", "")) == "robot.attack.recover.return" and int(attack_phase.get("segment_index", 0)) == 2 and float(attack_phase.get("segment_progress", 1.0)) < 1.0, "D3 must report live progress in the generated plan's return phase")
	var expression_generation := int(instance.get("expression_receipt").get("generation", 0))
	instance.request_expression("dizzy")
	_check(int(instance.get("expression_receipt").get("generation", 0)) == expression_generation, "external writer must block expression generation")
	instance.external_writer_button.pressed.emit()
	# A higher-priority generated intent must revoke the running generation, return
	# safely to its declared neutral pose, then start its own generated plan.
	var attack_generation := int(instance.get("transition_generation"))
	instance.guard_button.pressed.emit()
	_check(int(instance.get("transition_generation")) > attack_generation, "higher priority intent must revoke the running generation")
	_check(String(instance.get("adapter_receipt").get("terminal", "")) == "preempted", "preemption must close the old generation receipt")
	await create_timer(1.25).timeout
	_check(String(instance.get("motion_plan").get("source_asset", "")) == "robot.high.guard", "pending high-priority generated plan must run after safe convergence")
	_check(String(instance.get("adapter_receipt").get("terminal", "")) == "completed", "generated TransitionPlan must produce a terminal completion receipt")
	_check(not instance.reset_button.disabled, "reset button must become available after the transition completes")
	var head_bone := skeleton.find_bone("head")
	_check(head_bone >= 0 and not skeleton.get_bone_pose_rotation(head_bone).is_equal_approx(Quaternion.IDENTITY), "Adapter must project the generated plan onto the GDBot head bone")
	var old_generation := int(instance.get("transition_generation")) - 1
	var pose_before: Dictionary = adapter.current.duplicate(true)
	_check(not adapter.set_pose(old_generation, {"head_pitch": 0.0, "head_yaw": 0.0, "head_roll": 0.0}), "late write from a revoked generation must be rejected")
	_check(adapter.current == pose_before, "rejected stale write must leave the skeleton target unchanged")
	instance.interrupt_button.pressed.emit()
	_check(String(instance.get("current_intent")) == "安全收敛", "interrupt must start safe convergence through the Adapter")
	await create_timer(0.4).timeout
	_check(absf(float(adapter.current.get("head_pitch", 1.0))) < 0.01 and absf(float(adapter.current.get("head_yaw", 1.0))) < 0.01, "safe convergence must end at the declared neutral pose")
	instance.external_writer_button.pressed.emit()
	var rejected_generation := int(instance.get("transition_generation"))
	instance.request_intent("robot.attack_recover@1")
	_check(int(instance.get("transition_generation")) == rejected_generation, "external writer rejection must not create a new generation")
	_check(String(instance.get("adapter_receipt").get("barrier", "")) == "rejected", "external writer must be rejected at the ownership barrier")
	_check(String(instance.get("adapter_receipt").get("terminal", "")) == "rejected", "external writer rejection must close a terminal receipt")
	instance.reset_button.pressed.emit()
	_check(instance.owner_valid and not instance.external_writer_active, "reset button must restore the demo fixture")
	instance.request_intent("robot.attack_recover@1")
	var owner_generation := int(instance.get("transition_generation"))
	instance.owner_lost_button.pressed.emit()
	instance.request_intent("robot.high_guard@1")
	_check(int(instance.get("transition_generation")) == owner_generation + 1, "owner loss may revoke once but must prevent another Adapter generation")
	_check(String(instance.get("adapter_receipt").get("terminal", "")) == "owner_lost", "owner loss must close an owner_lost terminal receipt")
	instance.queue_free()
	if failures.is_empty():
		print("D3 generated TransitionPlan → Adapter → Skeleton3D smoke passed (AIBI source active: %s)" % str(not configured_aibi_path.is_empty()))
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
