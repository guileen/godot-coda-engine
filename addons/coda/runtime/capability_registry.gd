class_name CODA_CapabilityRegistry
extends RefCounted

var _adapters: Dictionary = {}

func register(capability_id: String, version: int, adapter: Callable, metadata := {}) -> void:
	_adapters["%s@%d" % [capability_id, version]] = {"adapter": adapter, "metadata": metadata.duplicate(true)}

func resolve(target: String) -> Dictionary:
	return _adapters.get(target, {})

func invoke(target: String, args: Dictionary) -> Variant:
	var entry: Dictionary = resolve(target)
	if entry.is_empty():
		push_error("CODA capability not registered: " + target)
		return null
	return entry.adapter.call(args)

func clear() -> void:
	_adapters.clear()
