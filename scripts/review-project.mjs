import { writeFileSync } from "node:fs";
import { parseArgs, reviewProject, USAGE } from "../lib/review.mjs";
import { toMarkdown } from "../lib/report.mjs";
import { ciExitCode, toSarif } from "../lib/sarif.mjs";

const args = parseArgs(process.argv);
if (args.help || !args.target) {
  console.log(USAGE);
  process.exit(args.help ? 0 : 1);
}

const report = reviewProject(args.target, {
  profiles: args.profiles,
  executeTests: args.executeTests,
  compare: args.compare,
});

let rendered;
if (args.format === "json") rendered = `${JSON.stringify(report, null, 2)}\n`;
else if (args.format === "sarif") rendered = `${JSON.stringify(toSarif(report), null, 2)}\n`;
else rendered = toMarkdown(report);

if (args.output) writeFileSync(args.output, rendered);
process.stdout.write(rendered);

if (args.ci) {
  process.exit(ciExitCode(report, { failOn: args.failOn, blockNewCritical: true }, report.comparison));
}
