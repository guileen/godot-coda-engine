extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	var scene := load("res://scenes/d2_interruptible_behavior.tscn") as PackedScene
	_check(scene != null, "D2 scene must load")
	if scene == null:
		quit(1)
		return
	var instance = scene.instantiate()
	root.add_child(instance)
	await process_frame
	_check(instance.get("skeleton") != null, "D2 must instantiate GDBot Skeleton3D")
	instance.start_speaking()
	_check(bool(instance.get("speech_active")), "speaking must start a cancellable effect")
	var speaking_generation := int(instance.get("generation"))
	instance.interrupt_speaking()
	_check(String(instance.get("behavior_state")) == "listening", "interrupt must converge to listening")
	_check(not bool(instance.get("speech_active")), "interrupt must cancel speech exactly once")
	_check(int(instance.get("generation")) > speaking_generation, "interrupt must revoke the previous generation")
	instance.late_tts_done()
	_check(String(instance.get("behavior_state")) == "listening", "late tts_done must not revive speaking")
	_check(instance.get("observations").has("[ignored] STALE_COMPLETION"), "late completion must leave a stale rejection observation")
	instance.queue_free()
	if failures.is_empty():
		print("D2 interruptible behavior smoke passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
