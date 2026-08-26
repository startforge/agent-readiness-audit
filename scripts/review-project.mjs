import { writeFileSync } from "node:fs";
import { parseArgs, reviewProject, USAGE } from "../lib/review.mjs";
import { toMarkdown } from "../lib/report.mjs";
import { ciExitCode, toSarif } from "../lib/sarif.mjs";
import { loadReceipt, buildReceiptFromReport, writeArtifacts, resolveArtifactsDir } from "../lib/artifacts.mjs";

const args = parseArgs(process.argv);
if (args.help || !args.target) {
  console.log(USAGE);
  process.exit(args.help ? 0 : 1);
}

const artifactsDir = resolveArtifactsDir(args, args.target);
const receipt = args.full ? null : loadReceipt(args.fromReceipt ?? artifactsDir);
const report = reviewProject(args.target, {
  profiles: args.profiles,
  executeTests: args.executeTests,
  compare: args.compare,
  receipt,
  full: args.full,
});

if (artifactsDir) {
  const written = writeArtifacts(artifactsDir, {
    report,
    receipt: buildReceiptFromReport(report),
    fileMap: report.fileMap,
  });
  process.stderr.write(`Wrote review bundle to ${written.directory}\n`);
}

let rendered;
if (args.format === "json") rendered = `${JSON.stringify(report, null, 2)}\n`;
else if (args.format === "sarif") rendered = `${JSON.stringify(toSarif(report), null, 2)}\n`;
else rendered = toMarkdown(report);

if (args.output) writeFileSync(args.output, rendered);
process.stdout.write(rendered);

if (args.ci) {
  process.exit(ciExitCode(report, { failOn: args.failOn, blockNewCritical: true }, report.comparison));
}
