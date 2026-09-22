extends Node

## A small Godot-side reference Adapter for expression intent.  It owns the
## expression channel and is deliberately separate from Skeleton3D motion.

const ALLOWED_EXPRESSIONS := ["default", "happy", "dizzy"]

var face_target: Node
var ownership := "available"
var generation := 0
var last_receipt: Dictionary = {
	"barrier": "pending",
	"expression": "default",
	"terminal": "pending",
	"generation": 0
}

func attach_face(target: Node) -> void:
	face_target = target

func apply_expression(expression_name: String) -> bool:
	if face_target == null or not ALLOWED_EXPRESSIONS.has(expression_name):
		last_receipt = _receipt("rejected", expression_name, "invalid_or_missing_face")
		return false
	if ownership != "coda_owned":
		last_receipt = _receipt("rejected", expression_name, "ownership_barrier")
		return false
	face_target.set("current_face", expression_name)
	last_receipt = _receipt("accepted", expression_name, "applied")
	return true

func acquire() -> bool:
	if ownership == "external_owned":
		last_receipt = _receipt("rejected", "", "external_owner")
		return false
	generation += 1
	ownership = "coda_owned"
	last_receipt = _receipt("accepted", "", "lease_acquired")
	return true

func release_external() -> void:
	ownership = "external_owned"
	last_receipt = _receipt("rejected", "", "external_owner")

func reset() -> void:
	ownership = "available"
	last_receipt = _receipt("pending", "default", "reset")

func _receipt(barrier: String, expression_name: String, terminal: String) -> Dictionary:
	return {
		"barrier": barrier,
		"expression": expression_name,
		"terminal": terminal,
		"generation": generation
	}
