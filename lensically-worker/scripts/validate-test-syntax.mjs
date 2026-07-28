import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();
const testRoot = path.join(root, "test");
const files = [];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath);
      continue;
    }
    if (/\.(?:test|spec)\.tsx?$/.test(entry.name)) files.push(fullPath);
  }
}

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:test|spec)\.tsx?$/.test(entry.name)) {
    files.push(path.join(root, entry.name));
  }
}
await collect(testRoot);
files.sort();

const failures = [];
for (const file of files) {
  try {
    const source = await readFile(file, "utf8");
    await transform(source, {
      loader: file.endsWith(".tsx") ? "tsx" : "ts",
      format: "esm",
      target: "es2022",
      sourcefile: path.relative(root, file),
      sourcemap: false,
    });
  } catch (error) {
    failures.push({ file: path.relative(root, file), error });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[test-syntax] ${failure.file}`);
    console.error(failure.error);
  }
  throw new Error(`test_syntax_invalid:${failures.map((failure) => failure.file).join("|")}`);
}

console.log(`[test-syntax] ${files.length} test files parsed successfully`);
