import { gseosDiagnostic, gseosReceipt } from "./diagnostics.js";

const WORDS = new Map([
  ["if", "IF"], ["若", "IF"], ["else", "ELSE"], ["否则", "ELSE"], ["let", "LET"], ["令", "LET"], ["do", "DO"], ["执行", "DO"], ["await", "AWAIT"], ["等待", "AWAIT"], ["read", "READ"], ["读取", "READ"], ["publish", "PUBLISH"], ["发出", "PUBLISH"], ["return", "RETURN"], ["返回", "RETURN"], ["and", "AND"], ["且", "AND"], ["or", "OR"], ["或", "OR"], ["not", "NOT"], ["非", "NOT"], ["true", "TRUE"], ["真", "TRUE"], ["false", "FALSE"], ["假", "FALSE"], ["null", "NULL"], ["无", "NULL"],
]);
const SYMBOLS = [["->", "ARROW"], [">=", "GTE"], ["<=", "LTE"], ["==", "EQ"], ["!=", "NE"], ["&&", "AND"], ["||", "OR"], ["+", "PLUS"], ["-", "MINUS"], ["*", "STAR"], ["/", "SLASH"], ["%", "PERCENT"], [">", "GT"], ["<", "LT"], ["=", "ASSIGN"], ["@", "AT"], ["(", "LPAREN"], [")", "RPAREN"], ["[", "LBRACKET"], ["]", "RBRACKET"], ["{", "LBRACE"], ["}", "RBRACE"], [",", "COMMA"], [":", "COLON"], [".", "DOT"]];
const WORD_OPERATORS = new Map([["大于", "GT"], ["不小于", "GTE"], ["小于", "LT"], ["不大于", "LTE"], ["等于", "EQ"], ["不等于", "NE"], ["加", "PLUS"], ["减", "MINUS"], ["乘", "STAR"], ["除", "SLASH"], ["余", "PERCENT"], ["连接", "CONNECT"]]);
const EXPRESSION_PRECEDENCE = new Map([["OR", 1], ["AND", 2], ["EQ", 3], ["NE", 3], ["GT", 4], ["GTE", 4], ["LT", 4], ["LTE", 4], ["PLUS", 5], ["MINUS", 5], ["CONNECT", 5], ["STAR", 6], ["SLASH", 6], ["PERCENT", 6]]);
const OPERATOR_TEXT = new Map([["OR", "or"], ["AND", "and"], ["EQ", "=="], ["NE", "!="], ["GT", ">"], ["GTE", ">="], ["LT", "<"], ["LTE", "<="], ["PLUS", "+"], ["MINUS", "-"], ["CONNECT", "connect"], ["STAR", "*"], ["SLASH", "/"], ["PERCENT", "%"]]);

function token(kind, value, start, end, line, column) { return { kind, value, start, end, line, column }; }
function stripQuotes(value) { return value?.startsWith("「") ? value.slice(1, -1) : value?.startsWith('"') ? JSON.parse(value) : value; }
function indentOf(line) { return (line.match(/^ */)?.[0].length ?? 0); }

export function lexGse(text) {
  const source = String(text).normalize("NFC").replace(/^\uFEFF/, ""); const diagnostics = []; const tokens = [];
  let index = 0; let line = 1; let column = 1;
  const advance = (value) => { for (const character of value) { if (character === "\n") { line += 1; column = 1; } else column += 1; } };
  while (index < source.length) {
    const character = source[index];
    if (character === "\n") { tokens.push(token("NEWLINE", "\n", index, index + 1, line, column)); advance("\n"); index += 1; continue; }
    if (character === "\r") { diagnostics.push(gseosDiagnostic("CRLF_NOT_ALLOWED", "GSE 文本必须使用 LF 换行。", { start: index, end: index + 1, line, column })); advance(character); index += 1; continue; }
    if (character === "\t") { diagnostics.push(gseosDiagnostic("TAB_INDENTATION", "GSE 文本不允许 Tab 缩进。", { start: index, end: index + 1, line, column })); advance(character); index += 1; continue; }
    if (/\s/u.test(character)) { advance(character); index += 1; continue; }
    if (character === "#") { const end = source.indexOf("\n", index); const value = source.slice(index, end < 0 ? source.length : end); tokens.push(token("COMMENT", value, index, index + value.length, line, column)); advance(value); index += value.length; continue; }
    const punctuation = source.slice(index).match(/^（|^）|^［|^］|^【|^】|^，|^：|^；|^→/u)?.[0];
    if (punctuation) { const mapped = { "（": "LPAREN", "）": "RPAREN", "［": "LBRACKET", "］": "RBRACKET", "【": "LBRACE", "】": "RBRACE", "，": "COMMA", "：": "COLON", "；": "SEMICOLON", "→": "ARROW" }[punctuation]; tokens.push(token(mapped, punctuation, index, index + punctuation.length, line, column)); advance(punctuation); index += punctuation.length; continue; }
    const symbol = SYMBOLS.find(([value]) => source.startsWith(value, index));
    if (symbol) { tokens.push(token(symbol[1], symbol[0], index, index + symbol[0].length, line, column)); advance(symbol[0]); index += symbol[0].length; continue; }
    if (character === '"' || character === "「") { const close = character === '"' ? '"' : "」"; let cursor = index + 1; while (cursor < source.length && source[cursor] !== close) cursor += 1; if (cursor >= source.length) diagnostics.push(gseosDiagnostic("UNTERMINATED_STRING", "字符串没有闭合。", { start: index, end: source.length, line, column })); const value = source.slice(index, Math.min(cursor + 1, source.length)); tokens.push(token("STRING", value, index, index + value.length, line, column)); advance(value); index += value.length; continue; }
    const number = source.slice(index).match(/^\d+(?:\.\d+)?/u)?.[0];
    if (number) { tokens.push(token("NUMBER", number, index, index + number.length, line, column)); advance(number); index += number.length; continue; }
    const identifier = source.slice(index).match(/^[\p{L}_][\p{L}\p{N}_]*/u)?.[0];
    if (identifier) { const kind = WORDS.get(identifier) ?? WORD_OPERATORS.get(identifier) ?? "IDENT"; tokens.push(token(kind, identifier, index, index + identifier.length, line, column)); advance(identifier); index += identifier.length; continue; }
    diagnostics.push(gseosDiagnostic("INVALID_TOKEN", `无法识别的字符：${character}。`, { start: index, end: index + 1, line, column })); advance(character); index += 1;
  }
  tokens.push(token("EOF", "", source.length, source.length, line, column)); return { tokens, receipt: gseosReceipt(diagnostics), source };
}

export function parseExpressionText(text) {
  const lexed = lexGse(text); const tokens = lexed.tokens.filter((item) => !["EOF", "NEWLINE", "COMMENT"].includes(item.kind)); let index = 0; const diagnostics = [...lexed.receipt.diagnostics];
  const primary = () => {
    const current = tokens[index++];
    if (!current) { diagnostics.push(gseosDiagnostic("EXPECTED_EXPRESSION", "表达式不完整。", { start: String(text).length, end: String(text).length })); return null; }
    if (current.kind === "NUMBER") return Number(current.value);
    if (current.kind === "STRING") return stripQuotes(current.value);
    if (current.kind === "TRUE") return true;
    if (current.kind === "FALSE") return false;
    if (current.kind === "NULL") return null;
    if (current.kind === "NOT" || current.kind === "MINUS") return { op: current.kind === "NOT" ? "not" : "negate", value: primary() };
    if (current.kind === "LPAREN") { const inner = parseBinary(0); if (tokens[index]?.kind === "RPAREN") index += 1; else diagnostics.push(gseosDiagnostic("EXPECTED_RPAREN", "表达式缺少右括号。", { start: current.start, end: current.end })); return inner; }
    if (!["IDENT", "READ", "DO", "AWAIT", "LET"].includes(current.kind)) { diagnostics.push(gseosDiagnostic("INVALID_EXPRESSION_TOKEN", `表达式中不允许 ${current.value}。`, { start: current.start, end: current.end })); return null; }
    let reference = current.value; while (tokens[index]?.kind === "DOT") { index += 1; const member = tokens[index++]; if (!member) break; reference += `.${member.value}`; } return { ref: reference };
  };
  const parseBinary = (minimum) => { let left = primary(); while (tokens[index] && EXPRESSION_PRECEDENCE.has(tokens[index].kind) && EXPRESSION_PRECEDENCE.get(tokens[index].kind) >= minimum) { const operator = tokens[index++]; const precedence = EXPRESSION_PRECEDENCE.get(operator.kind); const right = parseBinary(precedence + 1); left = { op: OPERATOR_TEXT.get(operator.kind), left, right }; } return left; };
  const expression = parseBinary(0); if (index < tokens.length) diagnostics.push(gseosDiagnostic("TRAILING_EXPRESSION_TOKENS", "表达式后存在未消费的 token。", { start: tokens[index].start, end: tokens.at(-1).end })); return { expression, tokens, receipt: gseosReceipt(diagnostics) };
}

export function parseCst(text) {
  const lexed = lexGse(text); const lines = lexed.source.split("\n"); const children = lines.map((raw, index) => ({ kind: raw.trim() ? raw.trimStart().startsWith("#") ? "comment" : "statement" : "blank", raw, indent: indentOf(raw), line: index + 1, tokens: lexed.tokens.filter((item) => item.line === index + 1) })); return { kind: "File", source: lexed.source, children, tokens: lexed.tokens, receipt: lexed.receipt };
}

function expressionFromText(text) { return parseExpressionText(text).expression ?? { ref: String(text).trim() }; }

function parseEventArguments(text) {
  if (!text?.trim()) return [];
  return text.split(/[,，]/u).map((item) => item.trim()).filter(Boolean).map((id) => ({ id, name: id, type: "Any" }));
}

export function parseGse(text) {
  const lexed = lexGse(text); const diagnostics = [...lexed.receipt.diagnostics]; const lines = lexed.source.split("\n"); let moduleId = null; let event = null; const root = []; const stack = [{ indent: -1, nodes: root }];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]; const trimmed = raw.trim(); if (!trimmed || trimmed.startsWith("#")) continue; const indent = indentOf(raw);
    const moduleMatch = trimmed.match(/^(?:module|模块)\s+([\w.]+)/u); if (moduleMatch) { moduleId = moduleMatch[1]; continue; }
    const eventMatch = trimmed.match(/^(?:event|事件)\s+([\p{L}\w.]+)(?:\s*[（(]([^）)]*)[）)])?(?:\s*\[\s*(?:id|标识)\s*[:：]\s*([\w.]+)\s*\])?/u);
    if (eventMatch) { event = { display_name: eventMatch[1], event_id: eventMatch[3] ?? eventMatch[1], args: parseEventArguments(eventMatch[2]), root }; continue; }
    if (!event) { diagnostics.push(gseosDiagnostic("STATEMENT_OUTSIDE_EVENT", "语句必须位于事件中。", { line: index + 1 })); continue; }
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop(); const parent = stack.at(-1).nodes; const nodeId = `imported-${index + 1}`; const span = { start: { line: index + 1, column: indent + 1 }, end: { line: index + 1, column: raw.length + 1 } };
    const ifMatch = trimmed.match(/^(?:if|若)\s*[（(](.+?)[）)]\s*[:：]?$/u); const letMatch = trimmed.match(/^(?:let|令)\s+([\p{L}_][\p{L}\p{N}_]*)\s*(?:=|为)\s*(.+)$/u); const callMatch = trimmed.match(/^(do|执行|await|等待)\s+([\w.]+)(@\d+)?\s*[(（](.*)[)）]/u); const publishMatch = trimmed.match(/^(?:publish|发出)\s+([\w.]+)(@\d+)?\s*[(（](.*)[)）]/u); let node = null;
    if (ifMatch) { node = { node_id: nodeId, command_id: "if", params: { condition: expressionFromText(ifMatch[1]) }, children: { then: [] }, source_span: span }; parent.push(node); stack.push({ indent, nodes: node.children.then }); continue; }
    if (letMatch) node = { node_id: nodeId, command_id: "let", params: { name: letMatch[1], value: expressionFromText(letMatch[2]) }, source_span: span };
    else if (callMatch) { const kind = callMatch[1] === "await" || callMatch[1] === "等待" ? "await" : "do"; node = { node_id: nodeId, command_id: kind, params: { capability: `${callMatch[2]}${callMatch[3] ?? ""}`, args: parseArguments(callMatch[4]) }, source_span: span }; }
    else if (publishMatch) node = { node_id: nodeId, command_id: "publish", params: { topic: `${publishMatch[1]}${publishMatch[2] ?? ""}`, payload: expressionFromText(publishMatch[3]) }, source_span: span };
    else diagnostics.push(gseosDiagnostic("PARSE_UNSUPPORTED_STATEMENT", `无法解析语句：${trimmed}。`, { line: index + 1 }));
    if (node) parent.push(node);
  }
  if (!event) diagnostics.push(gseosDiagnostic("MISSING_EVENT", "文本必须包含事件声明。", { line: 1 }));
  const asset = event ? { asset_type: "EventAsset", schema_version: 1, event_id: event.event_id, display_name: event.display_name, args: event.args, recovery: "E0", root } : null; return { module_id: moduleId, asset, receipt: gseosReceipt(diagnostics) };
}

function parseArguments(text) { const args = {}; for (const item of text.split(/[,，]/u).map((part) => part.trim()).filter(Boolean)) { const match = item.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*[:：]\s*(.+)$/u); if (match) args[match[1]] = expressionFromText(match[2]); } return args; }

export function bindEventAsset(asset, registry) {
  const diagnostics = []; const scopes = [new Map((asset.args ?? []).map((item) => [item.id, item.type]))];
  const walk = (nodes) => { for (const node of nodes ?? []) { const params = node.params ?? {}; const refs = []; const collect = (item) => { if (item && typeof item === "object") { if (item.ref) refs.push(item.ref); Object.values(item).forEach(collect); } }; collect(params); const visible = scopes.at(-1); for (const ref of refs) if (!visible.has(ref)) diagnostics.push(gseosDiagnostic("UNRESOLVED_REFERENCE", `引用未绑定：${ref}。`, { event_id: asset.event_id, node_id: node.node_id, target_id: ref }));
      const output = params.bind ?? params.args?.bind; if (output) { if (visible.has(output)) diagnostics.push(gseosDiagnostic("SSA_REASSIGNMENT", `局部绑定不能重复定义：${output}。`, { event_id: asset.event_id, node_id: node.node_id })); visible.set(output, "Any"); }
      if (node.command_id === "let") { const name = params.name; if (visible.has(name)) diagnostics.push(gseosDiagnostic("SSA_REASSIGNMENT", `局部绑定不能重复定义：${name}。`, { event_id: asset.event_id, node_id: node.node_id })); visible.set(name, "Any"); }
      if (node.command_id === "if") { scopes.push(new Map(visible)); Object.values(node.children ?? {}).forEach(walk); scopes.pop(); } else Object.values(node.children ?? {}).forEach(walk);
    } };
  walk(asset.root); return { asset, receipt: gseosReceipt(diagnostics) };
}

export function formatGse(textOrAsset, mode = "preserve") {
  if (typeof textOrAsset === "string") { const normalized = textOrAsset.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, "  ").trimEnd(); if (mode === "preserve") return `${normalized}\n`; const parsed = parseGse(normalized); return parsed.receipt.ok ? formatGse(parsed.asset, mode) : `${normalized}\n`; }
  const asset = textOrAsset; const chinese = mode === "zh"; const keyword = chinese ? { if: "若", let: "令", do: "执行", await: "等待", publish: "发出" } : { if: "if", let: "let", do: "do", await: "await", publish: "publish" }; const lines = [chinese ? `事件 ${asset.event_id}：` : `event ${asset.event_id}:`];
  const walk = (nodes, indent) => { for (const node of nodes ?? []) { const pad = "  ".repeat(indent); if (node.command_id === "if") { lines.push(`${pad}${keyword.if}${chinese ? "（" : " ("}${formatExpression(node.params.condition)}${chinese ? "）：" : "):"}`); walk(node.children?.then, indent + 1); } else if (node.command_id === "let") lines.push(`${pad}${keyword.let} ${node.params.name} ${chinese ? "为" : "="} ${formatExpression(node.params.value)}`); else if (["do", "await"].includes(node.command_id)) lines.push(`${pad}${keyword[node.command_id]} ${node.params.capability}()`); else if (node.command_id === "publish") lines.push(`${pad}${keyword.publish} ${node.params.topic}(${formatExpression(node.params.payload)})`); } }; walk(asset.root, 1); return `${lines.join("\n")}\n`;
}

function formatExpression(value) { if (value && typeof value === "object" && value.ref) return value.ref; if (value && typeof value === "object" && value.op) return value.op === "connect" ? value.items.map(formatExpression).join(" connect ") : `${formatExpression(value.left)} ${value.op} ${formatExpression(value.right)}`; if (typeof value === "string") return JSON.stringify(value); return String(value); }
