import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { openApiDocument } from "../src/core/openapi/document.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const outputFile = resolve(currentDirectory, "../../../docs/openapi.json");
const content = `${JSON.stringify(openApiDocument, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing = await readFile(outputFile, "utf8").catch(() => undefined);

  if (existing !== content) {
    console.error("OpenAPI document is out of date. Run: pnpm api:openapi");
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, content, "utf8");
  console.log(`OpenAPI document written to ${outputFile}`);
}
