const actions = new Set(["hold_if_valid", "enter_admitted_backup", "yield_safety_authority", "reject"]);

/** Deterministic temporal admission reference; it never renews leases or emits commands. */
export function evaluateTemporalCommandAdmission(contract, context) {
  const diagnostics = [];
  const add = (code) => diagnostics.push({ code });
  if (contract?.contract_type !== "TemporalCommandContract" || contract.schema_version !== 1 || !actions.has(contract.on_invalid)) add("INVALID_TEMPORAL_COMMAND_CONTRACT");
  if (!context || typeof context !== "object") add("TEMPORAL_CONTEXT_REQUIRED");
  if (diagnostics.length) return receipt("reject", diagnostics);

  const { now, lease, observation, command, liveness, buffer, previous_state = "active", profile } = context;
  if (!now || !Number.isInteger(now.tick) || !contract.clock_domains.includes(now.clock_domain)) add("TEMPORAL_CLOCK_DOMAIN_INVALID");
  for (const [name, sample] of [["lease", lease], ["observation", observation], ["command", command], ["liveness", liveness]]) {
    if (!sample || sample.clock_domain !== now?.clock_domain) add("TEMPORAL_CLOCK_DOMAIN_MISMATCH");
  }
  if (!profile || !positiveInt(profile.max_observation_age_ticks) || !positiveInt(profile.heartbeat_timeout_ticks) || !positiveInt(profile.low_watermark_ticks) || !positiveInt(profile.recovery_watermark_ticks) || profile.recovery_watermark_ticks <= profile.low_watermark_ticks) add("TEMPORAL_PROFILE_THRESHOLDS_INVALID");
  if (!buffer || !Number.isInteger(buffer.remaining_ticks) || buffer.remaining_ticks < 0) add("TEMPORAL_BUFFER_INVALID");
  if (diagnostics.length) return invalidResult(contract, context, diagnostics);

  if (typeof lease.id !== "string" || lease.id.length === 0 || lease.active !== true || !Number.isInteger(lease.generation) || lease.generation !== command.generation || !Number.isInteger(lease.expires_at_tick) || now.tick > lease.expires_at_tick) add("TEMPORAL_AUTHORITY_LEASE_INVALID");
  if (!Number.isInteger(observation.tick) || observation.tick > now.tick || now.tick - observation.tick > profile.max_observation_age_ticks) add("TEMPORAL_OBSERVATION_STALE");
  if (!Number.isInteger(command.valid_from_tick) || !Number.isInteger(command.valid_until_tick) || now.tick < command.valid_from_tick || now.tick > command.valid_until_tick || command.lease_id !== lease.id) add("TEMPORAL_COMMAND_INVALID");
  if (!Number.isInteger(liveness.last_heartbeat_tick) || liveness.last_heartbeat_tick > now.tick || now.tick - liveness.last_heartbeat_tick > profile.heartbeat_timeout_ticks) add("TEMPORAL_LIVENESS_EXPIRED");
  if (buffer.remaining_ticks === 0) add("TEMPORAL_BUFFER_EMPTY");
  if (diagnostics.length) return invalidResult(contract, context, diagnostics);

  if (previous_state === "hold" && buffer.remaining_ticks < profile.recovery_watermark_ticks) return receipt("hold", [{ code: "TEMPORAL_HYSTERESIS_HOLD" }]);
  if (previous_state !== "active" && previous_state !== "hold") return receipt("reject", [{ code: "TEMPORAL_PREVIOUS_STATE_INVALID" }]);
  if (buffer.remaining_ticks <= profile.low_watermark_ticks) return receipt("hold", [{ code: "TEMPORAL_BUFFER_LOW_WATERMARK" }]);
  return receipt("active", []);
}

function invalidResult(contract, context, diagnostics) {
  switch (contract.on_invalid) {
    case "hold_if_valid":
      return context.lease?.active === true && context.lease?.id === context.command?.lease_id && context.current_control_valid === true
        ? receipt("hold", diagnostics)
        : receipt("reject", diagnostics);
    case "enter_admitted_backup":
      return context.backup_admitted === true ? receipt("backup_candidate", diagnostics) : receipt("reject", [...diagnostics, { code: "TEMPORAL_BACKUP_NOT_ADMITTED" }]);
    case "yield_safety_authority": return receipt("yield_safety_authority", diagnostics);
    default: return receipt("reject", diagnostics);
  }
}

function positiveInt(value) { return Number.isInteger(value) && value > 0; }
function receipt(decision, diagnostics) { return { decision, renew_lease: false, emit_command: false, diagnostics }; }
