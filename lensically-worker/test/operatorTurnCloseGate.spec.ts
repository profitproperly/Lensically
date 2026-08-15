import { describe, expect, it } from "vitest";
import {
  OPERATOR_TURN_CLOSE_GATE_VERSION,
  evaluateOperatorTurnCloseGate,
} from "../src/operatorTurnCloseGate";

describe("Operator turn close gate", () => {
  it("forces repair mode for unresolved failures and active interrupts", () => {
    expect(evaluateOperatorTurnCloseGate({ unresolved_failure: true })).toMatchObject({
      version: OPERATOR_TURN_CLOSE_GATE_VERSION,
      mode: "repair",
      must_continue: true,
      normal_turn_close_allowed: false,
      reason: "unresolved_failure_requires_repair",
    });
    expect(evaluateOperatorTurnCloseGate({ active_interrupt_key: "blocking-repair" })).toMatchObject({
      mode: "repair",
      must_continue: true,
      normal_turn_close_allowed: false,
      active_interrupt: true,
      active_interrupt_key: "blocking-repair",
    });
  });

  it("forbids normal turn closure while a reachable next action exists", () => {
    expect(evaluateOperatorTurnCloseGate({ reachable_next_action: true })).toMatchObject({
      mode: "continue",
      must_continue: true,
      normal_turn_close_allowed: false,
      reason: "reachable_next_action_exists",
    });
  });

  it("allows a bounded turn close only for owner-only action, external wait, or true terminality", () => {
    expect(evaluateOperatorTurnCloseGate({ owner_action_required: true })).toMatchObject({
      mode: "owner_required",
      must_continue: false,
      normal_turn_close_allowed: true,
    });
    expect(evaluateOperatorTurnCloseGate({ external_wait: true })).toMatchObject({
      mode: "external_wait",
      must_continue: false,
      normal_turn_close_allowed: true,
    });
    expect(evaluateOperatorTurnCloseGate({ objective_complete: true })).toMatchObject({
      mode: "terminal",
      must_continue: false,
      normal_turn_close_allowed: true,
      reason: "objective_complete_no_reachable_next_action",
    });
  });

  it("fails closed when terminality is not proven and gives repair precedence over every close reason", () => {
    expect(evaluateOperatorTurnCloseGate()).toMatchObject({
      mode: "continue",
      must_continue: true,
      normal_turn_close_allowed: false,
      reason: "terminality_not_proven",
    });
    expect(evaluateOperatorTurnCloseGate({
      unresolved_failure: true,
      owner_action_required: true,
      external_wait: true,
      objective_complete: true,
    })).toMatchObject({
      mode: "repair",
      must_continue: true,
      normal_turn_close_allowed: false,
    });
  });
});
