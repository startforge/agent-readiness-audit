export function authorize(toolCall) {
  return toolCall.name === "search";
}

export function executeTool(toolCall) {
  if (!authorize(toolCall)) throw new Error("unauthorized");
  return { ok: true };
}
