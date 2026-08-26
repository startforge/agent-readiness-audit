export function parseIntent(raw) {
  const data = JSON.parse(raw);
  if (typeof data?.name !== "string") throw new Error("invalid json");
  return data;
}

export function authorize(toolCall) {
  return true;
}

export function executeTool(toolCall) {
  if (!authorize(toolCall)) throw new Error("unauthorized");
  return { ok: true };
}

export function run(raw) {
  const intent = parseIntent(raw);
  return executeTool(intent);
}
