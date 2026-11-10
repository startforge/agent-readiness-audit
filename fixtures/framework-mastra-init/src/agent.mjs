import { Agent, createTool } from "@mastra/core";

export const search = createTool({
  id: "search",
  inputSchema: { type: "object" },
  execute: async () => ({ ok: true }),
});

export const agent = new Agent({
  name: "demo",
  maxSteps: 12,
  tools: { search },
});
