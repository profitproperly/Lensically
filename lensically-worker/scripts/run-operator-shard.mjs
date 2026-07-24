import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shardNumber = Number(process.argv[2]);
const shardCount = Number(process.argv[3] ?? 8);

if (!Number.isInteger(shardNumber) || !Number.isInteger(shardCount) || shardNumber < 1 || shardCount < 1 || shardNumber > shardCount) {
  console.error("Usage: node scripts/run-operator-shard.mjs <shard-number> <shard-count>");
  process.exit(2);
}

const testPath = "test/operatorMode.spec.ts";
const source = readFileSync(resolve(process.cwd(), testPath), "utf8");
const unsupportedModifiers = Array.from(source.matchAll(/\b(?:it|test)\.(?!skip\b)([A-Za-z]+)\s*\(/g), (match) => match[0]);
if (unsupportedModifiers.length > 0) {
  console.error(`Unsupported Operator test modifiers must be assigned explicitly: ${unsupportedModifiers.join(", ")}`);
  process.exit(2);
}

const testDefinitions = [];
const testPattern = /\b(?:it|test)(\.skip)?\(\s*"((?:[^"\\]|\\.)*)"/g;
for (const match of source.matchAll(testPattern)) {
  let title;
  try {
    title = JSON.parse(`"${match[2]}"`);
  } catch {
    console.error(`Unable to decode Operator test title near source offset ${match.index ?? -1}.`);
    process.exit(2);
  }
  testDefinitions.push({ title, skipped: Boolean(match[1]) });
}

const activeDefinitions = testDefinitions.filter((test) => !test.skipped);
if (activeDefinitions.length < 40) {
  console.error(`Operator shard inventory is unexpectedly small: ${activeDefinitions.length} active tests.`);
  process.exit(2);
}

const titleDefinitionCounts = new Map();
for (const test of activeDefinitions) {
  titleDefinitionCounts.set(test.title, (titleDefinitionCounts.get(test.title) ?? 0) + 1);
}

const weightedTitles = Array.from(titleDefinitionCounts, ([title, definitionCount]) => ({ title, definitionCount })).sort(
  (left, right) => right.definitionCount - left.definitionCount || left.title.localeCompare(right.title),
);
const shardAssignments = Array.from({ length: shardCount }, () => ({ definitionCount: 0, titles: [] }));

for (const weightedTitle of weightedTitles) {
  const targetShard = shardAssignments.reduce((best, candidate, index) => {
    if (candidate.definitionCount < best.assignment.definitionCount) return { assignment: candidate, index };
    if (candidate.definitionCount === best.assignment.definitionCount && index < best.index) return { assignment: candidate, index };
    return best;
  }, { assignment: shardAssignments[0], index: 0 });
  targetShard.assignment.titles.push(weightedTitle.title);
  targetShard.assignment.definitionCount += weightedTitle.definitionCount;
}

const assignedTitles = shardAssignments.flatMap((assignment) => assignment.titles);
if (assignedTitles.length !== weightedTitles.length || new Set(assignedTitles).size !== weightedTitles.length) {
  console.error("Operator shard assignment must include every unique active test title exactly once.");
  process.exit(2);
}

const selectedAssignment = shardAssignments[shardNumber - 1];
const selectedTitles = [...selectedAssignment.titles].sort((left, right) => left.localeCompare(right));
if (selectedTitles.length === 0) {
  console.error(`Operator shard ${shardNumber}/${shardCount} has no assigned tests.`);
  process.exit(2);
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, (character) => "\\" + character);
const titlePattern = `(?:${selectedTitles.map(escapeRegex).join("|")})$`;
const selectedDefinitionCount = selectedAssignment.definitionCount;

console.log(`Operator shard ${shardNumber}/${shardCount}: ${selectedDefinitionCount} active tests across ${selectedTitles.length} unique titles.`);
for (const title of selectedTitles) console.log(`- ${title}`);

const result = spawnSync(
  "npm",
  [
    "run",
    "test",
    "--",
    "--run",
    testPath,
    "--reporter=dot",
    "--silent",
    "--no-color",
    "--bail=1",
    `--testNamePattern=${titlePattern}`,
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if ((result.status ?? 1) !== 0) {
  const failureOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(-3000);
  const annotation = failureOutput
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
  console.error(`::error title=Operator shard ${shardNumber}/${shardCount} failed::${annotation}`);
}

process.exit(result.status ?? 1);
