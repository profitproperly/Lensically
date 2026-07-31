-- lensically-migration-class: schema
-- lensically-migration-owner: release-engineering
-- lensically-migration-risk: low

-- Lossless bounded storage for Main-scale immutable Manifest Innovation seed packages.

CREATE TABLE IF NOT EXISTS manifest_shadow_frozen_seed_chunks (
  id TEXT PRIMARY KEY,
  seed_id TEXT NOT NULL,
  payload_kind TEXT NOT NULL CHECK (payload_kind IN ('source_candidates', 'evidence')),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seed_id, payload_kind, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_manifest_shadow_frozen_seed_chunks_read
  ON manifest_shadow_frozen_seed_chunks(seed_id, payload_kind, chunk_index);
