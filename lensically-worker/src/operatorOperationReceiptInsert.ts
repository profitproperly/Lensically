export const OPERATOR_OPERATION_RECEIPT_INSERT_SQL = `INSERT OR IGNORE INTO operator_operation_receipts (
  idempotency_key, brand_key, workflow_session_id, operation_type, tool_name, request_fingerprint, status
) VALUES (?, ?, ?, ?, ?, ?, 'started')
RETURNING idempotency_key`;

export function operatorOperationReceiptInsertCreated(
  inserted: { idempotency_key?: unknown } | null | undefined,
  expectedKey: string,
): boolean {
  return String(inserted?.idempotency_key ?? "") === expectedKey;
}
