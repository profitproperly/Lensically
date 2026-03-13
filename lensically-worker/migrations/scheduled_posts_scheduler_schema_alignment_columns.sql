-- D1/SQLite does not support conditional DDL in SQL migrations for
-- "ALTER TABLE ... ADD COLUMN" based on PRAGMA results. Executing unconditional
-- ADD COLUMN statements is not idempotent and can fail on partially-aligned
-- databases (for example when idempotency_key already exists).
--
-- Runtime schema alignment is handled in the Worker via PRAGMA table_info(...)
-- checks and conditional ALTER TABLE statements.
PRAGMA table_info(scheduled_posts);
