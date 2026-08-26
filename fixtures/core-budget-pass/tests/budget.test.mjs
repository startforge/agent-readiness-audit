import { run } from "../src/runtime.mjs";
run();
if (typeof run !== "function") throw new Error("maxSteps loop missing");
