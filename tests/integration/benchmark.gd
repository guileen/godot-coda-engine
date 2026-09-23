extends SceneTree

const REWARD_RUNNER := preload("res://addons/coda/runtime/reward_event_runner.gd")

var registry: CODA_EventRegistry
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	registry = CODA_EventRegistry.new()
	registry.register("benchmark.sync", Callable(self, "_sync_runner"), "parallel")
	registry.register("benchmark.cancel", Callable(self, "_cancel_runner"), "parallel")
	var memory_before := Performance.get_monitor(Performance.MEMORY_STATIC)
	var activation_start := Time.get_ticks_usec()
	var handles: Array[CODA_RunHandle] = []
	for index in 1000:
		handles.append(registry.start("benchmark.sync", {"value": index}))
	var activation_us := Time.get_ticks_usec() - activation_start
	for handle in handles:
		if handle.status != CODA_RunHandle.Status.COMPLETED:
			failures.append("sync benchmark handle did not complete")
	handles.clear()

	var capability_registry := CODA_CapabilityRegistry.new()
	var reward_runner := REWARD_RUNNER.new(capability_registry, registry)
	registry.register("benchmark.reward", Callable(reward_runner, "run"), "reject")
	var hud := Node.new()
	hud.name = "BenchmarkHUD"
	hud.set_meta("_coda_fields", {"score": 100})
	root.add_child(hud)
	var old_row := Label.new()
	old_row.name = "OldRewardRow"
	hud.add_child(old_row)
	var reward_start := Time.get_ticks_usec()
	var reward_handle := registry.start("benchmark.reward", {"reward": 25, "target_hud": hud}, hud)
	var reward_activation_us := Time.get_ticks_usec() - reward_start
	var reward_result: Dictionary = await reward_handle.completed
	var reward_completion_us := Time.get_ticks_usec() - reward_start
	if reward_result.get("status") != "COMPLETED":
		failures.append("reward benchmark did not complete")
	await process_frame
	var reward_row := hud.get_node_or_null("RewardRow")
	if hud.get_node_or_null("OldRewardRow") != null or not is_instance_valid(reward_row) or reward_row.text != "奖励：125":
		failures.append("reward benchmark did not clean and update the HUD")
	var cancel_handle := registry.start("benchmark.cancel", {}, root)
	if not cancel_handle.cancel("benchmark_cancel"):
		failures.append("cancel benchmark did not accept cancellation")
	await process_frame
	var cancel_survivors := registry.active_run_count()
	if cancel_survivors != 0 or root.get_node_or_null("CancelTimer") != null:
		failures.append("cancel benchmark left active runtime objects")
	var recovery_start := Time.get_ticks_usec()
	var recovery_handle := registry.start("benchmark.sync", {"value": 7})
	var recovery_result: Dictionary = recovery_handle.result
	var recovery_us := Time.get_ticks_usec() - recovery_start
	if recovery_result.get("status") != "COMPLETED":
		failures.append("runtime did not recover after cancellation")
	var memory_after := Performance.get_monitor(Performance.MEMORY_STATIC)
	var frame_samples: Array[Dictionary] = []
	for frame in 60:
		var frame_memory_before := Performance.get_monitor(Performance.MEMORY_STATIC)
		var frame_objects_before := Performance.get_monitor(Performance.OBJECT_COUNT)
		registry.start("benchmark.sync", {"value": frame})
		await process_frame
		var frame_memory_after := Performance.get_monitor(Performance.MEMORY_STATIC)
		var frame_objects_after := Performance.get_monitor(Performance.OBJECT_COUNT)
		frame_samples.append({
			"static_memory_delta_bytes": frame_memory_after - frame_memory_before,
			"live_object_delta": frame_objects_after - frame_objects_before,
		})
	var max_memory_delta := 0.0
	var max_object_delta := 0.0
	var positive_object_delta_total := 0.0
	var peak_memory := memory_after
	for sample in frame_samples:
		max_memory_delta = maxf(max_memory_delta, float(sample.static_memory_delta_bytes))
		max_object_delta = maxf(max_object_delta, float(sample.live_object_delta))
		positive_object_delta_total += maxf(0.0, float(sample.live_object_delta))
		peak_memory = maxf(peak_memory, memory_after + float(sample.static_memory_delta_bytes))
	var report := {
		"benchmark_version": 1,
		"godot": Engine.get_version_info(),
		"platform": OS.get_name(),
		"event_shape": "ui.reward.apply: condition -> read/calculate -> await animation -> remove/create/set_text -> publish",
		"sync_activation_us_total": activation_us,
		"sync_activation_us_per_run": float(activation_us) / 1000.0,
		"reward_activation_us": reward_activation_us,
		"reward_completion_us": reward_completion_us,
		"recovery_us": recovery_us,
		"memory_static_before": memory_before,
		"memory_static_after": memory_after,
		"memory_static_peak": peak_memory,
		"memory_static_steady": memory_after,
		"active_runs_after": registry.active_run_count(),
		"per_frame_allocations": {
			"measurement": "positive live-object delta plus static-memory delta proxy",
			"sample_frames": frame_samples.size(),
			"max_static_memory_delta_bytes": max_memory_delta,
			"max_live_object_delta": max_object_delta,
			"positive_live_object_delta_total": positive_object_delta_total,
		},
		"per_frame_allocations_note": "Godot 4.7 exposes live-object and static-memory monitors but not raw malloc call counts; this records the bounded runtime allocation proxy explicitly.",
		"cancel_survivors": cancel_survivors,
		"failures": failures
	}
	print(JSON.stringify(report))
	hud.queue_free()
	capability_registry.clear()
	registry.clear()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func _sync_runner(args: Dictionary, _owner: Node, _handle: CODA_RunHandle) -> Variant:
	return args.get("value")

func _cancel_runner(_args: Dictionary, _owner: Node, handle: CODA_RunHandle) -> Variant:
	var wait := CODA_WaitRegistration.new()
	var timer := Timer.new()
	timer.name = "CancelTimer"
	timer.one_shot = true
	timer.wait_time = 1.0
	root.add_child(timer)
	wait._cleanup = func():
		if is_instance_valid(timer):
			timer.queue_free()
	timer.timeout.connect(func(): wait.finish({"status": "COMPLETED"}))
	wait.settled.connect(func(result: Dictionary):
		if handle.status == CODA_RunHandle.Status.WAITING:
			handle.finish(CODA_RunHandle.Status.COMPLETED, result)
	)
	handle.status = CODA_RunHandle.Status.WAITING
	handle.completed.connect(func(_result: Dictionary):
		if handle.status == CODA_RunHandle.Status.CANCELLED and wait.active:
			wait.cancel("handle_cancelled")
	)
	timer.start()
	return null
