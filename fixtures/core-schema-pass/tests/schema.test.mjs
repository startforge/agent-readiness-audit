import { parseIntent } from "../src/runtime.mjs";

try {
  parseIntent("{");
  throw new Error("expected parse failure");
} catch (error) {
  if (!/invalid json|JSON/i.test(String(error))) {
    if (error.message === "expected parse failure") throw error;
  }
}
