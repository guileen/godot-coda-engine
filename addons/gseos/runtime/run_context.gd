class_name GSEOS_RunContext
extends RefCounted

var values: Dictionary
var owner: Object
var cancelled := false
var cancel_reason := ""
var current_source_ref: Dictionary = {}

func _init(initial_values := {}, initial_owner: Object = null) -> void:
	values = initial_values.duplicate(true)
	owner = initial_owner

func get_value(name: String, default_value = null) -> Variant:
	return values.get(name, default_value)

func set_value(name: String, value) -> void:
	values[name] = value

func owner_is_valid() -> bool:
	return owner == null or is_instance_valid(owner)

func request_cancel(reason := "cancelled") -> void:
	cancelled = true
	cancel_reason = reason
