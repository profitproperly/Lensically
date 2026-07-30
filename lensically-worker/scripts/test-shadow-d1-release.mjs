#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  SHADOW_DATABASE_BINDING,
  SHADOW_DATABASE_NAME,
  SHADOW_MIGRATIONS_TABLE,
  injectShadowDatabaseBinding,
  selectShadowDatabaseId,
  verifyShadowBinding,
} from "./shadow-d1-release.mjs";

assert.equal(
  selectShadowDatabaseId([{ name: SHADOW_DATABASE_NAME, uuid: "shadow-id" }]),
  "shadow-id",
);
assert.equal(
  selectShadowDatabaseId({ result: [{ database_name: SHADOW_DATABASE_NAME, id: "shadow-id-2" }] }),
  "shadow-id-2",
);
assert.equal(selectShadowDatabaseId([{ name: "other", uuid: "no" }]), null);

const source = {
  name: "lensically-worker",
  d1_databases: [{
    binding: "DB",
    database_name: "lensically-db",
    database_id: "production-id",
    migrations_dir: "database/migrations",
    migrations_table: "lensically_d1_migrations",
  }],
};
const updated = injectShadowDatabaseBinding(source, "shadow-id");
assert.equal(updated.d1_databases.length, 2);
const shadow = updated.d1_databases.find((entry) => entry.binding === SHADOW_DATABASE_BINDING);
assert.deepEqual(shadow, {
  binding: SHADOW_DATABASE_BINDING,
  database_name: SHADOW_DATABASE_NAME,
  database_id: "shadow-id",
  migrations_dir: "database/migrations",
  migrations_table: SHADOW_MIGRATIONS_TABLE,
});
assert.equal(verifyShadowBinding(updated), true);

assert.throws(
  () => verifyShadowBinding({
    ...source,
    d1_databases: [
      ...source.d1_databases,
      {
        binding: SHADOW_DATABASE_BINDING,
        database_name: SHADOW_DATABASE_NAME,
        database_id: "production-id",
        migrations_dir: "database/migrations",
        migrations_table: SHADOW_MIGRATIONS_TABLE,
      },
    ],
  }),
  /shadow_d1_physical_isolation_failed/,
);

assert.throws(
  () => verifyShadowBinding({
    ...source,
    d1_databases: [
      ...source.d1_databases,
      {
        binding: SHADOW_DATABASE_BINDING,
        database_name: SHADOW_DATABASE_NAME,
        database_id: "shadow-id",
        migrations_dir: "shadow/migrations",
        migrations_table: SHADOW_MIGRATIONS_TABLE,
      },
    ],
  }),
  /shadow_d1_migration_directory_drift/,
);

process.stdout.write("shadow-d1-release tests passed\n");
