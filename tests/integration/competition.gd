extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	# Explicit cancellation wins over a same-frame late completion.
	var handle := GSEOS_RunHandle.new(1)
	handle.status = GSEOS_RunHandle.Status.WAITING
	var wait := GSEOS_WaitRegistration.new()
	wait.settled.connect(func(result: Dictionary):
		if handle.status == GSEOS_RunHandle.Status.WAITING:
			handle.finish(GSEOS_RunHandle.Status.COMPLETED, result)
	)
	if not handle.cancel("explicit_cancel") or not wait.finish({"status": "COMPLETED"}) or wait.finish({"status": "LATE"}):
		failures.append("cancel/complete competition was not single-winner")
	if handle.status != GSEOS_RunHandle.Status.CANCELLED:
		failures.append("cancel did not remain terminal")

	# Timeout is also a single terminal transition.
	var timeout_wait := GSEOS_WaitRegistration.new()
	timeout_wait.arm_timeout(self, 0.001)
	await timeout_wait.settled
	if timeout_wait.active or timeout_wait.generation != 1:
		failures.append("timeout did not cleanly settle")

	# Owner destruction makes the late callback a no-op.
	var owner := Node.new()
	root.add_child(owner)
	var owner_handle := GSEOS_RunHandle.new(2)
	owner_handle.status = GSEOS_RunHandle.Status.WAITING
	var owner_wait := GSEOS_WaitRegistration.new()
	var owner_id := owner.get_instance_id()
	owner_wait.settled.connect(func(_result: Dictionary):
		if is_instance_valid(instance_from_id(owner_id)):
			owner_handle.finish(GSEOS_RunHandle.Status.COMPLETED)
		else:
			owner_handle.cancel("owner_invalid")
	)
	owner.queue_free()
	await process_frame
	owner_wait.finish({"status": "COMPLETED"})
	if owner_handle.status != GSEOS_RunHandle.Status.CANCELLED:
		failures.append("owner invalidation did not cancel late callback")

	if failures.is_empty():
		print("CODA competition cleanup integration passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
