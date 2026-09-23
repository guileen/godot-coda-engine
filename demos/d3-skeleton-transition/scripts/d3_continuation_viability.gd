class_name D3ContinuationViability
extends RefCounted

const RESUME_ORDER := ["exact_phase", "compatible_phase", "checkpoint", "replan_remaining"]
const EVIDENCE_LEVELS := ["exact", "conservative", "reduced", "sampled", "heuristic"]
const REQUIRED_GATES := ["model_valid", "contact_valid", "inputs_bounded", "controller_valid", "capture_region", "bridge_residual_ok", "deadline_ok"]
const VERSIONED_REF := "^[-\\w.]+@[0-9]+$"
const CONTRACT_ID := "^[-\\w.]+@1$"
const RESUME_MODES := ["exact_phase", "compatible_phase", "checkpoint", "replan_remaining", "reject"]
const TOKEN_FIELDS := ["skill_ref", "phase_id", "progress", "state_digest", "constraint_revision", "controller_revision", "lease_id", "generation", "checkpoint_ref", "clock_quality"]

static func evaluate(contract: Dictionary, token: Dictionary, interruption: Dictionary, current: Dictionary, gates: Dictionary, candidates: Array, evidence_level := "heuristic") -> Dictionary:
	var diagnostics: Array[String] = []
	if not _valid_contract(contract):
		diagnostics.append("INVALID_CONTINUATION_CONTRACT")
	if diagnostics.is_empty() and (token.is_empty() or interruption.is_empty() or current.is_empty()):
		diagnostics.append("CONTINUATION_IDENTITY_REQUIRED")
	if not EVIDENCE_LEVELS.has(evidence_level):
		diagnostics.append("CONTINUATION_EVIDENCE_LEVEL_INVALID")
	if not token.is_empty() and not interruption.is_empty() and token.get("state_digest") != interruption.get("state_digest"):
		diagnostics.append("CONTINUATION_TOKEN_STATE_MISMATCH")
	if not token.is_empty() and not current.is_empty() and token.get("skill_ref") != current.get("skill_ref"):
		diagnostics.append("CONTINUATION_SKILL_MISMATCH")
	if not token.is_empty() and not current.is_empty():
		if not token.get("generation") is int or not current.get("generation") is int or int(current.generation) <= int(token.generation):
			diagnostics.append("CONTINUATION_GENERATION_NOT_ADVANCED")
		if token.get("lease_id") == current.get("lease_id"):
			diagnostics.append("CONTINUATION_OLD_LEASE_REUSED")
		if token.get("controller_revision") != current.get("controller_revision"):
			diagnostics.append("CONTINUATION_CONTROLLER_REVISION_CHANGED")
		if token.get("constraint_revision") != current.get("constraint_revision"):
			diagnostics.append("CONTINUATION_CONSTRAINT_REVISION_CHANGED")
	for gate in REQUIRED_GATES:
		if gates.get(gate, false) != true:
			if not diagnostics.has("CONTINUATION_VIABILITY_GATE_FAILED"):
				diagnostics.append("CONTINUATION_VIABILITY_GATE_FAILED")
			break
	if not candidates is Array:
		diagnostics.append("CONTINUATION_CANDIDATES_REQUIRED")
	if not diagnostics.is_empty():
		return _result("reject", "", evidence_level, diagnostics)

	var allowed: Array = contract.get("resume_modes", [])
	for mode in RESUME_ORDER:
		if not allowed.has(mode):
			continue
		var candidate: Dictionary = {}
		for item in candidates:
			if item is Dictionary and item.get("mode") == mode:
				candidate = item
				break
		if candidate.is_empty() or candidate.get("admitted") != true:
			continue
		if mode == "exact_phase" and (token.get("phase_id") != current.get("phase_id") or token.get("progress") != current.get("progress")):
			continue
		if mode == "compatible_phase" and (not candidate.get("compatible_phase_refs", []) is Array or not candidate.compatible_phase_refs.has(current.get("phase_id"))):
			continue
		if mode == "checkpoint" and (not contract.get("checkpoint_refs", []).has(candidate.get("checkpoint_ref")) or candidate.get("checkpoint_complete") != true):
			continue
		if mode == "replan_remaining" and candidate.get("remaining_task_set_ref") != contract.get("contract_id"):
			continue
		if not _matches(VERSIONED_REF, String(candidate.get("bridge_ref", ""))):
			continue
		return _result("admitted", mode, evidence_level, [])
	diagnostics.append("CONTINUATION_NO_VIABLE_CANDIDATE")
	return _result("reject", "", evidence_level, diagnostics)

static func _valid_contract(contract: Dictionary) -> bool:
	var required := ["contract_type", "schema_version", "contract_id", "resume_modes", "phase_progress_ref", "capture_region_ref", "checkpoint_refs", "viability_gate_ref", "bridge_planner_ref", "commit_alignment_ref", "token_fields", "on_no_solution", "restore_old_generation"]
	if contract.size() != required.size():
		return false
	for key in required:
		if not contract.has(key):
			return false
	if contract.contract_type != "ContinuationContract" or contract.schema_version != 1 or contract.restore_old_generation != false or not ["recovery_skill_if_admitted", "replan", "reject", "yield_safety_authority"].has(contract.on_no_solution):
		return false
	if not _matches(CONTRACT_ID, String(contract.contract_id)):
		return false
	for field in ["phase_progress_ref", "capture_region_ref", "viability_gate_ref", "bridge_planner_ref", "commit_alignment_ref"]:
		if not _matches(VERSIONED_REF, String(contract.get(field, ""))):
			return false
	if not contract.resume_modes is Array or contract.resume_modes.is_empty() or not contract.token_fields is Array or not contract.checkpoint_refs is Array:
		return false
	if contract.resume_modes.size() != contract.resume_modes.duplicate().size() or contract.token_fields.size() != contract.token_fields.duplicate().size() or contract.checkpoint_refs.size() != contract.checkpoint_refs.duplicate().size():
		return false
	for mode in contract.resume_modes:
		if not RESUME_MODES.has(mode):
			return false
	for field in contract.token_fields:
		if not TOKEN_FIELDS.has(field):
			return false
	for ref in contract.checkpoint_refs:
		if not _matches(VERSIONED_REF, String(ref)):
			return false
	return true

static func _matches(pattern: String, value: String) -> bool:
	var regex := RegEx.new()
	if regex.compile(pattern) != OK:
		return false
	var matched := regex.search(value)
	return matched != null and matched.get_string() == value

static func _result(status: String, mode: String, evidence_level: String, diagnostics: Array) -> Dictionary:
	return {
		"status": status,
		"resume_mode": mode,
		"evidence_level": evidence_level if EVIDENCE_LEVELS.has(evidence_level) else "heuristic",
		"claims_dynamics_certificate": false,
		"diagnostics": diagnostics,
	}
