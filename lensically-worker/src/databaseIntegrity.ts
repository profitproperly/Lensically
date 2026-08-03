export type DatabaseIntegrityExpectation = {
  table: string;
  columns: readonly string[];
};

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const verifiedExpectationsByDatabase = new WeakMap<object, Map<string, Promise<void>>>();

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`database_integrity_invalid_identifier:${value}`);
  }
  return `[${value}]`;
}

function integrityExpectationKey(expectation: DatabaseIntegrityExpectation): string {
  const columns = [...new Set(expectation.columns)].sort();
  return `${expectation.table}:${columns.join(",")}`;
}

export async function assertDatabaseIntegrity(
  db: D1Database,
  expectation: DatabaseIntegrityExpectation,
): Promise<void> {
  const databaseKey = db as unknown as object;
  const expectationKey = integrityExpectationKey(expectation);
  const existingByExpectation = verifiedExpectationsByDatabase.get(databaseKey);
  const existing = existingByExpectation?.get(expectationKey);
  if (existing) return existing;

  const byExpectation = existingByExpectation ?? new Map<string, Promise<void>>();
  if (!existingByExpectation) verifiedExpectationsByDatabase.set(databaseKey, byExpectation);

  const verification = (async () => {
    const table = quoteIdentifier(expectation.table);
    const columns = [...new Set(expectation.columns)].map(quoteIdentifier);
    const projection = columns.length > 0 ? columns.join(", ") : "1";
    try {
      await db.prepare(`SELECT ${projection} FROM ${table} LIMIT 0`).all();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`database_integrity_failed:${expectation.table}:${message}`);
    }
  })();

  byExpectation.set(expectationKey, verification);
  try {
    await verification;
  } catch (error) {
    if (byExpectation.get(expectationKey) === verification) byExpectation.delete(expectationKey);
    if (byExpectation.size === 0) verifiedExpectationsByDatabase.delete(databaseKey);
    throw error;
  }
}

