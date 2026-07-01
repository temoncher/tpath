import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseLocaleDir = path.join(rootDir, "public", "translations", "en");
const outputDir = path.join(rootDir, "src", "__translationMocks__");

type JsonRecord = Readonly<Record<string, string>>;

interface NestedMessages {
  [key: string]: string | NestedMessages;
}

async function main() {
  const files = (await readdir(baseLocaleDir)).filter((file) => file.endsWith(".json")).sort();

  await Promise.all(
    files.map(async (file) => {
      const flat = JSON.parse(await readFile(path.join(baseLocaleDir, file), "utf8")) as JsonRecord;
      const nested = nestMessages(flat);
      const componentName = path.basename(file, ".json");
      const output = `export default ${formatValue(nested)} as const;\n`;

      await writeFile(path.join(outputDir, `${componentName}.gen.ts`), output);
    }),
  );
}

function nestMessages(flat: JsonRecord): NestedMessages {
  const nested: NestedMessages = {};

  for (const [flatKey, message] of Object.entries(flat)) {
    const keys = flatKey.split(".");
    let current = nested;

    for (const [index, key] of keys.entries()) {
      if (index === keys.length - 1) {
        current[key] = message;
        continue;
      }

      const existing = current[key];

      if (typeof existing === "string") {
        throw new Error(`Cannot nest ${flatKey}; ${keys.slice(0, index + 1).join(".")} is a leaf`);
      }

      current = existing ?? (current[key] = {});
    }
  }

  return nested;
}

function formatValue(value: string | NestedMessages, indent = 0): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  const padding = " ".repeat(indent);
  const childPadding = " ".repeat(indent + 2);
  const entries = Object.entries(value)
    .map(([key, child]) => `${childPadding}${formatKey(key)}: ${formatValue(child, indent + 2)},`)
    .join("\n");

  return `{\n${entries}\n${padding}}`;
}

function formatKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

await main();
