import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sidebar = readFileSync(join(root, "components", "sidebar.tsx"), "utf8");
const page = readFileSync(join(root, "app", "(internal)", "cycles", "page.tsx"), "utf8");

assert.equal((sidebar.match(/href:\s*"\/cycles"/g) ?? []).length, 1, "Cycles must appear exactly once in sidebar navigation");
assert.match(
  sidebar,
  /href:\s*"\/dashboard"[\s\S]*?href:\s*"\/cycles"[\s\S]*?href:\s*"\/insights"/,
  "Cycles must sit directly beneath Dashboard",
);
assert.doesNotMatch(sidebar, /Cycles[^\n]*(?:children|submenu|dropdown|chevron)/i, "Cycles must not be a dropdown or nested menu");

assert.match(page, /useState<Rail>\("main"\)/, "Cycles must default to Main");
assert.match(page, /\["main",\s*"innovation"\]/, "Main and Innovation must be an in-page two-state switch");
assert.match(page, /href:\s*never/, "impossible sentinel");
