import { spawnSync } from "node:child_process";
import { join } from "node:path";

const scopes = {
  smoke: [
    "auto-arms the scheduled-post alarm only on the configured canonical Worker host",
    "routes operational status and engineering intents deterministically away from content procedures",
  ],
  analytics: [
    "monthly growth",
    "post metrics",
    "post performance",
    "performance learning",
    "follower",
    "Insights",
  ],
  scheduler: [
    "scheduled-post",
    "scheduler",
    "hourly coverage",
    "canary",
    "overdue",
    "alarm",
  ],
  content: [
    "source card",
    "source candidate",
    "source selection",
    "generation",
    "draft",
    "review batch",
    "saved pattern",
    "gate",
  ],
  accounts: [
    "key handshake",
    "Proceed",
    "account",
    "continuity",
    "authorization",
    "startup",
  ],
    engineering: [
    "engineering",
    "repository",
    "deployment",
    "MCP",
    "mcp",
    "router",
    "tool surface",
  ],
      acceptance: [
    "makes the static router the only public action path",
    "lists only the active static MCP registry and concise instructions",
    "builds one complete non-mutating Execution Kernel capability campaign",
    "routes bounded known-file repository search through the main Execution Kernel without Recovery",
    "rejects an MCP session created by a previous Worker deployment before routing",
    "builds compact Main atomic patch sets and rejects oversized combinations",
    "returns the mandatory client-safety receipt for every startup response",
  ],
  "system-directory": null,
  full: null,
};

const scope = process.argv[2]?.trim().toLowerCase();
if (!scope || !(scope in scopes)) {
  console.error(`Unknown validation scope: ${scope ?? "<missing>"}`);
  console.error(`Allowed scopes: ${Object.keys(scopes).join(", ")}`);
  process.exit(2);
}

const args = [
  "run",
  "test",
  "--",
    "--run",
        scope === "system-directory" ? "test/systemDirectory.spec.ts" : "test/operatorMode.spec.ts",
  "--reporter=dot",
  "--bail=1",
];

const terms = scopes[scope];
if (terms) {
  const pattern = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  args.push(`--testNamePattern=${pattern}`);
}

console.log(`Operator validation scope: ${scope}`);
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmArgs = process.platform === "win32"
  ? [join(process.execPath.replace(/\\node\.exe$/i, ""), "node_modules", "npm", "bin", "npm-cli.js"), ...args]
  : args;
const result = spawnSync(npmCommand, npmArgs, {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
