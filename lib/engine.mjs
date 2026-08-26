function applicable(standard, profiles, capabilities) {
  if (!profiles.includes(standard.profile)) {
    return { ok: false, status: "not-applicable", rationale: `Profile '${standard.profile}' is not enabled.` };
  }
  if (standard.applicability === "hasTools" && !capabilities.hasTools) {
    return { ok: false, status: "not-applicable", rationale: "No callable tools or external side effects were detected." };
  }
  if (standard.applicability === "hasDangerousActions" && !capabilities.hasDangerousActions) {
    return {
      ok: false,
      status: "not-applicable",
      rationale: "No deletion, payment, publishing, or messaging actions were detected in production code.",
    };
  }
  return { ok: true };
}

export function confidenceFor(evidence, { structural = false } = {}) {
  const types = new Set(evidence.filter((item) => item.type !== "documentation").map((item) => item.type));
  if (types.has("runtime")) return "high";
  if (structural && types.has("test")) return "high";
  if (types.has("code") && types.has("test")) return "medium";
  if (types.has("code") && types.has("configuration")) return "medium";
  if (types.has("test")) return "medium";
  if (types.has("code") || types.has("configuration")) return "low";
  return "low";
}

function finding(standard, fields) {
  return {
    id: standard.id,
    status: fields.status,
    risk: standard.risk,
    confidence: fields.confidence ?? "low",
    checkStrategy: standard.checkStrategy,
    requirement: standard.requirement,
    evidence: fields.evidence ?? [],
    rationale: fields.rationale ?? "",
    remediation: fields.status === "pass" || fields.status === "not-applicable" ? "" : standard.remediation,
    acceptanceCriteria: standard.acceptance,
    profile: standard.profile,
  };
}

export function structuralResult(standard, structure = {}) {
  if (standard.id === "T-02") return { pass: Boolean(structure.t02?.gated), fail: Boolean(structure.t02?.bypass) };
  if (standard.id === "T-03") return { pass: Boolean(structure.t03?.gated), fail: Boolean(structure.t03?.bypass) };
  if (standard.id === "R-02") return { pass: Boolean(structure.r02?.validated), fail: Boolean(structure.r02?.bypass) };
  if (standard.id === "R-03") return { pass: Boolean(structure.r03?.guarded), fail: Boolean(structure.r03?.bypass) };
  if (standard.id === "O-03") return { pass: Boolean(structure.o03?.redacted), fail: Boolean(structure.o03?.leak) };
  return { pass: false, fail: false };
}

export function evaluateStandard(standard, evidence, context) {
  const { profiles, capabilities, structure = {} } = context;
  const scope = applicable(standard, profiles, capabilities);
  if (!scope.ok) {
    return finding(standard, { status: scope.status, rationale: scope.rationale, evidence: [], confidence: "high" });
  }

  const implementation = evidence.filter((item) => item.type !== "documentation");
  const documentation = evidence.filter((item) => item.type === "documentation");
  const types = new Set(implementation.map((item) => item.type));
  const hasCode = types.has("code") || types.has("configuration");
  const hasTest = types.has("test");
  const hasRuntime = types.has("runtime");
  const struct = structuralResult(standard, structure);
  const conf = confidenceFor(implementation, { structural: struct.pass });

  if (struct.fail) {
    const bucket = { "T-02": structure.t02, "T-03": structure.t03, "R-02": structure.r02, "R-03": structure.r03, "O-03": structure.o03 }[standard.id];
    const extra = bucket?.bypass?.evidence ?? bucket?.leak?.evidence;
    return finding(standard, {
      status: "fail",
      confidence: "medium",
      evidence: unique([extra, ...implementation].filter(Boolean)),
      rationale: bucket?.bypass?.reason || bucket?.leak?.reason || "A bypass or leak path was confirmed by structural analysis.",
    });
  }

  if (implementation.length === 0) {
    if (documentation.length > 0) {
      return finding(standard, {
        status: "unknown",
        confidence: "low",
        evidence: documentation,
        rationale: "Documentation describes this capability, but documentation cannot independently produce a pass.",
      });
    }
    if (standard.missingMeans === "fail") {
      return finding(standard, {
        status: "fail",
        confidence: "medium",
        evidence: [],
        rationale: "Required capability is applicable but no implementation evidence was found.",
      });
    }
    return finding(standard, {
      status: "unknown",
      confidence: "low",
      evidence: [],
      rationale: "Insufficient evidence to determine the outcome; missing keywords are not treated as a confirmed failure.",
    });
  }

  if (standard.criticalPass === "structural+verified" || standard.requiresStructural) {
    if (struct.pass && (hasTest || hasRuntime)) {
      return finding(standard, {
        status: "pass",
        confidence: "high",
        evidence: implementation,
        rationale: hasRuntime
          ? "Structural call-chain evidence is backed by runtime traces."
          : "Structural call-chain evidence is backed by tests. Keyword matches alone are not sufficient.",
      });
    }
    if (struct.pass) {
      return finding(standard, {
        status: "partial",
        confidence: conf,
        evidence: implementation,
        rationale: "Structural implementation exists, but tests or runtime traces are still required for a pass.",
      });
    }
    return finding(standard, {
      status: "partial",
      confidence: conf,
      evidence: implementation,
      rationale: "Candidate implementation exists, but High/Critical items cannot pass from keyword matches without structural or runtime evidence.",
    });
  }

  if (hasRuntime) {
    return finding(standard, {
      status: "pass",
      confidence: "high",
      evidence: implementation,
      rationale: "Runtime evidence supports the requirement.",
    });
  }
  if (standard.testSufficient && hasTest) {
    return finding(standard, {
      status: "pass",
      confidence: "medium",
      evidence: implementation,
      rationale: "A repeatable test or evaluation file is present.",
    });
  }
  if (hasCode && hasTest && (standard.passWithCodeAndTest || standard.risk === "Medium")) {
    return finding(standard, {
      status: "pass",
      confidence: "medium",
      evidence: implementation,
      rationale: "Production code and tests support the requirement.",
    });
  }
  if (hasCode && hasTest) {
    return finding(standard, {
      status: "partial",
      confidence: "medium",
      evidence: implementation,
      rationale: "Code and tests exist; High items still need structural analysis or runtime evidence for a pass.",
    });
  }
  if (hasCode || hasTest) {
    return finding(standard, {
      status: "partial",
      confidence: conf,
      evidence: implementation,
      rationale: "Implementation evidence is incomplete: tests or production code are missing, and runtime traces were not imported.",
    });
  }
  return finding(standard, {
    status: "unknown",
    confidence: "low",
    evidence: implementation,
    rationale: "Insufficient evidence to determine the outcome.",
  });
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.type}:${item.file}:${item.line}:${item.reason ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function evaluateAll(standards, evidenceById, context) {
  return standards.map((standard) => evaluateStandard(standard, evidenceById[standard.id] ?? [], context));
}
