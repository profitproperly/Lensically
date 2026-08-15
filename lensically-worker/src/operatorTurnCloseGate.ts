export const OPERATOR_TURN_CLOSE_GATE_VERSION = "operator-turn-close-gate-v1";

export type OperatorTurnCloseMode = "continue" | "repair" | "owner_required" | "external_wait" | "terminal";

export type OperatorTurnCloseGateInput = {
  unresolved_failure?: boolean;
  active_interrupt?: boolean;
  reachable_next_action?: boolean;
  owner_action_required?: boolean;
  external_wait?: boolean;
  objective_complete?: boolean;
  active_interrupt_key?: string | null;
};

export type OperatorTurnCloseGate = {
  version: typeof OPERATOR_TURN_CLOSE_GATE_VERSION;
  mode: OperatorTurnCloseMode;
  must_continue: boolean;
  normal_turn_close_allowed: boolean;
  reason: string;
  unresolved_failure: boolean;
  active_interrupt: boolean;
  reachable_next_action: boolean;
  owner_action_required: boolean;
  external_wait: boolean;
  objective_complete: boolean;
  active_interrupt_key: string | null;
};

export function evaluateOperatorTurnCloseGate(input: OperatorTurnCloseGateInput = {}): OperatorTurnCloseGate {
  const unresolvedFailure = input.unresolved_failure === true;
  const activeInterrupt = input.active_interrupt === true || Boolean(input.active_interrupt_key?.trim());
  const reachableNextAction = input.reachable_next_action === true;
  const ownerActionRequired = input.owner_action_required === true;
  const externalWait = input.external_wait === true;
  const objectiveComplete = input.objective_complete === true;
  const activeInterruptKey = input.active_interrupt_key?.trim() || null;

  const finish = (
    mode: OperatorTurnCloseMode,
    mustContinue: boolean,
    reason: string,
  ): OperatorTurnCloseGate => ({
    version: OPERATOR_TURN_CLOSE_GATE_VERSION,
    mode,
    must_continue: mustContinue,
    normal_turn_close_allowed: !mustContinue,
    reason,
    unresolved_failure: unresolvedFailure,
    active_interrupt: activeInterrupt,
    reachable_next_action: reachableNextAction,
    owner_action_required: ownerActionRequired,
    external_wait: externalWait,
    objective_complete: objectiveComplete,
    active_interrupt_key: activeInterruptKey,
  });

  if (unresolvedFailure || activeInterrupt) {
    return finish("repair", true, activeInterrupt ? "active_interrupt_requires_repair" : "unresolved_failure_requires_repair");
  }
  if (ownerActionRequired) {
    return finish("owner_required", false, "protected_owner_action_required");
  }
  if (externalWait) {
    return finish("external_wait", false, "verified_external_dependency_has_no_reachable_step");
  }
  if (reachableNextAction) {
    return finish("continue", true, "reachable_next_action_exists");
  }
  if (objectiveComplete) {
    return finish("terminal", false, "objective_complete_no_reachable_next_action");
  }
  return finish("continue", true, "terminality_not_proven");
}
