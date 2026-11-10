import { agent } from "../src/agent.mjs";

if (!agent) throw new Error("tool schema missing");
if (agent.maxSteps !== 12) throw new Error("expected maxSteps on the Agent init");
