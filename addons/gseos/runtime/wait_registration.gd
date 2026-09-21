class_name GSEOS_WaitRegistration
extends RefCounted

signal settled(result: Dictionary)

var generation: int = 1
var active := true
var _settled := false
var _cleanup: Callable
var _timeout_timer: SceneTreeTimer

func _init(cleanup := Callable()) -> void:
	_cleanup = cleanup

func finish(result: Dictionary) -> bool:
	if _settled:
		return false
	_settled = true
	active = false
	if _cleanup.is_valid():
		_cleanup.call()
	settled.emit(result)
	_disconnect_settlement_listeners()
	return true

func cancel(reason := "cancelled") -> bool:
	return finish({"status": "CANCELLED", "reason": reason})

func arm_timeout(tree: SceneTree, seconds: float) -> void:
	_timeout_timer = tree.create_timer(seconds)
	_timeout_timer.timeout.connect(func():
		finish({"status": "TIMEOUT", "reason": "timeout"})
	)

func _disconnect_settlement_listeners() -> void:
	for connection in get_signal_connection_list("settled"):
		var callback: Callable = connection.get("callable", Callable())
		if callback.is_valid():
			settled.disconnect(callback)
