import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const srcDir = path.resolve("src");

describe("translation bundle boundary", () => {
  test("keeps generated message values out of real app modules", async () => {
    const offenders: string[] = [];

    for (const file of await sourceFiles(srcDir)) {
      if (!isRealAppModule(file)) {
        continue;
      }

      const source = await readFile(file, "utf8");

      if (/import\s+(?!type\b)[^;]*from\s+["'][^"']+\.gen["']/.test(source)) {
        offenders.push(path.relative(srcDir, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

async function sourceFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(fullPath);
      }

      return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") ? [fullPath] : [];
    }),
  );

  return files.flat();
}

function isRealAppModule(file: string) {
  return (
    !file.endsWith(".gen.ts") &&
    !file.endsWith(".test.ts") &&
    !file.endsWith(".test.tsx") &&
    !file.endsWith(".test-d.ts") &&
    !file.endsWith(".stories.tsx") &&
    !file.includes(`${path.sep}test${path.sep}`)
  );
}
