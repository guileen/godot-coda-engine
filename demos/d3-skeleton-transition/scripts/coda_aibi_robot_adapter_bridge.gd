class_name CodaAibiRobotAdapterBridge
extends RefCounted

## Adds CODA plan admission and generation ownership around AIBI's public
## RobotJointAdapter API, then projects its joint state onto the GDBot skeleton.
## The wrapped adapter remains the trajectory/interruption executor.

signal command_rejected(reason: String)
signal terminal_receipt(generation: int, state: String)

const JOINT_PROFILE := {
	"head_pitch": {"min_deg": -15.0, "max_deg": 25.0, "max_speed_deg_s": 90.0},
	"head_yaw": {"min_deg": -60.0, "max_deg": 60.0, "max_speed_deg_s": 120.0},
	"head_roll": {"min_deg": -20.0, "max_deg": 20.0, "max_speed_deg_s": 90.0},
}

var backend: Variant
var skeleton: Skeleton3D
var current: Dictionary = {}
var _generation := -1
var _plan_id := ""
var _active_duration_ms := 0.0
var _elapsed_ms := 0.0
var _phase_segments: Array[Dictionary] = []
var _was_executing := false
var _head_bone := -1

func _init(aibi_adapter: Variant, target_skeleton: Skeleton3D) -> void:
	backend = aibi_adapter
	skeleton = target_skeleton
	if backend == null or skeleton == null:
		return
	for joint_name in JOINT_PROFILE:
		backend.register_joint(
			joint_name,
			float(JOINT_PROFILE[joint_name].min_deg),
			float(JOINT_PROFILE[joint_name].max_deg),
			float(JOINT_PROFILE[joint_name].max_speed_deg_s)
		)
		current[joint_name] = float(backend.get_joint_value(joint_name))
	_head_bone = skeleton.find_bone("head")
	_project_head_pose()

func submit_transition_plan(plan: Dictionary, generation: int, tick_hz := 60.0) -> Dictionary:
	if backend == null:
		return _reject("aibi_adapter_unavailable")
	if plan.get("plan_type") != "TransitionPlan" or plan.get("execution_authority") != "adapter_only":
		return _reject("invalid_transition_plan")
	var lease: Variant = plan.get("lease", null)
	if not lease is Dictionary or int(lease.get("generation", -1)) != generation:
		return _reject("invalid_plan_lease")
	if generation <= _generation:
		return _reject("stale_generation")
	if tick_hz <= 0.0:
		return _reject("invalid_tick_rate")
	var segments: Array = plan.get("segments", [])
	if segments.is_empty():
		return _reject("empty_transition_plan")
	var points: Array[Dictionary] = []
	var phase_segments: Array[Dictionary] = []
	var elapsed_ticks := 0
	var previous_end: Dictionary = {}
	for index in range(segments.size()):
		var segment: Dictionary = segments[index]
		var start: Dictionary = segment.get("start", {})
		var finish: Dictionary = segment.get("end", {})
		var duration_ticks := int(segment.get("duration_ticks", 0))
		if duration_ticks <= 0 or not _valid_pose(start) or not _valid_pose(finish) or not _same_joint_set(start, finish):
			return _reject("invalid_plan_segment_state")
		if index == 0:
			if not _pose_matches(start):
				return _reject("plan_start_state_mismatch")
			points.append({"t_ms": 0.0, "joints": start.duplicate(true)})
		elif not _poses_approx_equal(start, previous_end):
			return _reject("discontinuous_plan_segment")
		for joint_name in start:
			var name := String(joint_name)
			var speed_limit := float(JOINT_PROFILE[name].max_speed_deg_s)
			var duration_seconds := float(duration_ticks) / tick_hz
			var speed := absf(float(finish[joint_name]) - float(start[joint_name])) / duration_seconds
			if speed > speed_limit + 0.001:
				return _reject("joint_speed_limit:%s" % name)
		elapsed_ticks += duration_ticks
		var end_ms := float(elapsed_ticks) * 1000.0 / tick_hz
		points.append({
			"t_ms": end_ms,
			"joints": finish.duplicate(true),
		})
		phase_segments.append({
			"phase_id": String(segment.get("segment_id", "segment.%d" % index)),
			"start_ms": end_ms - float(duration_ticks) * 1000.0 / tick_hz,
			"end_ms": end_ms,
		})
		previous_end = finish
	var result: Dictionary = backend.submit_trajectory(points)
	if not result.get("ok", false):
		return _reject("aibi_trajectory_rejected:%s" % String(result.get("error", "unknown")))
	_generation = generation
	_plan_id = String(plan.get("plan_id", ""))
	_phase_segments = phase_segments
	_active_duration_ms = float(points.back().t_ms)
	_elapsed_ms = 0.0
	_was_executing = true
	_sync_from_backend()
	return {
		"ok": true,
		"generation": _generation,
		"plan_id": _plan_id,
		"points": points.size(),
		"duration_ms": _active_duration_ms,
		"backend": "aibi.robot_joint_adapter",
	}

func interrupt_to(joint_targets: Dictionary, generation: int, transition_ms := 250) -> Dictionary:
	if backend == null:
		return _reject("aibi_adapter_unavailable")
	if joint_targets.is_empty():
		return _reject("empty_interrupt_target")
	if generation <= _generation:
		return _reject("stale_generation")
	var duration := maxf(1.0, float(transition_ms))
	for joint_name in joint_targets:
		var name := String(joint_name)
		if not JOINT_PROFILE.has(name):
			return _reject("interrupt_unknown_joint:%s" % name)
		var target := float(joint_targets[joint_name])
		if not _within_joint_bounds(name, target):
			return _reject("interrupt_joint_limit:%s" % name)
		var speed := absf(target - float(current.get(name, 0.0))) / (duration / 1000.0)
		if speed > float(JOINT_PROFILE[name].max_speed_deg_s) + 0.001:
			return _reject("interrupt_speed_limit:%s" % name)
	var result: Dictionary = backend.interrupt_to(joint_targets, int(duration))
	if not result.get("ok", false):
		return _reject("aibi_interrupt_rejected:%s" % String(result.get("error", "unknown")))
	_generation = generation
	_plan_id = "recovery.safe_neutral"
	_phase_segments = [{"phase_id": "safety.recovery", "start_ms": 0.0, "end_ms": duration}]
	_active_duration_ms = duration
	_elapsed_ms = 0.0
	_was_executing = true
	return {"ok": true, "generation": _generation, "transition_ms": duration}

func tick(delta_seconds: float) -> void:
	if backend == null:
		return
	backend.tick(delta_seconds)
	_sync_from_backend()
	if _was_executing:
		_elapsed_ms = minf(_active_duration_ms, _elapsed_ms + maxf(0.0, delta_seconds) * 1000.0)
		if not backend.is_executing_trajectory():
			_was_executing = false
			terminal_receipt.emit(_generation, "completed")

func is_executing() -> bool:
	return backend != null and backend.is_executing_trajectory()

func progress() -> float:
	if is_executing():
		return clampf(_elapsed_ms / maxf(1.0, _active_duration_ms), 0.0, 1.0)
	return 1.0

func phase_snapshot() -> Dictionary:
	if _phase_segments.is_empty():
		return {"state": "idle", "phase_id": "idle", "segment_index": 0, "segment_count": 0, "segment_progress": 0.0, "overall_progress": 1.0}
	var at_ms := clampf(_elapsed_ms, 0.0, _active_duration_ms)
	for index in range(_phase_segments.size()):
		var segment: Dictionary = _phase_segments[index]
		if at_ms <= float(segment.end_ms) or index == _phase_segments.size() - 1:
			var duration_ms := maxf(1.0, float(segment.end_ms) - float(segment.start_ms))
			return {
				"state": "executing" if _was_executing else "completed",
				"phase_id": segment.phase_id,
				"segment_index": index + 1,
				"segment_count": _phase_segments.size(),
				"segment_progress": clampf((at_ms - float(segment.start_ms)) / duration_ms, 0.0, 1.0),
				"overall_progress": progress(),
			}
	return {"state": "completed", "phase_id": _phase_segments.back().phase_id, "segment_index": _phase_segments.size(), "segment_count": _phase_segments.size(), "segment_progress": 1.0, "overall_progress": 1.0}

func can_start_plan(plan: Dictionary) -> bool:
	var segments: Array = plan.get("segments", [])
	return not segments.is_empty() and _pose_matches(segments[0].get("start", {}))

func set_pose(generation: int, pose: Dictionary) -> bool:
	if backend == null or generation != _generation or not _valid_pose(pose):
		return false
	for joint_name in pose:
		var name := String(joint_name)
		var result: Dictionary = backend.set_joint_target(name, float(pose[joint_name]))
		if not result.get("ok", false):
			return false
	_sync_from_backend()
	return true

func reset() -> void:
	if backend == null:
		return
	var neutral := {}
	for joint_name in JOINT_PROFILE:
		neutral[joint_name] = 0.0
	backend.interrupt_to(neutral, 1)
	for joint_name in neutral:
		backend.set_joint_target(String(joint_name), 0.0)
	_generation = -1
	_plan_id = ""
	_active_duration_ms = 0.0
	_elapsed_ms = 0.0
	_phase_segments.clear()
	_was_executing = false
	_sync_from_backend()

func last_plan_id() -> String:
	return _plan_id

func generation() -> int:
	return _generation

func get_joint_value(joint_name: String) -> float:
	return float(current.get(joint_name, 0.0))

func _sync_from_backend() -> void:
	for joint_name in JOINT_PROFILE:
		current[joint_name] = float(backend.get_joint_value(joint_name))
	_project_head_pose()

func _project_head_pose() -> void:
	if skeleton == null or _head_bone < 0:
		return
	var euler := Vector3(
		deg_to_rad(float(current.get("head_pitch", 0.0))),
		deg_to_rad(float(current.get("head_yaw", 0.0))),
		deg_to_rad(float(current.get("head_roll", 0.0))),
	)
	skeleton.set_bone_pose_rotation(_head_bone, Quaternion.from_euler(euler))

func _pose_matches(pose: Dictionary) -> bool:
	if not _valid_pose(pose):
		return false
	for joint_name in pose:
		if not is_equal_approx(float(pose[joint_name]), float(current.get(String(joint_name), 0.0))):
			return false
	return true

func _valid_pose(pose: Dictionary) -> bool:
	if pose.is_empty():
		return false
	for joint_name in pose:
		var name := String(joint_name)
		if not JOINT_PROFILE.has(name) or not is_finite(float(pose[joint_name])) or not _within_joint_bounds(name, float(pose[joint_name])):
			return false
	return true

func _within_joint_bounds(joint_name: String, value: float) -> bool:
	var bounds: Dictionary = JOINT_PROFILE[joint_name]
	return value >= float(bounds.min_deg) and value <= float(bounds.max_deg)

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

func _reject(reason: String) -> Dictionary:
	command_rejected.emit(reason)
	return {"ok": false, "error": reason}
