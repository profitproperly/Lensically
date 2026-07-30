import { describe, expect, it } from "vitest";
import { validateRepositoryPatchContent } from "../src/operatorRepositoryPatchSafety";

describe("operatorRepositoryPatchSafety", () => {
  it("rejects an over-indented GitHub Actions step before repository commit", () => {
    const result = validateRepositoryPatchContent(
      ".github/workflows/lensically-engineering.yml",
      "jobs:\n  release:\n    steps:\n            - name: Broken step\n              run: echo no\n",
    );
    expect(result).toEqual({
      ok: false,
      error: "github_workflow_step_indentation_invalid",
      line_numbers: [4],
    });
  });

  it("accepts a correctly indented GitHub Actions step", () => {
    expect(validateRepositoryPatchContent(
      ".github/workflows/lensically-engineering.yml",
      "jobs:\n  release:\n    steps:\n      - name: Valid step\n        run: echo yes\n",
    )).toEqual({ ok: true });
  });

  it("rejects tab indentation in YAML and ignores non-YAML files", () => {
    expect(validateRepositoryPatchContent("config.yml", "\tname: invalid\n")).toEqual({
      ok: false,
      error: "yaml_tab_indentation_forbidden",
      line_numbers: [1],
    });
    expect(validateRepositoryPatchContent("src/example.ts", "\tconst value = 1;\n")).toEqual({ ok: true });
  });
});
