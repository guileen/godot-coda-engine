class_name GSEOS_BehaviorRuntime
extends RefCounted

# EventAsset.behavior_runtime is the only editable definition.  This class is a
# Godot adapter for its already-validated, finite behavior plan; it never
# accepts direct Blackboard or state mutation from a scene, device, or cloud.

var event_asset_id := ""
var behavior: Dictionary = {}
var capabilities
var state := ""
var blackboard: Dictionary = {}
var valid := false
var diagnostics: Array[Dictionary] = []
var _events: Dictionary = {}
var _states: Dictionary = {}
var _state_parents: Dictionary = {}
var _effects: Dictionary = {}
var _fields: Dictionary = {}
var _rules: Dictionary = {}
var _active_effects: Dictionary = {}
var _queue: Array[Dictionary] = []
var _entries: Array[Dictionary] = []
var _next_sequence := 1
var _next_entry_id := 1
var _plan_fingerprint := ""

func _init(asset: Dictionary, capability_registry = null) -> void:
	capabilities = capability_registry
	event_asset_id = String(asset.get("event_id", ""))
	_plan_fingerprint = _fingerprint(asset)
	behavior = Dictionary(asset.get("behavior_runtime", {})).duplicate(true)
	_validate_and_index(asset)
	if not valid:
		return
	state = String(behavior.initial_state)
	for field in behavior.blackboard:
		blackboard[String(field.field_id)] = field.default

func enqueue(event_id: String, source := "local", sequence := -1) -> int:
	var assigned: int = sequence if sequence >= 1 else _next_sequence
	_next_sequence = max(_next_sequence, assigned + 1)
	if not _events.has(event_id):
		_add("EventRejected", _event_ref(event_id), {"event_id": event_id, "source": source, "sequence": assigned, "reason": "UNKNOWN_EVENT"})
		return assigned
	_queue.append({"event_id": event_id, "event": _events[event_id], "source": source, "sequence": assigned})
	return assigned

func can_dispatch(event_id: String) -> bool:
	return valid and not _rule_for(state, event_id).is_empty()

func drain() -> Dictionary:
	_queue.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_priority := int(left.event.priority)
		var right_priority := int(right.event.priority)
		return left_priority > right_priority if left_priority != right_priority else int(left.sequence) < int(right.sequence)
	)
	var batch: Array[Dictionary] = _queue.duplicate(true)
	_queue.clear()
	for item in batch:
		_process(item)
	return trace()

func trace() -> Dictionary:
	return {
		"trace_type": "BehaviorRuntimeTrace",
		"schema_version": 1,
		"behavior_id": behavior.get("behavior_id", ""),
		"event_asset_id": event_asset_id,
		"plan_fingerprint": _plan_fingerprint,
		"final_state": state,
		"blackboard": blackboard.duplicate(true),
		"entries": _entries.duplicate(true),
	}

func _process(item: Dictionary) -> void:
	if not valid:
		return
	var event: Dictionary = item.event
	var event_id := String(item.event_id)
	var completion_effect_id := String(event.get("completion_effect_id", ""))
	if not completion_effect_id.is_empty() and not _active_effects.has(completion_effect_id):
		_add("EventIgnored", _event_ref(event_id), {"event_id": event_id, "sequence": item.sequence, "reason": "STALE_COMPLETION", "completion_effect_id": completion_effect_id})
		return
	var rule: Dictionary = _rule_for(state, event_id)
	if rule.is_empty():
		_add("EventRejected", _event_ref(event_id), {"event_id": event_id, "sequence": item.sequence, "reason": "NO_MATCHING_RULE", "state": state})
		return
	if not _writes_are_valid(rule, event_id):
		_add("EventRejected", _rule_ref(String(rule.rule_id)), {"event_id": event_id, "sequence": item.sequence, "reason": "INVALID_BLACKBOARD_WRITE"})
		return
	_add("EventArbitrated", _event_ref(event_id), {"event_id": event_id, "priority": event.priority, "sequence": item.sequence, "source": item.source, "rule_id": rule.rule_id})
	if not completion_effect_id.is_empty():
		_active_effects.erase(completion_effect_id)
		_add("EffectCompleted", _effect_ref(completion_effect_id), {"effect_id": completion_effect_id, "event_id": event_id})
	var previous: String = state
	if completion_effect_id.is_empty() and previous != String(rule.to_state):
		_cancel_effects_owned_by(previous, event_id)
	for field_id in Dictionary(rule.blackboard_writes):
		blackboard[String(field_id)] = rule.blackboard_writes[field_id]
		_add("BlackboardWritten", _rule_ref(String(rule.rule_id)), {"field_id": field_id, "value": rule.blackboard_writes[field_id], "event_id": event_id})
	state = String(rule.to_state)
	_add("StateTransition", _rule_ref(String(rule.rule_id)), {"rule_id": rule.rule_id, "from_state": previous, "to_state": state, "event_id": event_id})
	for effect_id in rule.effects:
		_start_effect(String(effect_id), event_id)

func _start_effect(effect_id: String, event_id: String) -> void:
	var effect: Dictionary = _effects[effect_id]
	if bool(effect.cancellable):
		_active_effects[effect_id] = effect
	var args: Dictionary = Dictionary(effect.get("args", {})).duplicate(true)
	args.merge({"effect_id": effect_id, "state": state, "event_id": event_id}, true)
	_invoke(String(effect.capability), args)
	_add("EffectStarted", _effect_ref(effect_id), {"effect_id": effect_id, "capability": effect.capability, "owner_state": effect.owner_state})

func _cancel_effects_owned_by(owner_state: String, event_id: String) -> void:
	for effect_id in _active_effects.keys().duplicate():
		var effect: Dictionary = _active_effects[effect_id]
		if String(effect.owner_state) != owner_state:
			continue
		_active_effects.erase(effect_id)
		_add("EffectCancelled", _effect_ref(effect_id), {"effect_id": effect_id, "event_id": event_id})
		var convergence_id := String(effect.get("convergence_effect_id", ""))
		if not convergence_id.is_empty():
			var convergence: Dictionary = _effects[convergence_id]
			_invoke(String(convergence.capability), {"effect_id": convergence_id, "cancelled_effect_id": effect_id, "event_id": event_id})
			_add("EffectConverged", _effect_ref(convergence_id), {"effect_id": convergence_id, "cancelled_effect_id": effect_id, "event_id": event_id})

func _invoke(capability: String, args: Dictionary) -> void:
	if capabilities != null and not capabilities.resolve(capability).is_empty():
		var invocation := args.duplicate(true)
		invocation["capability"] = capability
		capabilities.invoke(capability, invocation)

func _writes_are_valid(rule: Dictionary, event_id: String) -> bool:
	for field_id in Dictionary(rule.blackboard_writes):
		var field: Dictionary = _fields.get(String(field_id), {})
		if field.is_empty() or not Array(field.writable_by_events).has(event_id) or not _valid_value(field, rule.blackboard_writes[field_id]):
			return false
	return true

func _validate_and_index(asset: Dictionary) -> void:
	if asset.get("asset_type") != "EventAsset" or behavior.is_empty():
		_fail("BEHAVIOR_EXTENSION_REQUIRED", "/behavior_runtime")
		return
	for required in ["behavior_type", "behavior_id", "initial_state", "states", "events", "blackboard", "effects", "rules"]:
		if not behavior.has(required):
			_fail("INVALID_BEHAVIOR_RUNTIME", "/behavior_runtime/" + required)
			return
	for item in behavior.states:
		if _states.has(item.state_id):
			_fail("DUPLICATE_STATE_ID", "/behavior_runtime/states")
			return
		_states[String(item.state_id)] = true
		_state_parents[String(item.state_id)] = String(item.get("parent_state_id", ""))
	if not _states.has(String(behavior.initial_state)):
		_fail("INITIAL_STATE_NOT_DECLARED", "/behavior_runtime/initial_state")
		return
	for state_id in _state_parents:
		var seen: Dictionary = {state_id: true}
		var parent := String(_state_parents[state_id])
		while not parent.is_empty():
			if not _states.has(parent) or seen.has(parent):
				_fail("INVALID_STATE_HIERARCHY", "/behavior_runtime/states")
				return
			seen[parent] = true
			parent = String(_state_parents.get(parent, ""))
	for item in behavior.events:
		if _events.has(item.event_id):
			_fail("DUPLICATE_BEHAVIOR_EVENT_ID", "/behavior_runtime/events")
			return
		_events[String(item.event_id)] = item
	for item in behavior.blackboard:
		if _fields.has(item.field_id) or not _valid_value(item, item.default):
			_fail("INVALID_BLACKBOARD_FIELD", "/behavior_runtime/blackboard")
			return
		_fields[String(item.field_id)] = item
	for item in behavior.effects:
		if _effects.has(item.effect_id) or not _states.has(String(item.owner_state)):
			_fail("INVALID_BEHAVIOR_EFFECT", "/behavior_runtime/effects")
			return
		_effects[String(item.effect_id)] = item
	for item in behavior.rules:
		var key := "%s:%s" % [item.from_state, item.event_id]
		if _rules.has(key) or not _states.has(String(item.from_state)) or not _states.has(String(item.to_state)) or not _events.has(String(item.event_id)):
			_fail("INVALID_BEHAVIOR_RULE", "/behavior_runtime/rules")
			return
		for effect_id in item.effects:
			if not _effects.has(String(effect_id)):
				_fail("UNKNOWN_RULE_EFFECT", "/behavior_runtime/rules")
				return
		_rules[key] = item
	valid = true

func _valid_value(field: Dictionary, value: Variant) -> bool:
	if String(field.type) == "number" and not (value is int or value is float):
		return false
	if String(field.type) == "string" and not (value is String):
		return false
	if String(field.type) == "boolean" and not (value is bool):
		return false
	if field.has("minimum") and float(value) < float(field.minimum):
		return false
	if field.has("maximum") and float(value) > float(field.maximum):
		return false
	return true

func _rule_for(state_id: String, event_id: String) -> Dictionary:
	var cursor := state_id
	while not cursor.is_empty():
		var rule: Dictionary = _rules.get("%s:%s" % [cursor, event_id], {})
		if not rule.is_empty():
			return rule
		cursor = String(_state_parents.get(cursor, ""))
	return {}

func _add(kind: String, source_ref: Dictionary, extra: Dictionary = {}) -> void:
	var entry: Dictionary = {"entry_id": _next_entry_id, "kind": kind, "source_ref": source_ref}
	entry.merge(extra, true)
	_entries.append(entry)
	_next_entry_id += 1

func _fail(code: String, path: String) -> void:
	diagnostics.append({"code": code, "severity": "error", "path": path})

func _fingerprint(asset: Dictionary) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(JSON.stringify(asset).to_utf8_buffer())
	return "sha256:" + context.finish().hex_encode()

func _event_ref(event_id: String) -> Dictionary:
	var index: int = _events.keys().find(event_id)
	return {"event_id": event_asset_id, "path": "/behavior_runtime/events/%d" % index}

func _rule_ref(rule_id: String) -> Dictionary:
	var index: int = behavior.rules.find_custom(func(item: Dictionary) -> bool: return String(item.rule_id) == rule_id)
	return {"event_id": event_asset_id, "path": "/behavior_runtime/rules/%d" % index}

func _effect_ref(effect_id: String) -> Dictionary:
	var index: int = behavior.effects.find_custom(func(item: Dictionary) -> bool: return String(item.effect_id) == effect_id)
	return {"event_id": event_asset_id, "path": "/behavior_runtime/effects/%d" % index}
