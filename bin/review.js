import { readFile } from "node:fs/promises";
import { inspectAnswer } from "../extension/core/inspect.js";
import { buildRecoveryPrompt } from "../extension/core/recovery.js";

const [filename, option, ...rest] = process.argv.slice(2);
const usage = "Usage: node bin/review.js <input.json> [--recovery]";

if (filename === "--help" && !option) {
  console.log(usage);
} else if (!filename || (option && option !== "--recovery") || rest.length) {
  console.error(usage);
  process.exitCode = 1;
} else {
  try {
    const input = JSON.parse(await readFile(filename, "utf8"));
    const result = inspectAnswer(input);
    const output = option === "--recovery"
      ? { ...result, recoveryPrompt: buildRecoveryPrompt({ ...input, findings: result.findings }) }
      : result;
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error(error instanceof SyntaxError ? "Input file must contain valid JSON." : error.message);
    process.exitCode = 1;
  }
}
