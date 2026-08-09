import { describe, expect, it } from "vitest";
import {
  evaluateOperatorReleaseAuthority,
  type OperatorReleaseAuthorityRow,
} from "../src/operatorReleaseAuthority";

const authority = (sha: string): OperatorReleaseAuthorityRow => ({
  authority_id: "production",
  expected_release_sha: sha,
  previous_release_sha: null,
  release_id: null,
  state: "active",
  source: "test",
  updated_at: "2026-08-09 00:00:00",
});

describe("Operator release authority", () => {
  it("allows bootstrap and matching runtime commits", () => {
    expect(evaluateOperatorReleaseAuthority({
      toolName: "get_account_state",
      executingSha: "196edd6bfbe32a99834c1930aa56cd7f0c471522",
      authority: null,
    }).allowed).toBe(true);

    expect(evaluateOperatorReleaseAuthority({
      toolName: "get_account_state",
      executingSha: "196EDD6BFBE32A99834C1930AA56CD7F0C471522",
      authority: authority("196edd6bfbe32a99834c1930aa56cd7f0c471522"),
    })).toMatchObject({ allowed: true, error: null, release_control_exempt: false });
  });

  it("blocks stale normal tools but preserves release-repair tools", () => {
    const shared = authority("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(evaluateOperatorReleaseAuthority({
      toolName: "get_account_state",
      executingSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      authority: shared,
    })).toMatchObject({
      allowed: false,
      error: "stale_operator_runtime_release",
      expected_release_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      executing_release_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      release_control_exempt: false,
    });

    expect(evaluateOperatorReleaseAuthority({
      toolName: "getGitHubWorkflowRun",
      executingSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      authority: shared,
    })).toMatchObject({ allowed: true, release_control_exempt: true });
  });
});
