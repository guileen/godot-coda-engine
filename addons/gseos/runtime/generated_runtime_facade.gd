class_name GSEOS_GeneratedRuntime
extends RefCounted

var capabilities: GSEOS_CapabilityRegistry
var events: GSEOS_EventRegistry
var _next_trace_id := 1
var last_trace: Dictionary = {}

func _init(capability_registry: GSEOS_CapabilityRegistry, event_registry: GSEOS_EventRegistry) -> void:
	capabilities = capability_registry
	events = event_registry

func create_context(args: Dictionary, owner: Node, event_id: String, plan_fingerprint: String) -> GSEOS_RunContext:
	var context := GSEOS_RunContext.new(args, owner, event_id, plan_fingerprint, _next_trace_id)
	_next_trace_id += 1
	return context

func finish_context(context: GSEOS_RunContext) -> void:
	last_trace = context.runtime_trace()

func read(target: String, args: Dictionary) -> Variant:
	return capabilities.invoke(target, args)

func call_sync(target: String, args: Dictionary) -> Variant:
	var result = capabilities.invoke(target, args)
	if result is GSEOS_WaitRegistration:
		push_error("CALL_SYNC_REQUIRES_ASYNC: " + target)
		return null
	return result

func await_capability(target: String, args: Dictionary) -> Variant:
	var result = capabilities.invoke(target, args)
	if result is GSEOS_WaitRegistration:
		var settled: Dictionary = await result.settled
		return settled
	return result

func publish(target: String, payload: Dictionary) -> Dictionary:
	return events.publish(target, payload)
