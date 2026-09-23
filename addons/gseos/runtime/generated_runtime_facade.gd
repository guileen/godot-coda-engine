class_name CODA_GeneratedRuntime
extends RefCounted

var capabilities: CODA_CapabilityRegistry
var events: CODA_EventRegistry
var _next_trace_id := 1
var last_trace: Dictionary = {}

func _init(capability_registry: CODA_CapabilityRegistry, event_registry: CODA_EventRegistry) -> void:
	capabilities = capability_registry
	events = event_registry

func create_context(args: Dictionary, owner: Node, event_id: String, plan_fingerprint: String) -> CODA_RunContext:
	var context := CODA_RunContext.new(args, owner, event_id, plan_fingerprint, _next_trace_id)
	_next_trace_id += 1
	return context

func finish_context(context: CODA_RunContext) -> void:
	last_trace = context.runtime_trace()

func read(target: String, args: Dictionary) -> Variant:
	return capabilities.invoke(target, args)

func call_sync(target: String, args: Dictionary) -> Variant:
	var result = capabilities.invoke(target, args)
	if result is CODA_WaitRegistration:
		push_error("CALL_SYNC_REQUIRES_ASYNC: " + target)
		return null
	return result

func await_capability(target: String, args: Dictionary) -> Variant:
	var result = capabilities.invoke(target, args)
	if result is CODA_WaitRegistration:
		var settled: Dictionary = await result.settled
		return settled
	return result

func publish(target: String, payload: Dictionary) -> Dictionary:
	return events.publish(target, payload)
