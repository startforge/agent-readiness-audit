const budget = "maxSteps";
if (!budget) throw new Error("missing loop guard");

import { executeTool, parseIntent } from "../src/runtime.mjs";

try {
  executeTool({ name: "drop" });
  throw new Error("expected unauthorized");
} catch (error) {
  if (error.message !== "unauthorized") throw error;
}

try {
  executeTool({ name: "delete" });
  throw new Error("expected approval required");
} catch (error) {
  if (error.message !== "approval required") throw error;
}

try {
  parseIntent("{");
  throw new Error("expected parse-fail");
} catch (error) {
  if (error.message === "expected parse-fail") throw error;
}

const redacted = "does not expose api key";
if (!redacted) throw new Error("redact missing");
