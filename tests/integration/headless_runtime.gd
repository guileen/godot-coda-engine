extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	var registry := GSEOS_EventRegistry.new()
	registry.register("demo.event", Callable(self, "_demo_runner"), "reject")
	var handle := registry.start("demo.event", {"value": 7})
	if handle.run_id != 1:
		failures.append("start() did not return a stable RunHandle")
	if handle.status != GSEOS_RunHandle.Status.COMPLETED:
		failures.append("synchronous runner did not complete")
	var missing := registry.start("missing.event")
	if missing.status != GSEOS_RunHandle.Status.FAILED:
		failures.append("missing event did not produce a failed handle")
	registry.register("waiting.event", Callable(self, "_waiting_runner"), "reject")
	var sync_diagnostic := registry.call_sync("waiting.event")
	if sync_diagnostic.get("code") != "CALL_SYNC_REQUIRES_ASYNC":
		failures.append("call_sync did not reject a suspended event")
	received = false
	registry.subscribe("combat.hit_resolved@1", Callable(self, "_on_hit"))
	var published := registry.publish("combat.hit_resolved@1", {"damage": 3})
	if not published.ok or not received:
		failures.append("publish/subscribe did not deliver the versioned payload")
	var wait := GSEOS_WaitRegistration.new()
	if not wait.finish({"status": "COMPLETED"}) or wait.cancel():
		failures.append("WaitRegistration allowed more than one terminal transition")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
	else:
		print("GSEOS headless runtime integration passed")
		registry.clear()
		quit(0)

func _demo_runner(args: Dictionary, _owner: Node, _handle: GSEOS_RunHandle) -> Variant:
	return args.get("value")

func _waiting_runner(_args: Dictionary, _owner: Node, handle: GSEOS_RunHandle) -> Variant:
	handle.status = GSEOS_RunHandle.Status.WAITING
	return null

var received := false

func _on_hit(_payload: Dictionary) -> Dictionary:
	received = true
	return {"ok": true}
