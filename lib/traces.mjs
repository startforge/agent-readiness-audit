import { execFileSync } from "node:child_process";
import { redactSnippet } from "./evidence-util.mjs";

function percentile(sorted, ratio) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
}

function numberField(event, keys) {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function flattenOtel(json, file, events) {
  const spans = json?.resourceSpans ?? json?.resource_spans ?? [];
  if (!Array.isArray(spans)) {
    if (json && typeof json === "object" && (json.runId || json.traceId || json.latencyMs)) {
      events.push({ file: file.relative, line: 1, event: json });
    }
    return;
  }
  let line = 1;
  for (const resource of spans) {
    for (const scope of resource.scopeSpans ?? resource.scope_spans ?? []) {
      for (const span of scope.spans ?? []) {
        const attributes = Object.fromEntries((span.attributes ?? []).map((item) => [item.key, item.value?.stringValue ?? item.value?.intValue ?? item.value?.doubleValue]));
        events.push({
          file: file.relative,
          line,
          event: {
            traceId: span.traceId ?? span.trace_id,
            runId: attributes.runId ?? attributes.run_id,
            sessionId: attributes.sessionId,
            latencyMs: span.endTimeUnixNano && span.startTimeUnixNano ? Number(span.endTimeUnixNano - span.startTimeUnixNano) / 1e6 : null,
            name: span.name,
            ok: span.status?.code !== "ERROR" && span.status?.code !== 2,
            ...attributes,
          },
        });
        line += 1;
      }
    }
  }
}

function parseJsonl(file) {
  const events = [];
  const lines = file.text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      events.push({ file: file.relative, line: index + 1, event: JSON.parse(line) });
    } catch {
      // skip malformed trace lines
    }
  }
  return events;
}

function isTraceFile(file) {
  return (
    /\.jsonl$/i.test(file.relative) ||
    /(^|\/)traces?\//i.test(file.relative) ||
    /(^|\/)(otel|trace|spans?)\.json$/i.test(file.relative)
  );
}

function runtimeItem(standardId, record, reason) {
  const event = record.event;
  const snippet = redactSnippet(JSON.stringify(event).slice(0, 180));
  return {
    standardId,
    type: "runtime",
    file: record.file,
    line: record.line,
    snippet,
    reason,
    confidence: "high",
  };
}

export function importTraces(files) {
  const events = [];
  for (const file of files) {
    if (!isTraceFile(file)) continue;
    if (/\.jsonl$/i.test(file.relative)) events.push(...parseJsonl(file));
    else {
      try {
        flattenOtel(JSON.parse(file.text), file, events);
      } catch {
        events.push(...parseJsonl(file));
      }
    }
  }

  const latencies = events.map((item) => numberField(item.event, ["latencyMs", "latency", "durationMs"])).filter((item) => item != null).sort((a, b) => a - b);
  const costs = events.map((item) => numberField(item.event, ["estimatedCost", "cost", "usage"])).filter((item) => item != null);
  const toolCallCounts = events.map((item) => numberField(item.event, ["toolCalls", "tool_calls"])).filter((item) => item != null);
  const outcomes = events.filter((item) => "ok" in item.event || "success" in item.event || item.event.status);
  const successes = outcomes.filter((item) => item.event.ok === true || item.event.success === true || item.event.status === "ok" || item.event.status === "success");
  const categories = [...new Set(events.map((item) => item.event.failureCategory ?? item.event.failure_category).filter(Boolean))];

  const evidence = [];
  for (const record of events) {
    const event = record.event;
    if (event.permission || event.authorize || event.decision === "deny" || event.decision === "allow") {
      evidence.push(runtimeItem("T-02", record, "Runtime trace records a permission decision"));
    }
    if (event.approval || event.confirm || event.confirmed === true || event.approval === "confirmed") {
      evidence.push(runtimeItem("T-03", record, "Runtime trace records an approval decision"));
    }
    if (event.runId || event.sessionId || event.taskId || event.traceId) {
      evidence.push(runtimeItem("O-01", record, "Runtime trace includes run/session/task correlation IDs"));
    }
    if (numberField(event, ["latencyMs", "latency", "estimatedCost", "cost", "toolCalls"]) != null) {
      evidence.push(runtimeItem("O-02", record, "Runtime trace records latency, cost, or tool-call count"));
    }
    if (event.failureCategory || event.failure_category) {
      evidence.push(runtimeItem("E-02", record, "Runtime trace includes a failure category"));
    }
    if (event.redacted === true || (typeof event.message === "string" && event.message.includes("[REDACTED]"))) {
      evidence.push(runtimeItem("O-03", record, "Runtime trace is redacted"));
    }
    if (event.parseError || event.schema === "invalid") {
      evidence.push(runtimeItem("R-02", record, "Runtime trace records a schema parse failure"));
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of evidence) {
    const key = `${item.standardId}:${item.file}:${item.line}:${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return {
    events,
    evidence: unique.slice(0, 40),
    metrics: {
      successRate: outcomes.length ? Number((successes.length / outcomes.length).toFixed(4)) : null,
      latency: latencies.length ? { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) } : null,
      cost: costs.length ? costs.reduce((sum, value) => sum + value, 0) : null,
      toolCalls: toolCallCounts.length ? toolCallCounts.reduce((sum, value) => sum + value, 0) : null,
      failureCategories: categories,
    },
  };
}

export function unzipAvailable() {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
