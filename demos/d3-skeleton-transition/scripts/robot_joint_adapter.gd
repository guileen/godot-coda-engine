class_name RobotJointAdapter
extends RefCounted

## Adapter boundary adapted from AIBI's local RobotJointAdapter reference.
## It is the only writer to the simulated skeleton; no hardware is connected.

signal command_rejected(reason: String)
signal terminal_receipt(generation: int, state: String)

var joints: Dictionary = {}
var current: Dictionary = {}
var _trajectory: Array[Dictionary] = []
var _trajectory_time_ms := 0.0
var _phase_segments: Array[Dictionary] = []
var _generation := -1
var _last_plan_id := ""

func register_joint(joint_name: String, minimum_deg: float, maximum_deg: float, max_speed_deg_s: float) -> void:
	assert(minimum_deg <= maximum_deg)
	assert(max_speed_deg_s > 0.0)
	joints[joint_name] = {"min_deg": minimum_deg, "max_deg": maximum_deg, "max_speed_deg_s": max_speed_deg_s}
	current[joint_name] = 0.0

func submit_transition_plan(plan: Dictionary, generation: int, tick_hz := 60.0) -> Dictionary:
	if plan.get("plan_type") != "TransitionPlan" or plan.get("execution_authority") != "adapter_only":
		return _reject("invalid_transition_plan")
	if not plan.get("lease", {}) is Dictionary or int(plan.lease.get("generation", -1)) != generation:
		return _reject("invalid_plan_lease")
	if generation <= _generation:
		return _reject("stale_generation")
	var segments: Array = plan.get("segments", [])
	if segments.is_empty() or tick_hz <= 0.0:
		return _reject("empty_plan_or_invalid_tick_rate")
	if not _pose_matches(segments[0].get("start", {})):
		return _reject("plan_start_state_mismatch")
	var points: Array[Dictionary] = []
	var phase_segments: Array[Dictionary] = []
	var elapsed_ticks := 0
	var previous_end: Dictionary = {}
	for index in range(segments.size()):
		var segment: Dictionary = segments[index]
		var start: Dictionary = segment.get("start", {})
		var finish: Dictionary = segment.get("end", {})
		var duration_ticks := int(segment.get("duration_ticks", 0))
		if not _valid_pose(start) or not _valid_pose(finish) or not _same_joint_set(start, finish) or duration_ticks <= 0:
			return _reject("invalid_plan_segment_state")
		if index > 0 and not _poses_approx_equal(start, previous_end):
			return _reject("discontinuous_plan_segment")
		if index == 0:
			points.append({"t_ms": 0.0, "joints": start.duplicate(true)})
		for joint_name in start:
			var joint_id := String(joint_name)
			var max_speed := float(joints[joint_id].max_speed_deg_s)
			var speed := absf(float(finish[joint_name]) - float(start[joint_name])) / (float(duration_ticks) / tick_hz)
			if speed > max_speed + 0.001:
				return _reject("joint_speed_limit:%s" % joint_id)
		elapsed_ticks += duration_ticks
		var end_ms := float(elapsed_ticks) * 1000.0 / tick_hz
		points.append({"t_ms": end_ms, "joints": finish.duplicate(true)})
		phase_segments.append({
			"phase_id": String(segment.get("segment_id", "segment.%d" % index)),
			"start_ms": end_ms - float(duration_ticks) * 1000.0 / tick_hz,
			"end_ms": end_ms,
		})
		previous_end = finish
	for point in points:
		for joint_name in point.joints:
			if not joints.has(String(joint_name)):
				return _reject("unknown_joint:%s" % String(joint_name))
			var value := float(point.joints[joint_name])
			var bounds: Dictionary = joints[joint_name]
			if value < float(bounds.min_deg) or value > float(bounds.max_deg):
				return _reject("joint_limit:%s" % String(joint_name))
	_trajectory = points
	_phase_segments = phase_segments
	_trajectory_time_ms = 0.0
	_generation = generation
	_last_plan_id = String(plan.get("plan_id", ""))
	return {"ok": true, "generation": _generation, "plan_id": _last_plan_id, "points": points.size(), "duration_ms": points.back().t_ms}

func interrupt_to(joint_targets: Dictionary, generation: int, transition_ms := 250) -> Dictionary:
	if joint_targets.is_empty():
		return _reject("empty_interrupt_target")
	if generation <= _generation:
		return _reject("stale_generation")
	var safe_targets: Dictionary = {}
	var transition_duration := maxf(1.0, float(transition_ms))
	for joint_name in joint_targets:
		var name := String(joint_name)
		if not joints.has(name):
			return _reject("interrupt_unknown_joint:%s" % name)
		var value := float(joint_targets[joint_name])
		var bounds: Dictionary = joints[name]
		if value < float(bounds.min_deg) or value > float(bounds.max_deg):
			return _reject("interrupt_joint_limit:%s" % name)
		var start_value := float(current.get(name, 0.0))
		var minimum_duration := absf(value - start_value) / float(bounds.max_speed_deg_s) * 1000.0
		if minimum_duration > transition_duration + 0.001:
			return _reject("interrupt_speed_limit:%s" % name)
		safe_targets[name] = value
	var start_pose: Dictionary = {}
	for name in safe_targets:
		start_pose[name] = float(current.get(name, 0.0))
	_trajectory = [
		{"t_ms": 0.0, "joints": start_pose},
		{"t_ms": transition_duration, "joints": safe_targets},
	]
	_phase_segments = [{"phase_id": "safety.recovery", "start_ms": 0.0, "end_ms": transition_duration}]
	_trajectory_time_ms = 0.0
	_generation = generation
	_last_plan_id = "recovery.safe_neutral"
	return {"ok": true, "cancelled_generation": generation - 1, "generation": generation, "transition_ms": transition_ms}

func tick(delta_seconds: float) -> void:
	if _trajectory.is_empty():
		return
	_trajectory_time_ms += maxf(0.0, delta_seconds) * 1000.0
	if _trajectory_time_ms >= float(_trajectory.back().t_ms):
		_apply_point(_trajectory.back())
		_trajectory.clear()
		terminal_receipt.emit(_generation, "completed")
		return
	for index in range(1, _trajectory.size()):
		var left: Dictionary = _trajectory[index - 1]
		var right: Dictionary = _trajectory[index]
		if _trajectory_time_ms <= float(right.t_ms):
			var amount := clampf((_trajectory_time_ms - float(left.t_ms)) / maxf(1.0, float(right.t_ms) - float(left.t_ms)), 0.0, 1.0)
			_interpolate_points(left, right, amount)
			return

func is_executing() -> bool:
	return not _trajectory.is_empty()

func progress() -> float:
	if _trajectory.is_empty():
		return 1.0
	return clampf(_trajectory_time_ms / maxf(1.0, float(_trajectory.back().t_ms)), 0.0, 1.0)

func phase_snapshot() -> Dictionary:
	if _phase_segments.is_empty():
		return {"state": "idle", "phase_id": "idle", "segment_index": 0, "segment_count": 0, "segment_progress": 0.0, "overall_progress": 1.0}
	var at_ms := clampf(_trajectory_time_ms, 0.0, float(_trajectory.back().t_ms) if not _trajectory.is_empty() else _phase_segments.back().end_ms)
	for index in range(_phase_segments.size()):
		var segment: Dictionary = _phase_segments[index]
		if at_ms <= float(segment.end_ms) or index == _phase_segments.size() - 1:
			var duration_ms := maxf(1.0, float(segment.end_ms) - float(segment.start_ms))
			return {
				"state": "executing" if is_executing() else "completed",
				"phase_id": segment.phase_id,
				"segment_index": index + 1,
				"segment_count": _phase_segments.size(),
				"segment_progress": clampf((at_ms - float(segment.start_ms)) / duration_ms, 0.0, 1.0),
				"overall_progress": progress(),
			}
	return {"state": "completed", "phase_id": _phase_segments.back().phase_id, "segment_index": _phase_segments.size(), "segment_count": _phase_segments.size(), "segment_progress": 1.0, "overall_progress": 1.0}

func generation() -> int:
	return _generation

func get_joint_value(joint_name: String) -> float:
	return float(current.get(joint_name, 0.0))

func last_plan_id() -> String:
	return _last_plan_id

func can_start_plan(plan: Dictionary) -> bool:
	var segments: Array = plan.get("segments", [])
	return not segments.is_empty() and _pose_matches(segments[0].get("start", {}))

func set_pose(generation: int, pose: Dictionary) -> bool:
	if generation != _generation or not _valid_pose(pose):
		return false
	_apply_point({"joints": pose})
	return true

func reset() -> void:
	_trajectory.clear()
	_trajectory_time_ms = 0.0
	_phase_segments.clear()
	_generation = -1
	_last_plan_id = ""
	for joint_name in current.keys():
		_set_joint(String(joint_name), 0.0)

func _pose_matches(pose: Dictionary) -> bool:
	if not _valid_pose(pose):
		return false
	for joint_name in pose:
		if not is_equal_approx(float(pose[joint_name]), float(current.get(String(joint_name), 0.0))):
			return false
	return true

func _same_joint_set(left: Dictionary, right: Dictionary) -> bool:
	if left.size() != right.size():
		return false
	for joint_name in left:
		if not right.has(joint_name):
			return false
	return true

func _poses_approx_equal(left: Dictionary, right: Dictionary) -> bool:
	if not _same_joint_set(left, right):
		return false
	for joint_name in left:
		if not is_equal_approx(float(left[joint_name]), float(right[joint_name])):
			return false
	return true

func _valid_pose(pose: Dictionary) -> bool:
	if pose.is_empty():
		return false
	for joint_name in pose:
		if not joints.has(String(joint_name)) or not is_finite(float(pose[joint_name])):
			return false
	return true

func _apply_point(point: Dictionary) -> void:
	for joint_name in point.get("joints", {}):
		_set_joint(String(joint_name), float(point.joints[joint_name]))

func _interpolate_points(left: Dictionary, right: Dictionary, amount: float) -> void:
	for joint_name in right.joints:
		var name := String(joint_name)
		_set_joint(name, lerpf(float(left.joints.get(name, current.get(name, 0.0))), float(right.joints[name]), amount))

func _set_joint(joint_name: String, value_deg: float) -> void:
	current[joint_name] = value_deg
	_apply_joint(joint_name, value_deg)

func _apply_joint(_joint_name: String, _value_deg: float) -> void:
	pass

func _reject(reason: String) -> Dictionary:
	command_rejected.emit(reason)
	return {"ok": false, "error": reason}
