import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sidebar = readFileSync(resolve(root, "components/sidebar.tsx"), "utf8");
const page = readFileSync(resolve(root, "app/(internal)/source-cards/page.tsx"), "utf8");
const prefetch = readFileSync(resolve(root, "lib/routeDataPrefetch.ts"), "utf8");

const sourceCardsIndex = sidebar.indexOf('{ href: "/source-cards", label: "Source Cards" }');
const savedPatternsIndex = sidebar.indexOf('{ href: "/saved-patterns", label: "Saved Patterns" }');
assert(sourceCardsIndex >= 0, "Source Cards sidebar route is missing");
assert(savedPatternsIndex >= 0, "Saved Patterns sidebar route is missing");
assert(sourceCardsIndex < savedPatternsIndex, "Source Cards must appear above Saved Patterns");

for (const required of [
  "/api/source-cards/list",
  "/api/source-cards/create",
  "/api/source-cards/guidance",
  "Create and Lock Source Card",
  "Page {page} of {totalPages}",
  "All Versions",
  "Current Only",
]) {
  assert(page.includes(required), `Source Cards UI contract is missing: ${required}`);
}

assert(page.includes("source_origin"), "Source-card origin must be visible");
assert(page.includes("family_id"), "Exact source-card family lineage must be visible");
assert(prefetch.includes('"/source-cards"'), "Source Cards must participate in account profile preloading");

console.log(JSON.stringify({
  status: "passed",
  contract: "source-cards-ui-v1",
  pagination: true,
  owner_creation: true,
  exact_lineage_visible: true,
}));
