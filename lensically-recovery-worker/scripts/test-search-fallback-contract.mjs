import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

assert.match(source, /const limit = Math\.min\(50, Math\.max\(1, Number\(args\.limit \|\| 20\)\)\);/);
assert.match(source, /if \(codeSearchItems\.length > 0\)/);
assert.match(source, /search_mode: "bounded_tree_content_fallback"/);
assert.match(source, /error: "search_incomplete_no_match"/);
assert.match(source, /candidate_files_scanned: scanCap/);
assert.ok(
  source.indexOf("if (codeSearchItems.length > 0)") < source.indexOf("const tree = await github"),
  "tree/content fallback must remain reachable when GitHub code search returns zero items",
);

console.log("Recovery search fallback contract: PASS");
