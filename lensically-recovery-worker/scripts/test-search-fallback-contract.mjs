import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

assert.match(source, /const limit = Math\.min\(50, Math\.max\(1, Number\(args\.limit \|\| 20\)\)\);/);
assert.match(source, /if \(codeSearchItems\.length > 0\)/);
assert.match(source, /search_mode: "bounded_tree_content_fallback"/);
assert.match(source, /error: "search_incomplete_no_match"/);
assert.match(source, /candidate_files_scanned: scanCap/);
assert.match(source, /const scanCap = Math\.min\(candidatePaths\.length, 12\);/);
assert.match(source, /depth\(left\) - depth\(right\)/);
assert.match(source, /error: "repo_file_not_found"/);
assert.match(source, /error: file\.error \|\| "repo_file_unavailable"/);
const searchBranchStart = source.indexOf('if (name === "searchRepoFiles") {');
const searchBranchEnd = source.indexOf('if (name === "applyRepoTextPatch") {', searchBranchStart);
assert.ok(searchBranchStart >= 0 && searchBranchEnd > searchBranchStart, "searchRepoFiles implementation block must be present");
const searchBranch = source.slice(searchBranchStart, searchBranchEnd);
assert.ok(
  searchBranch.indexOf("if (codeSearchItems.length > 0)") < searchBranch.indexOf("const tree = await github"),
  "tree/content fallback must remain reachable when GitHub code search returns zero items",
);

console.log("Recovery search fallback contract: PASS");
