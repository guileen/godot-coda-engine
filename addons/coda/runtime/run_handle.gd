class_name CODA_RunHandle
extends RefCounted

signal completed(result: Dictionary)

enum Status { RUNNING, WAITING, COMPLETED, FAILED, CANCELLED }

var run_id: int
var status: Status = Status.RUNNING
var result: Dictionary = {}
var _settled := false

func _init(id: int) -> void:
	run_id = id

func finish(next_status: Status, value: Dictionary = {}) -> bool:
	if _settled:
		return false
	_settled = true
	status = next_status
	result = value.duplicate(true)
	completed.emit(result)
	_disconnect_terminal_listeners()
	return true

func cancel(reason := "cancelled") -> bool:
	return finish(Status.CANCELLED, {"status": "CANCELLED", "reason": reason})

func _disconnect_terminal_listeners() -> void:
	for connection in get_signal_connection_list("completed"):
		var callback: Callable = connection.get("callable", Callable())
		if callback.is_valid():
			completed.disconnect(callback)
