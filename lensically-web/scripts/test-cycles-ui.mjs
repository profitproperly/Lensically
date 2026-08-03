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
assert.match(page, /How source selection works/, "Cycles must include a visible plain-English source-selection glossary");
assert.equal(manifest.cycles_contract, "unified-source-ranking-v2", "Deployed web manifest must identify the unified source-ranking contract");

assert.match(page, /Exact source-card family/, "Glossary must define the exact Saved Pattern lineage scope");
assert.match(page, /Unified rating/, "Cycles must explain and display the unified rating");
assert.match(page, /Lifecycle:/, "Cycle badges must expose the single lifecycle vocabulary");
assert.match(page, /Lane:/, "Cycle badges must expose Exploit, Develop, or Explore");
assert.match(page, /No cooldown penalty/, "Glossary must state that winners are not suppressed by a cooldown");
assert.doesNotMatch(page, /Proven mechanism, untested source/, "Cycles must not introduce a mechanism-family ranking layer");
assert.doesNotMatch(page, /Recent label/, "Cycles must not expose the retired Hot or Cooling classification system");
assert.doesNotMatch(page, /72-hour cooldown/, "Cycles must not describe the retired hard cooldown as active");
assert.doesNotMatch(page, /Source allocation:/, "Cycles must not expose the ambiguous Source allocation badge wording");
assert.doesNotMatch(page, /Exact-source status:/, "Cycles must not expose a competing audition-status badge");
assert.doesNotMatch(page, /\bCompare\b/, "Cycles must not include a Compare surface");

assert.doesNotMatch(page, /dropdown|submenu|chevron/i, "Cycles must not introduce dropdown behavior");
console.log("cycles_ui_contract_tests_passed");
