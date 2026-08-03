import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sidebar = readFileSync(join(root, "components", "sidebar.tsx"), "utf8");
const page = readFileSync(join(root, "app", "(internal)", "cycles", "page.tsx"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "public", "site.webmanifest"), "utf8"));


assert.equal((sidebar.match(/href:\s*"\/cycles"/g) ?? []).length, 1, "Cycles must appear exactly once in sidebar navigation");
assert.match(
  sidebar,
  /href:\s*"\/dashboard"[\s\S]*?href:\s*"\/cycles"[\s\S]*?href:\s*"\/insights"/,
  "Cycles must sit directly beneath Dashboard",
);
assert.doesNotMatch(sidebar, /Cycles[^\n]*(?:children|submenu|dropdown|chevron)/i, "Cycles must not be a dropdown or nested menu");

assert.match(page, /useState<Rail>\("main"\)/, "Cycles must default to Main");
assert.match(page, /\["main",\s*"innovation"\]/, "Main and Innovation must be an in-page two-state switch");
assert.match(page, /\/api\/cycles\/state/, "Cycles must read canonical rail state");
assert.match(page, /\/api\/cycles\/history/, "Cycles must use server-paginated history");
assert.match(page, /\/api\/cycles\/selections/, "Cycles must read compact persisted selections");
assert.match(page, /\/api\/cycles\/selection-detail/, "Full selection detail must load on demand");
assert.match(page, /Show all/, "Cycle details must start compact and expose Show all");
assert.match(page, /toggleSelectionDetail/, "Selection details must be expansion-driven");
assert.match(page, /Scheduled output and source evidence/, "Main Cycle must separate scheduled output from source evidence");
assert.match(page, /Source used:/, "Main Cycle rows must identify the locked source separately");
assert.match(page, /How to read this page/, "Cycles must include a visible plain-English glossary");
assert.equal(manifest.cycles_contract, "cycles-glossary-v1", "Deployed web manifest must identify the Cycles glossary contract");

assert.match(page, /Proven mechanism, untested source/, "Glossary must explain mechanism and exact-source scope separately");
assert.match(page, /Selection lane:/, "Cycle badges must use plain-English selection-lane wording");
assert.match(page, /Exact-source status:/, "Cycle badges must identify exact-source scope explicitly");
assert.doesNotMatch(page, /Source allocation:/, "Cycles must not expose the ambiguous Source allocation badge wording");
assert.doesNotMatch(page, /<KeyValue label="Family state"/, "Exact-source status must not be presented as broad family performance");
assert.doesNotMatch(page, /\bCompare\b/, "Cycles must not include a Compare surface");

assert.doesNotMatch(page, /dropdown|submenu|chevron/i, "Cycles must not introduce dropdown behavior");
console.log("cycles_ui_contract_tests_passed");
