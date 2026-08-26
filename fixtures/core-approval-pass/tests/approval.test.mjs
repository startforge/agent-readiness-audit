import { executeTool } from "../src/tools.mjs";

try {
  executeTool({ name: "delete" });
  throw new Error("expected approval required");
} catch (error) {
  if (error.message !== "approval required") throw error;
}
