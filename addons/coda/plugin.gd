@tool
extends EditorPlugin

const EVENT_DOCK := preload("res://addons/coda/editor/event_dock.gd")
var _dock: Control

func _enter_tree() -> void:
	_dock = EVENT_DOCK.new()
	_dock.name = "CODA 事件"
	_dock.configure(get_editor_interface())
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, _dock)

func _exit_tree() -> void:
	if is_instance_valid(_dock):
		remove_control_from_docks(_dock)
		_dock.queue_free()
