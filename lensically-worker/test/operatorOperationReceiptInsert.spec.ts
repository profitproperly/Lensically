import { describe, expect, it } from "vitest";
import {
  OPERATOR_OPERATION_RECEIPT_INSERT_SQL,
  operatorOperationReceiptInsertCreated,
} from "../src/operatorOperationReceiptInsert";

describe("operator operation receipt insert contract", () => {
  it("uses SQLite returning instead of driver change metadata", () => {
    expect(OPERATOR_OPERATION_RECEIPT_INSERT_SQL).toContain("INSERT OR IGNORE");
    expect(OPERATOR_OPERATION_RECEIPT_INSERT_SQL).toContain("RETURNING idempotency_key");
  });

  it("claims ownership only when the inserted key matches exactly", () => {
    expect(operatorOperationReceiptInsertCreated({ idempotency_key: "key-1" }, "key-1")).toBe(true);
    expect(operatorOperationReceiptInsertCreated({ idempotency_key: "key-2" }, "key-1")).toBe(false);
    expect(operatorOperationReceiptInsertCreated(null, "key-1")).toBe(false);
  });
});
