class_name GSEOS_RunContext
extends RefCounted

var values: Dictionary
var owner: Object
var cancelled := false
var cancel_reason := ""
var current_source_ref: Dictionary = {}
var event_id := ""
var plan_fingerprint := ""
var run_id := 0
var steps: Array[Dictionary] = []
var _next_step_id := 1

func _init(initial_values := {}, initial_owner: Object = null, initial_event_id := "", initial_plan_fingerprint := "", initial_run_id := 0) -> void:
	values = initial_values.duplicate(true)
	owner = initial_owner
	event_id = initial_event_id
	plan_fingerprint = initial_plan_fingerprint
	run_id = initial_run_id

func get_value(name: String, default_value = null) -> Variant:
	return values.get(name, default_value)

func set_value(name: String, value) -> void:
	values[name] = value

func owner_is_valid() -> bool:
	return owner == null or is_instance_valid(owner)

func request_cancel(reason := "cancelled") -> void:
	cancelled = true
	cancel_reason = reason

func record_step(node_id: String, slot: String, status: String, target_id := "") -> void:
	var step := {"step_id": _next_step_id, "node_id": node_id, "slot": slot, "status": status}
	if not String(target_id).is_empty():
		step["target_id"] = target_id
	steps.append(step)
	_next_step_id += 1

func runtime_trace() -> Dictionary:
	return {"trace_type": "RuntimeTrace", "schema_version": 1, "run_id": run_id, "event_id": event_id, "plan_fingerprint": plan_fingerprint, "steps": steps.duplicate(true)}
