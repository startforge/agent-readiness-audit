function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status) {
  return `status-${esc(status)}`;
}

export function renderReportHtml(fileMap, report = {}) {
  return renderReviewHtml(fileMap, report, { heading: "Agent review report", findingsFirst: true });
}

export function renderMapHtml(fileMap, report = {}) {
  return renderReviewHtml(fileMap, report, { heading: "Agent review map" });
}

function renderReviewHtml(fileMap, report = {}, { heading, findingsFirst = false } = {}) {
  const layers = fileMap.layers ?? [];
  const files = fileMap.files ?? [];
  const edges = fileMap.edges ?? [];
  const findings = (report.findings ?? []).filter((item) => item.status !== "not-applicable");
  const path = fileMap.criticalPath ?? {};
  const title = `${esc(heading)} — ${esc(report.target ?? "")}`;

  const layerCards = layers
    .map(
      (layer) => `<section class="layer">
        <h3>${esc(layer.id)}</h3>
        <ul>${layer.files.map((file) => `<li><a href="#file-${esc(file)}">${esc(file)}</a></li>`).join("")}</ul>
      </section>`,
    )
    .join("");

  const fileRows = files
    .map(
      (item) => `<tr id="file-${esc(item.file)}">
        <td>${esc(item.file)}</td>
        <td>${esc(item.layer)}</td>
        <td>${esc(item.kind)}</td>
        <td>${esc((item.roles ?? []).join(", ") || "—")}</td>
        <td>${esc((item.functions ?? []).join(", ") || "—")}</td>
        <td>${esc((item.standards ?? []).join(", ") || "—")}</td>
        <td>${item.reused ? "reused" : "scanned"}</td>
      </tr>`,
    )
    .join("");

  const edgeRows = edges
    .map((edge) => `<tr><td>${esc(edge.kind)}</td><td>${esc(edge.from)}</td><td>${esc(edge.to)}</td><td>${esc(edge.label ?? "")}</td></tr>`)
    .join("");

  const findingRows = findings
    .map(
      (item) => `<tr class="${statusClass(item.status)}">
        <td>${esc(item.id)}</td>
        <td>${esc(item.status)}</td>
        <td>${esc(item.risk)}</td>
        <td>${esc(item.confidence)}</td>
        <td>${esc(item.evidence?.[0] ? `${item.evidence[0].file}:${item.evidence[0].line}` : "—")}</td>
        <td>${esc(item.rationale || item.remediation || "")}</td>
      </tr>`,
    )
    .join("");

  const findingsSection = `<h2>Findings</h2>
    <table>
      <thead><tr><th>ID</th><th>Status</th><th>Risk</th><th>Confidence</th><th>Evidence</th><th>Notes</th></tr></thead>
      <tbody>${findingRows || "<tr><td colspan='6'>No findings</td></tr>"}</tbody>
    </table>`;
  const mapSection = `<h2>Hierarchy</h2>
    <div class="layers">${layerCards || "<p>No layers recorded.</p>"}</div>
    <h2>File mapping</h2>
    <table>
      <thead><tr><th>File</th><th>Layer</th><th>Kind</th><th>Roles</th><th>Functions</th><th>Standards</th><th>Scan</th></tr></thead>
      <tbody>${fileRows || "<tr><td colspan='7'>No files</td></tr>"}</tbody>
    </table>
    <h2>Relationships</h2>
    <table>
      <thead><tr><th>Kind</th><th>From</th><th>To</th><th>Label</th></tr></thead>
      <tbody>${edgeRows || "<tr><td colspan='4'>No edges</td></tr>"}</tbody>
    </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; --border: #c9cdd3; --muted: #5c6570; --bg: #f6f7f9; --card: #fff; }
    @media (prefers-color-scheme: dark) {
      :root { --border: #3d4450; --muted: #9aa3ad; --bg: #16181d; --card: #1e2229; }
    }
    body { font: 15px/1.45 system-ui, sans-serif; margin: 0; background: var(--bg); color: inherit; }
    header, main { max-width: 1100px; margin: 0 auto; padding: 1.25rem 1.5rem; }
    header { padding-top: 2rem; }
    h1 { font-size: 1.6rem; margin: 0 0 0.35rem; }
    .meta { color: var(--muted); margin: 0.2rem 0; }
    .layers { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin: 1rem 0 2rem; }
    .layer { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; }
    .layer h3 { margin: 0 0 0.5rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .layer ul { margin: 0; padding-left: 1.1rem; }
    table { width: 100%; border-collapse: collapse; background: var(--card); margin: 0 0 2rem; }
    th, td { border: 1px solid var(--border); padding: 0.45rem 0.6rem; text-align: left; vertical-align: top; font-size: 0.92rem; }
    th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
    tr.status-fail td:nth-child(2) { color: #b42318; font-weight: 600; }
    tr.status-partial td:nth-child(2) { color: #b54708; font-weight: 600; }
    tr.status-pass td:nth-child(2) { color: #027a48; font-weight: 600; }
    .path { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(heading)}</h1>
    <p class="meta">Project: ${esc(report.target ?? "")}</p>
    <p class="meta">Scanned: ${esc(report.scannedAt ?? "")} · Release: ${esc(report.release?.status ?? "")} · Critical: ${esc(report.release?.criticalCount ?? 0)} · High: ${esc(report.release?.highCount ?? 0)} · Profiles: ${esc((report.profiles ?? []).join(", "))}</p>
    <p class="meta">Critical path: ${esc(path.function || "n/a")} ${path.steps?.length ? `(${esc(path.steps.join(" → "))})` : ""}</p>
  </header>
  <main>
    ${findingsFirst ? `${findingsSection}${mapSection}` : `${mapSection}${findingsSection}`}
  </main>
</body>
</html>
`;
}
