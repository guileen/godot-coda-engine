extends SceneTree

const DEMO := preload("res://demos/reward-flow/reward-flow-demo.gd")

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_start")

func _start() -> void:
	var demo := DEMO.new()
	root.add_child(demo)
	await process_frame
	if demo.score_label.text != "积分：100":
		failures.append("reward demo did not start at 100 points")
	if demo.reward_history.get_child_count() != 1 or not (demo.reward_history.get_child(0) as Label).text.contains("+10"):
		failures.append("reward demo did not show the previous reward before claiming")
	var flow_steps := _find_flow_steps(demo)
	if flow_steps == null or flow_steps.get_child_count() != 5:
		failures.append("reward demo did not explain the five-step trigger-to-feedback flow")
	else:
		var joined := " ".join(_step_texts(flow_steps))
		for phrase in ["触发", "判断", "算分并等待", "更新", "反馈", "奖励大于 0"]:
			if not joined.contains(phrase): failures.append("reward flow explanation did not mention: " + phrase)

	demo.reward_button.pressed.emit()
	await create_timer(0.9).timeout
	if demo.score_label.text != "积分：125":
		failures.append("claiming +25 did not animate the score from 100 to 125; actual=%s status=%s payload=%s" % [demo.score_label.text, demo.status_label.text, demo.received_payload])
	if demo.reward_history.get_child_count() != 2:
		failures.append("claiming +25 did not replace the old reward and add the settlement receipt")
	else:
		if (demo.reward_history.get_child(0) as Label).text != "奖励：125":
			failures.append("new reward row did not show the resulting score; actual=%s" % (demo.reward_history.get_child(0) as Label).text)
		if not (demo.reward_history.get_child(1) as Label).text.contains("奖励 +25"):
			failures.append("settlement notification did not report the claimed reward")
	for step in demo._flow_step_labels:
		if not step.text.contains("已完成"):
			failures.append("reward demo did not mark its completed flow steps")
			break

	demo.reset_button.pressed.emit()
	await process_frame
	demo.zero_reward_button.pressed.emit()
	await process_frame
	if demo.score_label.text != "积分：100":
		failures.append("zero reward incorrectly changed the score")
	if demo.reward_history.get_child_count() != 1 or not (demo.reward_history.get_child(0) as Label).text.contains("+10"):
		failures.append("zero reward incorrectly replaced the previous reward")
	if not demo.status_label.text.contains("条件不成立"):
		failures.append("zero reward did not explain that the condition skipped the flow")
	if demo._flow_step_labels.size() == 5:
		if not demo._flow_step_labels[1].text.contains("条件未通过"):
			failures.append("zero reward did not mark the condition branch as failed")
		if not demo._flow_step_labels[2].text.contains("已跳过") or not demo._flow_step_labels[4].text.contains("已跳过"):
			failures.append("zero reward did not show that later flow steps were skipped")
	if failures.is_empty():
		print("Reward flow demo smoke passed")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)

func _find_flow_steps(demo: Control) -> VBoxContainer:
	for child in demo.get_children():
		if child is CenterContainer:
			var column := child.get_child(0) as VBoxContainer
			for item in column.get_children():
				if item is VBoxContainer and item.get_child_count() == 5:
					return item
	return null

func _step_texts(container: VBoxContainer) -> Array[String]:
	var result: Array[String] = []
	for child in container.get_children(): result.append((child as Label).text)
	return result
