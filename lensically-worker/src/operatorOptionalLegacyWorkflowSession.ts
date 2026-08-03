export async function readOptionalLegacyWorkflowSession<T>(
  readSession: () => Promise<T | null>,
): Promise<T | null> {
  try {
    return await readSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table:\s*operator_workflow_sessions/i.test(message)) return null;
    throw error;
  }
}
