const IDENTITY_TYPES = ["email", "google", "github", "discord"];
const IDENTITY_TYPE_SET = new Set(IDENTITY_TYPES);
const DELETION_TOMBSTONE_RETENTION_DAYS = 7;
const DELETION_TOMBSTONE_RETENTION_MS = DELETION_TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function normalizeEmail(email) {
  if (typeof email !== "string") {
    return "";
  }
  return email.trim().toLowerCase();
}

function normalizeIdentity(type, value) {
  if (!IDENTITY_TYPE_SET.has(type)) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (type === "email") {
    const normalizedEmail = normalizeEmail(trimmedValue);
    return normalizedEmail || null;
  }

  return trimmedValue;
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

export async function ensureIdentityControlTables(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS account_deletion_tombstones (
      id TEXT PRIMARY KEY,
      identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'google', 'github', 'discord')),
      identity_value TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )`,
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_tombstones_identity_expires
     ON account_deletion_tombstones (identity_type, identity_value, expires_at)`,
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS banned_identities (
      id TEXT PRIMARY KEY,
      identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'google', 'github', 'discord')),
      identity_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      created_by TEXT
    )`,
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_banned_identity_expires
     ON banned_identities (identity_type, identity_value, expires_at)`,
  ).run();
}

export async function isIdentityBanned(db, identityType, identityValue, nowMs = Date.now()) {
  const normalizedValue = normalizeIdentity(identityType, identityValue);
  if (!normalizedValue) {
    return false;
  }

  await ensureIdentityControlTables(db);

  const row = await db.prepare(
    `SELECT id
     FROM banned_identities
     WHERE identity_type = ?
       AND identity_value = ?
       AND (expires_at IS NULL OR expires_at > ?)
     LIMIT 1`,
  )
    .bind(identityType, normalizedValue, toIso(nowMs))
    .first();

  return Boolean(row?.id);
}

export async function isIdentityTombstoned(db, identityType, identityValue, nowMs = Date.now()) {
  const normalizedValue = normalizeIdentity(identityType, identityValue);
  if (!normalizedValue) {
    return false;
  }

  await ensureIdentityControlTables(db);

  const row = await db.prepare(
    `SELECT id
     FROM account_deletion_tombstones
     WHERE identity_type = ?
       AND identity_value = ?
       AND expires_at > ?
     LIMIT 1`,
  )
    .bind(identityType, normalizedValue, toIso(nowMs))
    .first();

  return Boolean(row?.id);
}

export async function evaluateIdentityAccess(db, identities, nowMs = Date.now()) {
  const normalizedIdentities = [];
  const seen = new Set();

  for (const identity of identities) {
    const type = identity?.type;
    const value = identity?.value;
    const normalizedValue = normalizeIdentity(type, value);
    if (!normalizedValue) {
      continue;
    }

    const key = `${type}:${normalizedValue}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalizedIdentities.push({ type, value: normalizedValue });
  }

  for (const identity of normalizedIdentities) {
    if (await isIdentityBanned(db, identity.type, identity.value, nowMs)) {
      return { allowed: false, reason: "banned", identity };
    }
  }

  for (const identity of normalizedIdentities) {
    if (await isIdentityTombstoned(db, identity.type, identity.value, nowMs)) {
      return { allowed: false, reason: "tombstone", identity };
    }
  }

  return { allowed: true };
}

export async function createDeletionTombstones(db, {
  email,
  oauthIdentities = [],
}, nowMs = Date.now()) {
  await ensureIdentityControlTables(db);

  const createdAt = toIso(nowMs);
  const expiresAt = toIso(nowMs + DELETION_TOMBSTONE_RETENTION_MS);
  const identities = [];
  const seen = new Set();

  const normalizedEmail = normalizeIdentity("email", email);
  if (normalizedEmail) {
    const emailKey = `email:${normalizedEmail}`;
    seen.add(emailKey);
    identities.push({ type: "email", value: normalizedEmail });
  }

  for (const oauthIdentity of oauthIdentities) {
    const provider = oauthIdentity?.provider;
    const providerUserId = oauthIdentity?.provider_user_id;
    const normalizedProviderUserId = normalizeIdentity(provider, providerUserId);
    if (!normalizedProviderUserId) {
      continue;
    }

    const key = `${provider}:${normalizedProviderUserId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    identities.push({ type: provider, value: normalizedProviderUserId });
  }

  for (const identity of identities) {
    await db.prepare(
      `INSERT INTO account_deletion_tombstones (
        id, identity_type, identity_value, created_at, expires_at
      )
      VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), identity.type, identity.value, createdAt, expiresAt)
      .run();
  }
}

export {
  DELETION_TOMBSTONE_RETENTION_DAYS,
};
