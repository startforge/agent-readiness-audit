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

function countStatus(findings, status) {
  return findings.filter((item) => item.status === status).length;
}

function shortNote(item) {
  const text = item.rationale || item.remediation || "";
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

function evidenceList(item) {
  const items = item.evidence ?? [];
  if (!items.length) return "<p class='muted'>No evidence recorded.</p>";
  return `<ul class="evidence">${items
    .map((entry) => {
      const loc = entry.file ? `${esc(entry.file)}${entry.line ? `:${esc(entry.line)}` : ""}` : "—";
      const href = entry.file ? `#file-${esc(entry.file)}` : "";
      const locHtml = href ? `<a href="${href}" data-file="${esc(entry.file)}">${loc}</a>` : loc;
      return `<li><span class="mono">${esc(entry.type ?? "code")}</span> ${locHtml}${entry.reason ? ` — ${esc(entry.reason)}` : ""}</li>`;
    })
    .join("")}</ul>`;
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
  const path = fileMap.criticalPath ?? report.structure?.criticalPath ?? {};
  const title = `${esc(heading)} — ${esc(report.target ?? "")}`;
  const release = report.release?.status ?? "—";
  const failCount = countStatus(findings, "fail");
  const partialCount = countStatus(findings, "partial");
  const unknownCount = countStatus(findings, "unknown");
  const passCount = countStatus(findings, "pass");
  const layerIds = [...new Set(layers.map((layer) => layer.id).filter(Boolean))];

  const layerCards = layers
    .map(
      (layer) => `<section class="layer" data-layer="${esc(layer.id)}">
        <h3>${esc(layer.id)} <span class="count">${esc(layer.files.length)}</span></h3>
        <ul>${layer.files.map((file) => `<li><a href="#file-${esc(file)}" data-file="${esc(file)}">${esc(file)}</a></li>`).join("")}</ul>
      </section>`,
    )
    .join("");

  const fileRows = files
    .map(
      (item) => `<tr id="file-${esc(item.file)}" class="file-row" data-layer="${esc(item.layer)}" data-search="${esc([item.file, item.layer, item.kind, ...(item.roles ?? []), ...(item.functions ?? []), ...(item.standards ?? [])].join(" ").toLowerCase())}">
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
    .map((edge) => `<tr class="edge-row" data-search="${esc([edge.kind, edge.from, edge.to, edge.label ?? ""].join(" ").toLowerCase())}"><td>${esc(edge.kind)}</td><td>${esc(edge.from)}</td><td>${esc(edge.to)}</td><td>${esc(edge.label ?? "")}</td></tr>`)
    .join("");

  const findingRows = findings
    .map((item) => {
      const search = [item.id, item.status, item.risk, item.confidence, item.rationale, item.remediation, item.evidence?.[0]?.file]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const loc = item.evidence?.[0] ? `${item.evidence[0].file}:${item.evidence[0].line}` : "—";
      const locHtml =
        item.evidence?.[0]?.file
          ? `<a href="#file-${esc(item.evidence[0].file)}" data-file="${esc(item.evidence[0].file)}">${esc(loc)}</a>`
          : "—";
      return `<tr class="finding ${statusClass(item.status)}" data-status="${esc(item.status)}" data-search="${esc(search)}" tabindex="0">
        <td class="mono">${esc(item.id)}</td>
        <td><span class="pill">${esc(item.status)}</span></td>
        <td>${esc(item.risk)}</td>
        <td>${esc(item.confidence)}</td>
        <td>${locHtml}</td>
        <td class="notes">${esc(shortNote(item) || "—")}</td>
      </tr>
      <tr class="finding-detail" hidden>
        <td colspan="6">
          ${item.rationale ? `<p><strong>Rationale.</strong> ${esc(item.rationale)}</p>` : ""}
          ${item.remediation ? `<p><strong>Remediation.</strong> ${esc(item.remediation)}</p>` : ""}
          ${evidenceList(item)}
        </td>
      </tr>`;
    })
    .join("");

  const layerFilters = layerIds
    .map((id) => `<button type="button" class="chip" data-layer-filter="${esc(id)}">${esc(id)}</button>`)
    .join("");

  const findingsSection = `<section id="findings" class="block">
      <div class="block-head">
        <h2>Findings</h2>
        <p class="hint">Click a row to open notes. Filter by status or search.</p>
      </div>
      <div class="toolbar">
        <div class="chips" role="tablist" aria-label="Finding status">
          <button type="button" class="chip" data-status-filter="all" aria-pressed="true">All ${esc(findings.length)}</button>
          <button type="button" class="chip" data-status-filter="fail">Fail ${esc(failCount)}</button>
          <button type="button" class="chip" data-status-filter="partial">Partial ${esc(partialCount)}</button>
          <button type="button" class="chip" data-status-filter="unknown">Unknown ${esc(unknownCount)}</button>
          <button type="button" class="chip" data-status-filter="pass">Pass ${esc(passCount)}</button>
        </div>
        <label class="search">
          <span>Search</span>
          <input type="search" id="findings-search" placeholder="ID, file, note">
        </label>
      </div>
      <div class="table-wrap">
        <table id="findings-table">
          <thead><tr><th>ID</th><th>Status</th><th>Risk</th><th>Confidence</th><th>Evidence</th><th>Notes</th></tr></thead>
          <tbody>${findingRows || "<tr><td colspan='6'>No findings</td></tr>"}</tbody>
        </table>
      </div>
    </section>`;

  const mapSection = `<section id="hierarchy" class="block">
      <div class="block-head">
        <h2>Hierarchy</h2>
        <p class="hint">Jump from a layer into the file mapping.</p>
      </div>
      <div class="layers">${layerCards || "<p class='muted'>No layers recorded.</p>"}</div>
    </section>
    <section id="mapping" class="block">
      <div class="block-head">
        <h2>File mapping</h2>
      </div>
      <div class="toolbar">
        <div class="chips" role="tablist" aria-label="File layer">
          <button type="button" class="chip" data-layer-filter="all" aria-pressed="true">All ${esc(files.length)}</button>
          ${layerFilters}
        </div>
        <label class="search">
          <span>Search</span>
          <input type="search" id="files-search" placeholder="File, role, standard">
        </label>
      </div>
      <div class="table-wrap">
        <table id="files-table">
          <thead><tr><th>File</th><th>Layer</th><th>Kind</th><th>Roles</th><th>Functions</th><th>Standards</th><th>Scan</th></tr></thead>
          <tbody>${fileRows || "<tr><td colspan='7'>No files</td></tr>"}</tbody>
        </table>
      </div>
    </section>
    <section id="relationships" class="block">
      <div class="block-head">
        <h2>Relationships</h2>
      </div>
      <div class="table-wrap">
        <table id="edges-table">
          <thead><tr><th>Kind</th><th>From</th><th>To</th><th>Label</th></tr></thead>
          <tbody>${edgeRows || "<tr><td colspan='4'>No edges</td></tr>"}</tbody>
        </table>
      </div>
    </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
  <style>
    :root {
      --paper: oklch(0.955 0.018 92);
      --paper-deep: oklch(0.925 0.022 88);
      --ink: oklch(0.28 0.032 155);
      --muted: oklch(0.48 0.024 150);
      --rule: oklch(0.78 0.028 90);
      --stamp: oklch(0.46 0.14 28);
      --forest: oklch(0.34 0.048 155);
      --ochre: oklch(0.55 0.1 70);
      --display: "Instrument Serif", "Iowan Old Style", Palatino, serif;
      --text: "Source Serif 4", "Iowan Old Style", Palatino, serif;
      --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper-deep);
      font: 16px/1.5 var(--text);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.4;
      background-image: radial-gradient(oklch(0.4 0.02 90 / 0.09) 0.6px, transparent 0.7px);
      background-size: 3px 3px;
    }
    .sheet {
      position: relative;
      max-width: 1080px;
      margin: 0 auto;
      background: var(--paper);
      min-height: 100vh;
      box-shadow: 0 0 0 1px oklch(0.7 0.03 90 / 0.35);
    }
    .masthead {
      position: sticky;
      top: 0;
      z-index: 8;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.65rem 1.25rem;
      padding: 0.7rem 1.4rem;
      background: var(--paper);
      border-bottom: 1px solid var(--ink);
    }
    .mark {
      font-family: var(--mono);
      font-size: 0.72rem;
      letter-spacing: 0.16em;
      color: var(--stamp);
      text-decoration: none;
    }
    nav { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }
    nav a { color: var(--ink); text-decoration: none; border-bottom: 1px solid transparent; }
    nav a:hover { border-bottom-color: var(--ink); }
    header, main { padding: 1.25rem 1.4rem; }
    header { padding-top: 1.6rem; padding-bottom: 0.4rem; }
    h1, h2, h3 { font-family: var(--display); font-weight: 400; letter-spacing: -0.02em; }
    h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); margin: 0 0 0.85rem; }
    h2 { font-size: 1.35rem; margin: 0; padding-bottom: 0.3rem; border-bottom: 0.5px solid var(--rule); }
    h3 { font-size: 0.78rem; margin: 0 0 0.45rem; font-family: var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .lede, .meta, .hint, .muted { color: var(--muted); }
    .meta { margin: 0.2rem 0; font-family: var(--mono); font-size: 0.75rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 0.75rem 1rem;
      margin: 1rem 0 0.4rem;
      padding: 0.85rem 0;
      border-top: 1.5px solid var(--ink);
      border-bottom: 0.5px solid var(--ink);
    }
    .stats div { display: flex; flex-direction: column; gap: 0.15rem; }
    .stats dt { font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .stats dd { margin: 0; font-family: var(--display); font-size: 1.15rem; }
    .release-blocked { color: var(--stamp); }
    .release-conditional { color: var(--ochre); }
    .release-ready-for-pilot { color: var(--forest); }
    .path { margin: 1rem 0 0; padding: 0.7rem 0 0; font-size: 0.95rem; }
    .path span { font-family: var(--mono); font-size: 0.78rem; }
    .block { padding: 1.5rem 0 0.4rem; }
    .block-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem 1rem; margin-bottom: 0.85rem; }
    .hint { margin: 0; font-size: 0.88rem; font-style: italic; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.65rem 1rem; margin-bottom: 0.75rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      appearance: none;
      margin: 0;
      padding: 0.22rem 0.55rem;
      border: 0.5px solid var(--ink);
      border-radius: 0;
      background: transparent;
      color: var(--ink);
      font-family: var(--mono);
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .chip[aria-pressed="true"] { background: var(--forest); color: var(--paper); border-color: var(--forest); }
    .search { display: flex; align-items: center; gap: 0.45rem; font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    .search input {
      width: 14rem;
      max-width: 48vw;
      padding: 0.28rem 0.45rem;
      border: 0.5px solid var(--rule);
      border-radius: 0;
      background: var(--paper-deep);
      color: var(--ink);
      font: 0.82rem/1.3 var(--mono);
    }
    .layers { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .layer { border: 0.5px solid var(--rule); padding: 0.7rem 0.8rem; background: var(--paper-deep); }
    .layer ul { margin: 0; padding-left: 1rem; }
    .layer a { color: var(--ink); }
    .count { color: var(--stamp); }
    .table-wrap { overflow-x: auto; border: 0.5px solid var(--rule); }
    table { width: 100%; border-collapse: collapse; background: var(--paper); }
    th, td { border-bottom: 0.5px solid var(--rule); padding: 0.45rem 0.55rem; text-align: left; vertical-align: top; font-size: 0.88rem; }
    th {
      position: sticky;
      top: 2.6rem;
      background: var(--paper);
      font-family: var(--mono);
      font-size: 0.68rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .mono { font-family: var(--mono); font-size: 0.8rem; }
    .finding { cursor: pointer; }
    .finding:hover, .file-row.is-active { background: oklch(0.34 0.048 155 / 0.06); }
    .finding-detail td { background: var(--paper-deep); font-size: 0.9rem; }
    .finding-detail p { margin: 0 0 0.5rem; }
    .evidence { margin: 0; padding-left: 1.1rem; }
    .pill { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.02em; }
    tr.status-fail .pill { color: var(--stamp); }
    tr.status-partial .pill { color: var(--ochre); }
    tr.status-unknown .pill { color: var(--muted); }
    tr.status-pass .pill { color: var(--forest); }
    tr.is-hidden,
    tr.finding-detail[hidden],
    tr.finding.is-hidden + tr.finding-detail { display: none !important; }
    a { color: var(--ink); }
    @media (max-width: 720px) {
      .masthead, header, main { padding-left: 1rem; padding-right: 1rem; }
      .search input { width: 100%; max-width: none; }
      .toolbar { align-items: stretch; flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="masthead">
      <a class="mark" href="#top">AFR</a>
      <nav>
        <a href="#findings">Findings</a>
        <a href="#hierarchy">Hierarchy</a>
        <a href="#mapping">Mapping</a>
        <a href="#relationships">Relationships</a>
      </nav>
    </div>
    <header id="top">
      <h1>${esc(heading)}</h1>
      <p class="meta">Project: ${esc(report.target ?? "")}</p>
      <p class="meta">Scanned: ${esc(report.scannedAt ?? "")} · Profiles: ${esc((report.profiles ?? []).join(", ") || "—")}</p>
      <dl class="stats">
        <div><dt>Release</dt><dd class="release-${esc(release)}">${esc(release)}</dd></div>
        <div><dt>Critical</dt><dd>${esc(report.release?.criticalCount ?? 0)}</dd></div>
        <div><dt>High</dt><dd>${esc(report.release?.highCount ?? 0)}</dd></div>
        <div><dt>Findings</dt><dd>${esc(findings.length)}</dd></div>
      </dl>
      <p class="path">Critical path: <span>${esc(path.function || "n/a")}${path.steps?.length ? ` (${esc(path.steps.join(" → "))})` : ""}</span></p>
    </header>
    <main>
      ${findingsFirst ? `${findingsSection}${mapSection}` : `${mapSection}${findingsSection}`}
    </main>
  </div>
  <script>
    (function () {
      function bindFilter(buttons, apply) {
        buttons.forEach(function (button) {
          button.addEventListener("click", function () {
            buttons.forEach(function (item) { item.setAttribute("aria-pressed", "false"); });
            button.setAttribute("aria-pressed", "true");
            apply();
          });
        });
      }
      function selected(buttons, attr) {
        var active = Array.prototype.find.call(buttons, function (item) { return item.getAttribute("aria-pressed") === "true"; });
        return active ? active.getAttribute(attr) : "all";
      }
      function textOf(value) {
        return (value || "").toLowerCase();
      }

      var statusButtons = document.querySelectorAll("[data-status-filter]");
      var findingsSearch = document.getElementById("findings-search");
      function filterFindings() {
        var status = selected(statusButtons, "data-status-filter") || "all";
        var query = textOf(findingsSearch && findingsSearch.value);
        document.querySelectorAll("#findings-table tr.finding").forEach(function (row) {
          var matchStatus = status === "all" || row.getAttribute("data-status") === status;
          var matchQuery = !query || (row.getAttribute("data-search") || "").indexOf(query) !== -1;
          var hide = !(matchStatus && matchQuery);
          row.classList.toggle("is-hidden", hide);
          var detail = row.nextElementSibling;
          if (detail && detail.classList.contains("finding-detail") && hide) detail.hidden = true;
        });
      }
      bindFilter(statusButtons, filterFindings);
      if (findingsSearch) findingsSearch.addEventListener("input", filterFindings);

      document.querySelectorAll("#findings-table tr.finding").forEach(function (row) {
        function toggle() {
          var detail = row.nextElementSibling;
          if (!detail || !detail.classList.contains("finding-detail")) return;
          detail.hidden = !detail.hidden;
        }
        row.addEventListener("click", function (event) {
          if (event.target.closest("a")) return;
          toggle();
        });
        row.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        });
      });

      var layerButtons = document.querySelectorAll("#mapping [data-layer-filter]");
      var filesSearch = document.getElementById("files-search");
      function filterFiles() {
        var layer = selected(layerButtons, "data-layer-filter") || "all";
        var query = textOf(filesSearch && filesSearch.value);
        document.querySelectorAll("#files-table tr.file-row").forEach(function (row) {
          var matchLayer = layer === "all" || row.getAttribute("data-layer") === layer;
          var matchQuery = !query || (row.getAttribute("data-search") || "").indexOf(query) !== -1;
          row.classList.toggle("is-hidden", !(matchLayer && matchQuery));
        });
      }
      bindFilter(layerButtons, filterFiles);
      if (filesSearch) filesSearch.addEventListener("input", filterFiles);

      function highlightFile(file) {
        document.querySelectorAll(".file-row.is-active").forEach(function (row) { row.classList.remove("is-active"); });
        var target = document.getElementById("file-" + file);
        if (!target) return;
        target.classList.remove("is-hidden");
        target.classList.add("is-active");
        target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      document.querySelectorAll("a[data-file]").forEach(function (link) {
        link.addEventListener("click", function () {
          highlightFile(link.getAttribute("data-file"));
        });
      });
    }());
  </script>
</body>
</html>
`;
}
