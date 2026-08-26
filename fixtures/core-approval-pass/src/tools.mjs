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
