export function authorize(toolCall) {
  return toolCall.name === "search";
}

export function executeTool(toolCall) {
  return { ok: true, name: toolCall.name };
}
