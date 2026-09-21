import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

const TASKS = ["find_alias", "restate_flow", "edit_duration", "preview_diff", "commit_and_run", "locate_runtime"];
const FORBIDDEN_PERSONAL_FIELDS = new Set(["name", "email", "phone", "raw_transcript", "project_path", "account_id"]);

export function summarizeUserObservationReport(report) {
  const observations = Array.isArray(report?.observations) ? report.observations : [];
  const passedWithoutMaintainerHint = observations.filter((observation) => observation?.outcome === "pass" && observation.hint_count <= 1 && TASKS.every((task) => observation.tasks?.[task]?.result === "pass" && observation.tasks?.[task]?.hint_free === true)).length;
  return { participant_count: observations.length, passed_without_maintainer_hint: passedWithoutMaintainerHint, minimum_participants: 3, minimum_passed_without_maintainer_hint: 2, gate: observations.length >= 3 && passedWithoutMaintainerHint >= 2 ? "G-P3-U_READY" : "G-P3-U_PENDING" };
}

export function validateUserObservationReport(report) {
  const diagnostics = [];
  if (!report || typeof report !== "object" || Array.isArray(report)) return gseosReceipt([gseosDiagnostic("INVALID_USER_OBSERVATION", "用户观察报告必须是对象。", { path: "/" })]);
  if (report.observation_type !== "P3UserObservation") diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATION_TYPE", "observation_type 必须为 P3UserObservation。", { path: "/observation_type" }));
  if (report.schema_version !== 1) diagnostics.push(gseosDiagnostic("UNSUPPORTED_USER_OBSERVATION_VERSION", "用户观察报告版本不受支持。", { path: "/schema_version" }));
  if (!/^p3-[a-z0-9-]+$/.test(String(report.study_id ?? ""))) diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATION_STUDY", "study_id 必须是脱敏的 p3 标识。", { path: "/study_id" }));
  if (!Array.isArray(report.observations)) diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATIONS", "observations 必须是数组。", { path: "/observations" }));
  const observations = Array.isArray(report.observations) ? report.observations : [];
  const ids = new Set();
  for (const [index, observation] of observations.entries()) {
    const path = `/observations/${index}`;
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) { diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATION_ENTRY", "观察记录必须是对象。", { path })); continue; }
    for (const field of FORBIDDEN_PERSONAL_FIELDS) if (Object.hasOwn(observation, field)) diagnostics.push(gseosDiagnostic("USER_OBSERVATION_PII_FIELD", `观察记录不得包含个人或项目原文字段：${field}。`, { path: `${path}/${field}` }));
    if (!/^u-[0-9]{3}$/.test(String(observation.participant_id ?? ""))) diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATION_PARTICIPANT", "participant_id 必须是匿名编号。", { path: `${path}/participant_id` }));
    if (ids.has(observation.participant_id)) diagnostics.push(gseosDiagnostic("DUPLICATE_USER_OBSERVATION_PARTICIPANT", "同一匿名参与者不能重复计入。", { path: `${path}/participant_id` }));
    ids.add(observation.participant_id);
    if (observation.consent?.recorded !== true) diagnostics.push(gseosDiagnostic("MISSING_USER_OBSERVATION_CONSENT", "观察记录必须确认已取得同意。", { path: `${path}/consent/recorded` }));
    if (!Number.isInteger(observation.hint_count) || observation.hint_count < 0) diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATION_HINT_COUNT", "hint_count 必须是非负整数。", { path: `${path}/hint_count` }));
    for (const task of TASKS) {
      const result = observation.tasks?.[task];
      if (!result || !["pass", "fail", "blocked"].includes(result.result) || typeof result.hint_free !== "boolean") diagnostics.push(gseosDiagnostic("INVALID_USER_OBSERVATION_TASK", `任务 ${task} 缺少合法结果或 hint_free。`, { path: `${path}/tasks/${task}` }));
    }
    const allPass = TASKS.every((task) => observation.tasks?.[task]?.result === "pass");
    if (observation.outcome === "pass" && !allPass) diagnostics.push(gseosDiagnostic("USER_OBSERVATION_OUTCOME_MISMATCH", "标记为 pass 的参与者必须完成全部任务。", { path: `${path}/outcome` }));
    if (observation.outcome === "pass" && observation.hint_count > 1) diagnostics.push(gseosDiagnostic("USER_OBSERVATION_TOO_MANY_HINTS", "完整通过最多允许一次非答案性操作提示。", { path: `${path}/hint_count` }));
  }
  const passed = observations.filter((observation) => observation?.outcome === "pass" && TASKS.every((task) => observation.tasks?.[task]?.result === "pass") && observation.hint_count <= 1 && TASKS.every((task) => observation.tasks?.[task]?.hint_free === true)).length;
  if (observations.length < 3) diagnostics.push(gseosDiagnostic("USER_OBSERVATION_COUNT", "G-P3-U 至少需要 3 名未参与实现的目标用户。", { path: "/observations", actual: observations.length, minimum: 3 }));
  if (passed < 2) diagnostics.push(gseosDiagnostic("USER_OBSERVATION_PASS_THRESHOLD", "G-P3-U 至少需要 2 名无维护者提示通过完整任务的用户。", { path: "/observations", actual: passed, minimum: 2 }));
  return gseosReceipt(diagnostics);
}
