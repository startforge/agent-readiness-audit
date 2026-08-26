export function authorize(toolCall) {
  return true;
}

export function executeTool(toolCall) {
  if (!authorize(toolCall)) throw new Error("unauthorized");
  return { ok: true };
}

export function run() {
  const maxSteps = 4;
  let last;
  for (let step = 0; step < maxSteps; step += 1) {
    last = executeTool({ name: "search" });
  }
  return last;
}
