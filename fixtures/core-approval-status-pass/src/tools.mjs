const DANGEROUS = new Set(["archive", "modify"]);

export function archive(toolCall) {
  return { archived: true, id: toolCall.id };
}

export function modify(toolCall) {
  return { modified: true, id: toolCall.id };
}

export function executeTool(toolCall) {
  if (DANGEROUS.has(toolCall.name) && toolCall.status !== "awaiting_confirmation") {
    return { status: "awaiting_confirmation", name: toolCall.name };
  }
  if (DANGEROUS.has(toolCall.name) && !toolCall.approved) throw new Error("approval required");
  if (toolCall.name === "archive") return archive(toolCall);
  if (toolCall.name === "modify") return modify(toolCall);
  return { ok: true };
}
