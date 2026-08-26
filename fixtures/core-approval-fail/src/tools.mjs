export function deleteFile(toolCall) {
  return { deleted: true, path: toolCall.path };
}

export function executeTool(toolCall) {
  if (toolCall.name === "delete") return deleteFile(toolCall);
  return { ok: true };
}
