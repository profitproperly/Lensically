import { describe, expect, it } from "vitest";
import { isOperatorControlStepHeadValidated } from "../src/operatorControlStepValidation";

describe("operator control-step exact-head validation", () => {
  const successfulPush = [{ name: "push-validation", status: "completed", conclusion: "success" }];
  const successfulPreflight = [{ context: "lensically/full-release-preflight", state: "success" }];

  it("accepts a validated fast-mapped head without an optional full-validation status", () => {
    expect(isOperatorControlStepHeadValidated(successfulPush, successfulPreflight)).toBe(true);
  });

  it("fails closed unless both authoritative exact-head signals succeeded", () => {
    expect(isOperatorControlStepHeadValidated([], successfulPreflight)).toBe(false);
    expect(isOperatorControlStepHeadValidated(successfulPush, [])).toBe(false);
    expect(isOperatorControlStepHeadValidated(
      [{ name: "push-validation", status: "completed", conclusion: "failure" }],
      successfulPreflight,
    )).toBe(false);
    expect(isOperatorControlStepHeadValidated(
      successfulPush,
      [{ context: "lensically/full-release-preflight", state: "failure" }],
    )).toBe(false);
  });
});
