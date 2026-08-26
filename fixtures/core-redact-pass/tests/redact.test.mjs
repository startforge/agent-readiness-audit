import { traceRecord } from "../src/trace.mjs";

const event = traceRecord({ message: "sk-testsecretvalue", apiKey: "hidden" });
if (!String(event.message).includes("[REDACTED]")) throw new Error("expected redact");
if (JSON.stringify(event).includes("sk-test")) throw new Error("does not expose secrets");
