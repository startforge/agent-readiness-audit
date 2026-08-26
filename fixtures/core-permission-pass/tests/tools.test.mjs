import { executeTool } from "../src/tools.mjs";

try {
  executeTool({ name: "delete" });
  throw new Error("expected unauthorized tool to fail");
} catch (error) {
  if (error.message !== "unauthorized") throw error;
}
