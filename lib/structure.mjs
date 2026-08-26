import { parseModule } from "./ast.mjs";
import { redactSnippet } from "./evidence-util.mjs";

export const EXECUTORS = new Set(["executeTool", "runTool", "callTool", "execute_tool", "run_tool", "call_tool"]);
export const GATES = new Set(["authorize", "checkPermission", "hasPermission", "PermissionGate", "authorize_tool", "check_permission"]);
export const APPROVALS = new Set(["confirm", "requestApproval", "ApprovalGate", "requireConfirmation", "humanApproval", "request_approval"]);
export const PARSERS = new Set(["parse", "parseIntent", "safeParse", "askJson", "structuredParse", "parse_intent", "schema"]);
const PARSER_CALLEES = new Set(["JSON.parse", "schema.parse", "zod.parse", "z.parse"]);
export const TRACES = new Set(["trace", "record", "TraceLogger", "traceRecord", "emit", "trace_record"]);
export const REDACTORS = new Set(["redact", "sanitize", "maskSecret", "redactSecrets"]);
const BUDGETS = /maxSteps|maxDuration|timeout|LoopGuard|\bbudget\b|max_steps|max_duration/;
export const DANGEROUS = new Set(["deleteFile", "delete_file", "sendMessage", "send_message", "createPayment", "publishPost"]);
const WRITES = /writeFileSync|writeFile\(|rmSync|unlinkSync|rm -rf/;
export const RUNTIME = new Set(["run", "loop", "agentLoop", "tick", "step", "main", "AgentRuntime"]);

function callsNamed(fn, names) {
  return fn.calls.some((call) => names.has(call.name) || names.has(call.callee));
}

function callsMatching(fn, predicate) {
  return fn.calls.filter((call) => predicate(call));
}

function isParserCall(call) {
  return PARSERS.has(call.name) || PARSER_CALLEES.has(call.callee) || /schema\.parse|JSON\.parse|safeParse/.test(call.callee);
}

function isGateCall(call) {
  return GATES.has(call.name) || /PermissionGate/.test(call.callee);
}

function isApprovalCall(call) {
  return APPROVALS.has(call.name) || /ApprovalGate|confirm/.test(call.callee);
}

function isExecutorCall(call) {
  return EXECUTORS.has(call.name);
}

function isTraceCall(call) {
  return TRACES.has(call.name) || /trace\.record/.test(call.callee);
}

function isRedactCall(call) {
  return REDACTORS.has(call.name);
}

function pathSteps(fn) {
  const steps = [];
  const seen = new Set();
  for (const call of fn.calls) {
    const step = isParserCall(call)
      ? "schema"
      : isGateCall(call)
        ? "permission"
        : isApprovalCall(call)
          ? "confirmation"
          : isExecutorCall(call)
            ? "execution"
            : isTraceCall(call)
              ? "trace"
              : null;
    if (!step || seen.has(step)) continue;
    seen.add(step);
    steps.push(step);
  }
  return steps;
}

function functionRoles(fn) {
  const roles = [];
  if (RUNTIME.has(fn.name)) roles.push("runtime");
  if (EXECUTORS.has(fn.name)) roles.push("executor");
  if (GATES.has(fn.name)) roles.push("permission-gate");
  if (APPROVALS.has(fn.name)) roles.push("approval-gate");
  if (PARSERS.has(fn.name) || /parseIntent|safeParse/.test(fn.name)) roles.push("parser");
  if (DANGEROUS.has(fn.name)) roles.push("dangerous-action");
  if (REDACTORS.has(fn.name)) roles.push("redactor");
  if (TRACES.has(fn.name) || /log|trace|record/i.test(fn.name)) roles.push("trace-writer");
  return roles;
}

export function serializeFunction(fn) {
  return {
    fileRelative: fn.fileRelative,
    name: fn.name,
    startLine: fn.startLine,
    snippet: fn.snippet,
    calls: (fn.calls ?? []).map((call) => ({ name: call.name, callee: call.callee, index: call.index })),
    roles: fn.roles ?? functionRoles(fn),
    hasLoop: Boolean(fn.hasLoop),
    hasBudget: Boolean(fn.hasBudget),
    hasWrite: Boolean(fn.hasWrite),
    hasSecretToken: Boolean(fn.hasSecretToken),
    hasRedactToken: Boolean(fn.hasRedactToken),
    hasDangerousToken: Boolean(fn.hasDangerousToken),
    hasInlineDanger: Boolean(fn.hasInlineDanger),
  };
}

export function indexFunctions(files) {
  const codeFiles = files.filter((item) => item.kind === "code" && item.text != null);
  return codeFiles.flatMap((file) => {
    const ast = parseModule(file);
    return ast.functions.map((fn) => {
      const snippet = redactSnippet((file.text.split(/\r?\n/)[fn.startLine - 1] ?? "").trim());
      const indexed = {
        name: fn.name,
        startLine: fn.startLine,
        calls: fn.calls,
        fileRelative: file.relative,
        snippet,
        hasLoop: /while\s*\(|for\s*\(/.test(fn.body),
        hasBudget: BUDGETS.test(fn.body),
        hasWrite: WRITES.test(fn.body),
        hasSecretToken: /apiKey|api_key|password|secret/.test(fn.body),
        hasRedactToken: /redact|sanitize/.test(fn.body),
        hasDangerousToken: /deleteFile|sendMessage|createPayment|publishPost/.test(fn.body),
        hasInlineDanger: /unlinkSync|rmSync|writeFileSync|createPayment|publishPost|sendMessage/.test(fn.body),
      };
      indexed.roles = functionRoles(indexed);
      return indexed;
    });
  });
}

function evidence(id, fn, reason) {
  return {
    id,
    type: "code",
    file: fn.fileRelative,
    line: fn.startLine,
    snippet: fn.snippet,
    reason,
    confidence: "medium",
    analysis: "structural",
  };
}

export function analyzeIndexedFunctions(functions) {
  const evidenceItems = [];
  const executors = functions.filter((fn) => EXECUTORS.has(fn.name));
  const runtimes = functions.filter((fn) => RUNTIME.has(fn.name));
  const dangerous = functions.filter((fn) => DANGEROUS.has(fn.name));

  let t02Gated = false;
  let t02Bypass = null;
  for (const fn of executors) {
    if (callsNamed(fn, GATES) || fn.calls.some(isGateCall)) {
      t02Gated = true;
      evidenceItems.push(evidence("T-02", fn, "Tool executor calls a permission gate (call chain)"));
      continue;
    }
    t02Bypass = {
      file: fn.fileRelative,
      reason: "Tool execution does not call a permission gate",
      evidence: evidence("T-02", fn, "Tool executor runs without an authorization check"),
    };
    evidenceItems.push(t02Bypass.evidence);
  }

  const unusedGate = functions.find(
    (fn) => GATES.has(fn.name) && !functions.some((other) => other !== fn && other.calls.some((call) => call.name === fn.name)),
  );
  if (unusedGate && executors.length && !t02Gated) {
    t02Bypass = {
      file: unusedGate.fileRelative,
      reason: "Permission helper is never called from a tool executor (dead code)",
      evidence: evidence("T-02", unusedGate, "Authorization helper is never invoked from executeTool"),
    };
    evidenceItems.push(t02Bypass.evidence);
  }

  let t03Gated = false;
  let t03Bypass = null;
  for (const fn of dangerous) {
    if (callsNamed(fn, APPROVALS) || fn.calls.some(isApprovalCall)) {
      t03Gated = true;
      evidenceItems.push(evidence("T-03", fn, "Dangerous action calls an approval or confirmation gate"));
      continue;
    }
    t03Bypass = {
      file: fn.fileRelative,
      reason: "Dangerous action does not require confirmation",
      evidence: evidence("T-03", fn, "Dangerous executor has no approval gate"),
    };
    evidenceItems.push(t03Bypass.evidence);
  }
  for (const fn of executors) {
    const delegates = fn.calls.some((call) => DANGEROUS.has(call.name));
    if (!delegates && fn.hasInlineDanger && !(callsNamed(fn, APPROVALS) || fn.calls.some(isApprovalCall))) {
      t03Bypass = {
        file: fn.fileRelative,
        reason: "Dangerous action does not require confirmation",
        evidence: evidence("T-03", fn, "Tool executor performs a dangerous side effect without confirmation"),
      };
      evidenceItems.push(t03Bypass.evidence);
    }
  }

  let r02Validated = false;
  let r02Bypass = null;
  for (const fn of [...runtimes, ...executors]) {
    const parserCalls = callsMatching(fn, isParserCall);
    const execCalls = callsMatching(fn, isExecutorCall);
    if (parserCalls.length && execCalls.length && parserCalls[0].index < execCalls[0].index) {
      r02Validated = true;
      evidenceItems.push(evidence("R-02", fn, "Schema or JSON parse happens before tool execution"));
    } else if (RUNTIME.has(fn.name) && execCalls.length && !parserCalls.length) {
      r02Bypass = {
        file: fn.fileRelative,
        reason: "Runtime executes tools without schema-validating model output",
        evidence: evidence("R-02", fn, "run/loop calls executeTool without a parse/schema step"),
      };
      evidenceItems.push(r02Bypass.evidence);
    }
  }
  if (!r02Validated) {
    const parserFn = functions.find((fn) => PARSERS.has(fn.name) || /parseIntent|safeParse/.test(fn.name));
    if (parserFn && functions.some((fn) => fn.calls.some((call) => call.name === parserFn.name))) {
      r02Validated = true;
      evidenceItems.push(evidence("R-02", parserFn, "Intent parser is part of the runtime call chain"));
    }
  }

  let r03Guarded = false;
  let r03Bypass = null;
  for (const fn of functions) {
    const runsTools = callsNamed(fn, EXECUTORS) || RUNTIME.has(fn.name);
    if ((fn.hasLoop || runsTools) && fn.hasBudget) {
      r03Guarded = true;
      evidenceItems.push(evidence("R-03", fn, "Loop or runtime is bounded by maxSteps, timeout, or budget"));
    } else if (fn.hasLoop && runsTools && !fn.hasBudget) {
      r03Bypass = {
        file: fn.fileRelative,
        reason: "Tool loop has no maxSteps, timeout, or budget",
        evidence: evidence("R-03", fn, "Unbounded loop calls a tool executor"),
      };
      evidenceItems.push(r03Bypass.evidence);
    }
  }

  let o03Redacted = false;
  let o03Leak = null;
  for (const fn of functions) {
    const isLogger = /log|trace|record/i.test(fn.name) || fn.calls.some(isTraceCall);
    if (isLogger && (callsNamed(fn, REDACTORS) || fn.calls.some(isRedactCall) || fn.hasRedactToken)) {
      o03Redacted = true;
      evidenceItems.push(evidence("O-03", fn, "Trace or log path calls a redaction helper"));
    }
    if (isLogger && fn.hasSecretToken && !fn.hasRedactToken) {
      o03Leak = {
        file: fn.fileRelative,
        reason: "Log/trace path may write secrets without redaction",
        evidence: evidence("O-03", fn, "Logger references secrets without a redaction call"),
      };
      evidenceItems.push(o03Leak.evidence);
    }
  }

  const unrestrictedWrite = functions.find((fn) => fn.hasWrite && !callsNamed(fn, GATES) && !callsNamed(fn, APPROVALS));
  if (unrestrictedWrite) {
    evidenceItems.push(evidence("T-02", unrestrictedWrite, "File write or delete runs without a permission or approval check"));
    if (!t02Bypass) {
      t02Bypass = {
        file: unrestrictedWrite.fileRelative,
        reason: "Unrestricted file write or delete path",
        evidence: evidenceItems.at(-1),
      };
    }
  }

  const criticalPaths = runtimes.map((fn) => ({ function: fn.name, file: fn.fileRelative, steps: pathSteps(fn) }));
  const preferred = criticalPaths.find((item) => item.steps.includes("execution")) ?? criticalPaths[0];

  return {
    t02: { gated: t02Gated && !t02Bypass, bypass: t02Bypass },
    t03: { gated: t03Gated && !t03Bypass, bypass: t03Bypass },
    r02: { validated: r02Validated && !r02Bypass, bypass: r02Bypass },
    r03: { guarded: r03Guarded && !r03Bypass, bypass: r03Bypass },
    o03: { redacted: o03Redacted && !o03Leak, leak: o03Leak },
    criticalPath: preferred ?? { function: null, file: null, steps: [] },
    evidence: evidenceItems,
    functions: functions.map(serializeFunction),
  };
}

export function analyzeStructure(files, extraFunctions = []) {
  const indexed = indexFunctions(files);
  const seen = new Set(indexed.map((fn) => `${fn.fileRelative}#${fn.name}`));
  const extras = extraFunctions.filter((fn) => fn?.fileRelative && !seen.has(`${fn.fileRelative}#${fn.name}`));
  return analyzeIndexedFunctions([...indexed, ...extras]);
}
