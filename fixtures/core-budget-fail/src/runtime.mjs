export function executeTool(toolCall) {
  return toolCall;
}

export function run() {
  while (true) executeTool({ name: "search" });
}
