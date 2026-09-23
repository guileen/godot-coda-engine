class_name GdbotRobotAdapter
extends "res://scripts/robot_joint_adapter.gd"

## AIBI-compatible GDBot projection. Skeleton3D writes stay inside this Adapter.

var skeleton: Skeleton3D
var _bone_indices: Dictionary = {}

func _init(target_skeleton: Skeleton3D) -> void:
	skeleton = target_skeleton
	register_joint("head_pitch", -15.0, 25.0, 90.0)
	register_joint("head_yaw", -60.0, 60.0, 120.0)
	register_joint("head_roll", -20.0, 20.0, 90.0)
	for bone_name in ["head"]:
		_bone_indices[bone_name] = skeleton.find_bone(bone_name) if skeleton != null else -1

func _apply_joint(joint_name: String, _value_deg: float) -> void:
	if joint_name not in ["head_pitch", "head_yaw", "head_roll"] or skeleton == null:
		return
	var bone_index := int(_bone_indices.get("head", -1))
	if bone_index < 0:
		return
	var euler := Vector3(
		deg_to_rad(get_joint_value("head_pitch")),
		deg_to_rad(get_joint_value("head_yaw")),
		deg_to_rad(get_joint_value("head_roll")),
	)
	skeleton.set_bone_pose_rotation(bone_index, Quaternion.from_euler(euler))
