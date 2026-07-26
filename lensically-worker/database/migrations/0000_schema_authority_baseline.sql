CREATE TABLE IF NOT EXISTS lensically_schema_authority (
  authority_key TEXT PRIMARY KEY,
  authority_version TEXT NOT NULL,
  authority_status TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO lensically_schema_authority (
  authority_key,
  authority_version,
  authority_status,
  updated_at
) VALUES (
  'canonical',
  'lensically-database-authority-v1',
  'active',
  CURRENT_TIMESTAMP
)
ON CONFLICT(authority_key) DO UPDATE SET
  authority_version = excluded.authority_version,
  authority_status = excluded.authority_status,
  updated_at = CURRENT_TIMESTAMP;
