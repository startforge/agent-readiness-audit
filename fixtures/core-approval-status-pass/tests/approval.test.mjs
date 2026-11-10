import { executeTool } from "../src/tools.mjs";

const pending = executeTool({ name: "archive", id: "p1" });
if (pending.status !== "awaiting_confirmation") throw new Error("expected awaiting_confirmation");

try {
  executeTool({ name: "archive", id: "p1", status: "awaiting_confirmation" });
  throw new Error("expected approval required");
} catch (error) {
  if (error.message !== "approval required") throw error;
}

const done = executeTool({ name: "archive", id: "p1", status: "awaiting_confirmation", approved: true });
if (!done.archived) throw new Error("expected archive after confirmation");
