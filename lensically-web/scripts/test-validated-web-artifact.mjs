import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  WEB_ARTIFACT_ARCHIVE,
  packageValidatedWebArtifact,
  restoreValidatedWebArtifact,
  validateArchiveEntries,
} from "./validated-web-artifact.mjs";

const sourceSha = "1234567890abcdef1234567890abcdef12345678";
const tempRoot = mkdtempSync(join(tmpdir(), "lensically-web-artifact-"));
const appRoot = join(tempRoot, "web");
const artifactDir = join(tempRoot, "artifact");

try {
  mkdirSync(join(appRoot, ".open-next", "assets"), { recursive: true });
  writeFileSync(join(appRoot, ".open-next", "worker.js"), "export default {};\n", "utf8");
  writeFileSync(join(appRoot, ".open-next", "assets", "asset.txt"), "validated\n", "utf8");
  writeFileSync(join(appRoot, "package-lock.json"), "{\"lockfileVersion\":3}\n", "utf8");

  const packaged = packageValidatedWebArtifact({ appRoot, outputDir: artifactDir, sourceSha });
  assert.equal(packaged.source_sha, sourceSha);
  assert.equal(packaged.contract, "lensically-validated-web-artifact-v1");
  assert.ok(packaged.size_bytes > 0);

  rmSync(join(appRoot, ".open-next"), { recursive: true, force: true });
  const restored = restoreValidatedWebArtifact({ appRoot, inputDir: artifactDir, expectedSha: sourceSha });
  assert.equal(restored.sha256, packaged.sha256);
  assert.equal(existsSync(join(appRoot, ".open-next", "worker.js")), true);
  assert.equal(existsSync(join(appRoot, ".open-next", "assets", "asset.txt")), true);

  assert.throws(
    () => restoreValidatedWebArtifact({
      appRoot,
      inputDir: artifactDir,
      expectedSha: "abcdef1234567890abcdef1234567890abcdef12",
    }),
    /web_artifact_source_sha_mismatch/,
  );

  appendFileSync(join(artifactDir, WEB_ARTIFACT_ARCHIVE), "tampered", "utf8");
  assert.throws(
    () => restoreValidatedWebArtifact({ appRoot, inputDir: artifactDir, expectedSha: sourceSha }),
    /web_artifact_size_mismatch|web_artifact_digest_mismatch/,
  );

  assert.throws(() => validateArchiveEntries(["../escape"]), /web_artifact_unsafe_entry/);
  assert.throws(() => validateArchiveEntries(["other-root/file"]), /web_artifact_unexpected_root/);
  console.log("validated_web_artifact_tests_passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
