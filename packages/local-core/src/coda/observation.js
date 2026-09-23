import { codaDiagnostic, codaReceipt } from "./diagnostics.js";

const TASKS = ["understand_flow", "judge_naturalness", "edit_and_preview", "run_correctly", "operation_confidence"];
const FORBIDDEN_PERSONAL_FIELDS = new Set(["name", "fullname", "email", "emailaddress", "phone", "phonenumber", "telephone", "rawtranscript", "transcript", "projectpath", "accountid", "userid", "username", "contact", "address", "ipaddress", "githubhandle"]);
const ALLOWED_FIELDS = {
  report: new Set(["observation_type", "schema_version", "study_id", "observations"]),
  observation: new Set(["participant_id", "target_user", "implementation_involvement", "eligibility_verified_by_observer", "role_profile", "consent", "tasks", "hint_count", "outcome", "quote_summaries", "blockers"]),
  consent: new Set(["recorded", "recording_allowed"]),
  tasks: new Set(TASKS),
  task: new Set(["result", "hint_free", "summary"]),
  blocker: new Set(["stage", "summary"]),
};
const PRIVATE_TEXT_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?\d[\s().-]*){7,}/,
  /(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Z]:\\Users\\[^\\\s]+)/i,
  /\bgithub\.com\/[A-Za-z0-9-]+/i,
];

function checkFields(value, allowed, path, diagnostics) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_PERSONAL_FIELDS.has(normalized)) {
      diagnostics.push(codaDiagnostic("USER_OBSERVATION_PII_FIELD", `观察记录不得包含个人或项目身份字段：${key}。`, { path: `${path}/${key}` }));
    } else if (!allowed.has(key)) {
      diagnostics.push(codaDiagnostic("UNDECLARED_USER_OBSERVATION_FIELD", `观察记录包含 schema 未声明的字段：${key}。`, { path: `${path}/${key}` }));
    }
  }
}

function checkPrivateText(value, path, diagnostics) {
  if (typeof value !== "string") return;
  if (value.length > 240) diagnostics.push(codaDiagnostic("USER_OBSERVATION_TEXT_TOO_LONG", "自由文本只能保留不超过 240 字的脱敏摘要，不得粘贴原始访谈记录。", { path }));
  if (PRIVATE_TEXT_PATTERNS.some((pattern) => pattern.test(value))) diagnostics.push(codaDiagnostic("USER_OBSERVATION_PRIVATE_TEXT", "自由文本疑似包含邮箱、个人路径或 GitHub 身份链接，请先脱敏。", { path }));
}

function qualifiedParticipants(observations) {
  const unique = new Map();
  for (const observation of observations) {
    if (observation?.target_user !== true || observation.implementation_involvement !== "none" || observation.eligibility_verified_by_observer !== true) continue;
    if (!/^u-[0-9]{3}$/.test(String(observation.participant_id ?? ""))) continue;
    if (!unique.has(observation.participant_id)) unique.set(observation.participant_id, observation);
  }
  return [...unique.values()];
}

export function summarizeUserObservationReport(report) {
  const observations = Array.isArray(report?.observations) ? report.observations : [];
  const qualified = qualifiedParticipants(observations);
  const passedWithoutMaintainerHint = qualified.filter((observation) => observation?.outcome === "pass" && observation.hint_count === 0 && TASKS.every((task) => observation.tasks?.[task]?.result === "pass" && observation.tasks?.[task]?.hint_free === true)).length;
  const valid = validateUserObservationReport(report).ok;
  return { participant_count: qualified.length, observed_record_count: observations.length, excluded_record_count: observations.length - qualified.length, passed_without_maintainer_hint: passedWithoutMaintainerHint, evidence_valid: valid, minimum_participants: 3, minimum_passed_without_maintainer_hint: 2, gate: valid && qualified.length >= 3 && passedWithoutMaintainerHint >= 2 ? "G-P3-U_READY" : "G-P3-U_PENDING" };
}

export function validateUserObservationReport(report) {
  const diagnostics = [];
  if (!report || typeof report !== "object" || Array.isArray(report)) return codaReceipt([codaDiagnostic("INVALID_USER_OBSERVATION", "用户观察报告必须是对象。", { path: "/" })]);
  checkFields(report, ALLOWED_FIELDS.report, "", diagnostics);
  if (report.observation_type !== "P3UserObservation") diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_TYPE", "observation_type 必须为 P3UserObservation。", { path: "/observation_type" }));
  if (report.schema_version !== 3) diagnostics.push(codaDiagnostic("UNSUPPORTED_USER_OBSERVATION_VERSION", "当前仅接受聚焦流程理解、自然度、编辑体验与运行正确性的 UserObservation@3。", { path: "/schema_version" }));
  if (!/^p3-[a-z0-9-]+$/.test(String(report.study_id ?? ""))) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_STUDY", "study_id 必须是脱敏的 p3 标识。", { path: "/study_id" }));
  if (!Array.isArray(report.observations)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATIONS", "observations 必须是数组。", { path: "/observations" }));
  const observations = Array.isArray(report.observations) ? report.observations : [];
  const ids = new Set();
  for (const [index, observation] of observations.entries()) {
    const path = `/observations/${index}`;
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) { diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_ENTRY", "观察记录必须是对象。", { path })); continue; }
    checkFields(observation, ALLOWED_FIELDS.observation, path, diagnostics);
    if (!/^u-[0-9]{3}$/.test(String(observation.participant_id ?? ""))) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_PARTICIPANT", "participant_id 必须是匿名编号。", { path: `${path}/participant_id` }));
    if (ids.has(observation.participant_id)) diagnostics.push(codaDiagnostic("DUPLICATE_USER_OBSERVATION_PARTICIPANT", "同一匿名参与者不能重复计入。", { path: `${path}/participant_id` }));
    ids.add(observation.participant_id);
    if (observation.target_user !== true) diagnostics.push(codaDiagnostic("USER_OBSERVATION_NOT_TARGET_USER", "只能将目标用户观察计入 G-P3-U。", { path: `${path}/target_user` }));
    if (!["none", "implementation", "review", "maintenance"].includes(observation.implementation_involvement)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_RELATIONSHIP", "必须明确参与者与实现项目的关系。", { path: `${path}/implementation_involvement` }));
    else if (observation.implementation_involvement !== "none") diagnostics.push(codaDiagnostic("USER_OBSERVATION_NOT_INDEPENDENT", "实现者、审阅者或维护者不得计入独立用户样本。", { path: `${path}/implementation_involvement` }));
    if (observation.eligibility_verified_by_observer !== true) diagnostics.push(codaDiagnostic("USER_OBSERVATION_ELIGIBILITY_NOT_CONFIRMED", "必须由观察主持人确认目标用户资格与未参与实现，不能只依赖样本自我声明。", { path: `${path}/eligibility_verified_by_observer` }));
    if (typeof observation.role_profile !== "string" || observation.role_profile.length === 0 || observation.role_profile.length > 80) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_ROLE_PROFILE", "role_profile 必须是最多 80 字的脱敏角色/经验摘要。", { path: `${path}/role_profile` }));
    else checkPrivateText(observation.role_profile, `${path}/role_profile`, diagnostics);
    if (!observation.consent || typeof observation.consent !== "object" || Array.isArray(observation.consent)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_CONSENT", "consent 必须是结构化同意记录。", { path: `${path}/consent` }));
    else checkFields(observation.consent, ALLOWED_FIELDS.consent, `${path}/consent`, diagnostics);
    if (observation.consent?.recorded !== true) diagnostics.push(codaDiagnostic("MISSING_USER_OBSERVATION_CONSENT", "观察记录必须确认已取得同意。", { path: `${path}/consent/recorded` }));
    if (typeof observation.consent?.recording_allowed !== "boolean") diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_RECORDING_CONSENT", "必须明确记录是否允许录音/录像；默认应为 false。", { path: `${path}/consent/recording_allowed` }));
    if (!Number.isInteger(observation.hint_count) || observation.hint_count < 0) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_HINT_COUNT", "hint_count 必须是非负整数。", { path: `${path}/hint_count` }));
    if (!["pass", "fail", "blocked"].includes(observation.outcome)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_OUTCOME", "outcome 必须是 pass/fail/blocked 之一。", { path: `${path}/outcome` }));
    if (!observation.tasks || typeof observation.tasks !== "object" || Array.isArray(observation.tasks)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_TASKS", "tasks 必须是结构化任务结果。", { path: `${path}/tasks` }));
    else checkFields(observation.tasks, ALLOWED_FIELDS.tasks, `${path}/tasks`, diagnostics);
    for (const task of TASKS) {
      const result = observation.tasks?.[task];
      if (!result || typeof result !== "object" || Array.isArray(result) || !["pass", "fail", "blocked"].includes(result.result) || typeof result.hint_free !== "boolean") diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_TASK", `任务 ${task} 缺少合法结果或 hint_free。`, { path: `${path}/tasks/${task}` }));
      else {
        checkFields(result, ALLOWED_FIELDS.task, `${path}/tasks/${task}`, diagnostics);
        if (result.summary !== undefined) {
          if (typeof result.summary !== "string" || result.summary.length === 0) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_TASK_SUMMARY", "任务摘要必须是非空脱敏文本。", { path: `${path}/tasks/${task}/summary` }));
          else checkPrivateText(result.summary, `${path}/tasks/${task}/summary`, diagnostics);
        }
      }
    }
    if (observation.quote_summaries !== undefined && !Array.isArray(observation.quote_summaries)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_SUMMARIES", "quote_summaries 必须是脱敏摘要数组。", { path: `${path}/quote_summaries` }));
    for (const [summaryIndex, summary] of (Array.isArray(observation.quote_summaries) ? observation.quote_summaries : []).entries()) {
      if (typeof summary !== "string") diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_SUMMARY", "quote_summaries 每项都必须是脱敏文本摘要。", { path: `${path}/quote_summaries/${summaryIndex}` }));
      else checkPrivateText(summary, `${path}/quote_summaries/${summaryIndex}`, diagnostics);
    }
    if (observation.blockers !== undefined && !Array.isArray(observation.blockers)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_BLOCKERS", "blockers 必须是结构化阻塞摘要数组。", { path: `${path}/blockers` }));
    for (const [blockerIndex, blocker] of (Array.isArray(observation.blockers) ? observation.blockers : []).entries()) {
      const blockerPath = `${path}/blockers/${blockerIndex}`;
      if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_BLOCKER", "阻塞摘要必须是结构化对象。", { path: blockerPath }));
      else {
        checkFields(blocker, ALLOWED_FIELDS.blocker, blockerPath, diagnostics);
        if (!["flow_understanding", "naturalness", "editing", "preview", "runtime", "confidence"].includes(blocker.stage)) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_BLOCKER_STAGE", "blocker stage 不受支持。", { path: `${blockerPath}/stage` }));
        if (typeof blocker.summary !== "string" || blocker.summary.length === 0) diagnostics.push(codaDiagnostic("INVALID_USER_OBSERVATION_BLOCKER_SUMMARY", "blocker summary 必须是非空脱敏摘要。", { path: `${blockerPath}/summary` }));
        else checkPrivateText(blocker.summary, `${blockerPath}/summary`, diagnostics);
      }
    }
    const allPass = TASKS.every((task) => observation.tasks?.[task]?.result === "pass");
    if (observation.outcome === "pass" && !allPass) diagnostics.push(codaDiagnostic("USER_OBSERVATION_OUTCOME_MISMATCH", "标记为 pass 的参与者必须完成全部任务。", { path: `${path}/outcome` }));
    if (observation.outcome === "pass" && observation.hint_count > 1) diagnostics.push(codaDiagnostic("USER_OBSERVATION_TOO_MANY_HINTS", "完整通过最多允许一次非答案性操作提示。", { path: `${path}/hint_count` }));
  }
  const qualified = qualifiedParticipants(observations);
  const passed = qualified.filter((observation) => observation?.outcome === "pass" && TASKS.every((task) => observation.tasks?.[task]?.result === "pass") && observation.hint_count === 0 && TASKS.every((task) => observation.tasks?.[task]?.hint_free === true)).length;
  if (qualified.length < 3) diagnostics.push(codaDiagnostic("USER_OBSERVATION_COUNT", "G-P3-U 至少需要 3 名未参与实现的目标用户。", { path: "/observations", actual: qualified.length, minimum: 3 }));
  if (passed < 2) diagnostics.push(codaDiagnostic("USER_OBSERVATION_PASS_THRESHOLD", "G-P3-U 至少需要 2 名无维护者提示通过完整任务的用户。", { path: "/observations", actual: passed, minimum: 2 }));
  return codaReceipt(diagnostics);
}
