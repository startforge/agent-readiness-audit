export function executeTool(toolCall) {
  // authorize(toolCall)
  return { ok: true, name: toolCall.name };
}
