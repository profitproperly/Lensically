import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/mbrain-delta-writer.config.json", import.meta.url), "utf8"));
const script = readFileSync(new URL("./mbrain-delta-writer.mjs", import.meta.url), "utf8");

assert.equal(config.version, "mbrain-delta-writer-v1");
assert.equal(config.canonical_project_state_path, "/M-BRAIN/PROJECTS/LENSICALLY/01_STATE.md");
assert.equal(config.canonical_system_contract_path, "/M-BRAIN/SYSTEMS/DURABLE_DELTA_WRITER.md");
assert.ok(config.required_project_state_phrases.includes("LOM callable certification is complete-live-verified"));
assert.ok(config.forbidden_stale_phrases.includes("Do not resume the deferred white-label parity job first."));
assert.ok(script.includes("buildProjectState"), "writer must build project state payload");
assert.ok(script.includes("buildSystemContract"), "writer must build system contract payload");
assert.ok(script.includes("mbrain_delta_stale_phrase_present"), "writer must reject stale content");
assert.ok(script.includes("writeFileSync(outboxPath"), "writer must produce an outbox");

console.log("mbrain_delta_writer_contract_ok");
