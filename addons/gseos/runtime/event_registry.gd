class_name GSEOS_EventRegistry
extends RefCounted

var _events: Dictionary = {}
var _topics: Dictionary = {}
var _next_run_id := 1

func register(event_id: String, runner: Callable, reentry := "reject") -> void:
	_events[event_id] = {"runner": runner, "reentry": reentry, "active": []}

func start(event_id: String, args: Dictionary = {}, owner: Node = null) -> GSEOS_RunHandle:
	var handle := GSEOS_RunHandle.new(_next_run_id)
	_next_run_id += 1
	if not _events.has(event_id):
		handle.finish(GSEOS_RunHandle.Status.FAILED, {"status": "FAILED", "code": "EVENT_NOT_FOUND", "event_id": event_id})
		return handle
	var event: Dictionary = _events[event_id]
	if event.reentry == "reject" and not event.active.is_empty():
		handle.finish(GSEOS_RunHandle.Status.FAILED, {"status": "FAILED", "code": "REENTRY_REJECTED", "event_id": event_id})
		return handle
	event.active.append(handle)
	handle.completed.connect(func(_result):
		event.active.erase(handle)
	)
	var result = event.runner.call(args, owner, handle)
	# Godot 4.7 does not expose GDScriptFunctionState. Async generated runners
	# own their handle and call finish at the WaitRegistration boundary; a
	# synchronous runner completes here.
	if handle.status == GSEOS_RunHandle.Status.RUNNING:
		handle.finish(GSEOS_RunHandle.Status.COMPLETED, {"status": "COMPLETED", "value": result})
	return handle

func call_sync(event_id: String, args: Dictionary = {}, owner: Node = null) -> Dictionary:
	var handle := start(event_id, args, owner)
	if handle.status == GSEOS_RunHandle.Status.WAITING:
		return {"ok": false, "code": "CALL_SYNC_REQUIRES_ASYNC", "event_id": event_id, "run_id": handle.run_id}
	if handle.status != GSEOS_RunHandle.Status.COMPLETED:
		return {"ok": false, "code": handle.result.get("code", "EVENT_FAILED"), "event_id": event_id, "run_id": handle.run_id}
	return {"ok": true, "value": handle.result.get("value"), "event_id": event_id, "run_id": handle.run_id}

func subscribe(topic_id: String, listener: Callable) -> Callable:
	if not _topics.has(topic_id):
		_topics[topic_id] = []
	_topics[topic_id].append(listener)
	return Callable(self, "_unsubscribe").bind(topic_id, listener)

func publish(topic_id: String, payload: Dictionary) -> Dictionary:
	var diagnostics: Array[Dictionary] = []
	for listener in _topics.get(topic_id, []):
		if not listener.is_valid():
			continue
		var result = listener.call(payload)
		if result is Dictionary and result.get("ok", true) == false:
			diagnostics.append({"code": "LISTENER_FAILED", "severity": "warning", "message": "监听器返回失败。", "target_id": topic_id})
	return {"ok": diagnostics.is_empty(), "diagnostics": diagnostics}

func _unsubscribe(topic_id: String, listener: Callable) -> void:
	if _topics.has(topic_id):
		_topics[topic_id].erase(listener)

func clear() -> void:
	_events.clear()
	_topics.clear()

func active_run_count() -> int:
	var count := 0
	for event in _events.values():
		count += event.active.size()
	return count
