const finite = (value) => typeof value === "number" && Number.isFinite(value);

function diagnostic(code, message, details = {}) { return { code, message, ...details }; }

export class ExpressionAdapterReference {
  #profile;
  #owner = "available";
  #generation = 0;
  #channels = {};

  constructor(profile) {
    this.#profile = structuredClone(profile);
  }

  handoff(owner) {
    if (!["available", "coda_owned", "external_owned"].includes(owner)) return { ok: false, diagnostics: [diagnostic("INVALID_EXPRESSION_OWNER", "表达式 owner 不合法。")] };
    this.#owner = owner;
    return { ok: true, value: { ownership: owner }, diagnostics: [] };
  }

  apply({ generation, channels }) {
    const diagnostics = [];
    if (this.#owner !== "coda_owned") diagnostics.push(diagnostic("EXPRESSION_WRITER_NOT_OWNED", "表达式 Adapter 当前不是 CODA-owned。", { ownership: this.#owner }));
    if (!Number.isInteger(generation) || generation !== this.#generation) diagnostics.push(diagnostic("STALE_EXPRESSION_GENERATION", "表达式 generation 不匹配。", { expected: this.#generation, actual: generation }));
    if (!channels || typeof channels !== "object" || Array.isArray(channels)) diagnostics.push(diagnostic("INVALID_EXPRESSION_CHANNELS", "表达式 channels 必须是对象。"));
    for (const [channel, value] of Object.entries(channels ?? {})) {
      const spec = this.#profile.channels?.[channel];
      if (!spec) diagnostics.push(diagnostic("UNKNOWN_EXPRESSION_CHANNEL", `未声明表达式通道：${channel}。`, { channel }));
      else if (!finite(value) || value < spec.min || value > spec.max) diagnostics.push(diagnostic("EXPRESSION_CHANNEL_OUT_OF_RANGE", `表达式通道越界：${channel}。`, { channel, value }));
    }
    if (diagnostics.length) return { ok: false, receipt: { receipt_type: "terminal_receipt", status: "rejected", ownership: this.#owner, generation }, diagnostics };
    this.#channels = structuredClone(channels);
    return { ok: true, receipt: { receipt_type: "terminal_receipt", status: "completed", ownership: "coda_owned", generation, channels: structuredClone(this.#channels) }, diagnostics: [] };
  }

  startGeneration() {
    if (this.#owner !== "coda_owned") return { ok: false, diagnostics: [diagnostic("EXPRESSION_WRITER_NOT_OWNED", "未取得 CODA ownership，不能开始新 generation。", { ownership: this.#owner })] };
    this.#generation += 1;
    return { ok: true, value: { generation: this.#generation, ownership: this.#owner }, diagnostics: [] };
  }

  snapshot() { return { ownership: this.#owner, generation: this.#generation, channels: structuredClone(this.#channels) }; }
}

export function validateExpressionAdapterProfile(profile) {
  const diagnostics = [];
  if (profile?.profile_type !== "ExpressionAdapterProfile") diagnostics.push(diagnostic("INVALID_EXPRESSION_PROFILE", "profile_type 必须为 ExpressionAdapterProfile。"));
  const channels = profile?.channels ?? {};
  for (const [channel, spec] of Object.entries(channels)) if (!finite(spec.min) || !finite(spec.max) || spec.min > spec.max) diagnostics.push(diagnostic("INVALID_EXPRESSION_LIMIT", `表达式通道范围无效：${channel}。`));
  return { ok: diagnostics.length === 0, value: profile, diagnostics };
}
