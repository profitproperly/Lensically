export type DatabaseIntegrityExpectation = {
  table: string;
  columns: readonly string[];
};

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`database_integrity_invalid_identifier:${value}`);
  }
  return `[${value}]`;
}

export async function assertDatabaseIntegrity(
  db: D1Database,
  expectation: DatabaseIntegrityExpectation,
): Promise<void> {
  const table = quoteIdentifier(expectation.table);
  const columns = [...new Set(expectation.columns)].map(quoteIdentifier);
  const projection = columns.length > 0 ? columns.join(", ") : "1";
  try {
    await db.prepare(`SELECT ${projection} FROM ${table} LIMIT 0`).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`database_integrity_failed:${expectation.table}:${message}`);
  }
}
