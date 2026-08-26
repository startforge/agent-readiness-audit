export function parseIntent(raw) {
  const data = JSON.parse(raw);
  if (typeof data?.name !== "string") throw new Error("invalid json");
  return data;
}

export function authorize(toolCall) {
  return ["search", "delete"].includes(toolCall.name);
}

export function confirm(toolCall) {
  if (toolCall.name === "delete") return Boolean(toolCall.approved);
  return true;
}

export function deleteFile(toolCall) {
  if (!confirm(toolCall)) throw new Error("approval required");
  return { deleted: true };
}

export function executeTool(toolCall) {
  if (!authorize(toolCall)) throw new Error("unauthorized");
  if (toolCall.name === "delete") return deleteFile(toolCall);
  return { ok: true };
}

export function redact(value) {
  return String(value).replace(/sk-[A-Za-z0-9]+/g, "[REDACTED]");
}

export function traceRecord(event) {
  return { runId: event.runId, sessionId: event.sessionId, message: redact(event.message ?? ""), latencyMs: event.latencyMs };
}

export function run(raw, { maxSteps = 8 } = {}) {
  if (maxSteps < 1) throw new Error("budget exceeded");
  const intent = parseIntent(raw);
  const result = executeTool(intent);
  return traceRecord({ runId: "run-1", sessionId: "s-1", message: "ok", latencyMs: 12, result });
}
