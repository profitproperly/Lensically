import { spawnSync } from "node:child_process";

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
    "builds compact Main atomic patch sets and rejects oversized combinations",
        "uses Main compact activity after the first workflow status read",
    "uses one terminal watch after the compact activity read",
    "keeps bounded large repository patch sets on the Main gateway",
        "returns the mandatory client-safety receipt for every startup response",
    "uses runtime verification after the first startup call",
    "keeps new clients profile-only while routing cached gateway schemas",
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
    ["system-directory", "acceptance"].includes(scope) ? "test/systemDirectory.spec.ts" : "test/operatorMode.spec.ts",
  "--reporter=dot",
  "--bail=1",
];

const terms = scopes[scope];
if (terms) {
  const pattern = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  args.push(`--testNamePattern=${pattern}`);
}

console.log(`Operator validation scope: ${scope}`);
const result = spawnSync("npm", args, {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
