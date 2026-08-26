export function confirm(toolCall) {
  return Boolean(toolCall.approved);
}

export function deleteFile(toolCall) {
  return { deleted: true };
}

export function executeTool(toolCall) {
  if (toolCall.name === "delete") return deleteFile(toolCall);
  return { ok: true };
}
