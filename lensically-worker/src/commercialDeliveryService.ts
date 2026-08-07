const STRIPE_API_ORIGIN = "https://api.stripe.com/v1";
const GITHUB_API_ORIGIN = "https://api.github.com";

export const COMMERCIAL_PRODUCT_KEY = "lensically_operator_threads";
export const COMMERCIAL_PRODUCT_RELEASE = "v1.0.0";
export const COMMERCIAL_PRODUCT_PRICE_ID = "price_1U04xK4dwsz5Id6rMBTw8Nbx";
export const COMMERCIAL_PAYMENT_LINK_ID = "plink_1U04xX4dwsz5Id6r1mYvbYr0";
export const COMMERCIAL_EMBEDDED_CHECKOUT_MARKER = "embedded_checkout_v1";
export const COMMERCIAL_PRODUCT_AMOUNT = 99_700;
export const COMMERCIAL_PRODUCT_CURRENCY = "usd";
export const COMMERCIAL_RELEASE_REPOSITORY = "Lensically-Operator-Threads";
export const COMMERCIAL_RELEASE_ASSET = "Lensically-Operator-Threads-v1.0.0.zip";
export const COMMERCIAL_RELEASE_SHA256 = "d8d8df30de3e81c19872599a5c8b8ecec996adce14017781dc5d4ab3d8f0d979";

const DOWNLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_DOWNLOADS_PER_PURCHASE = 5;

export interface CommercialDeliveryEnv {
  DB: D1Database;
  LENSICALLY_STRIPE_KEY?: string;
  LENSICALLY_STRIPE_PUBLISHABLE_KEY?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  ROOT_SITE_URL?: string;
}

type JsonRecord = Record<string, unknown>;

type CommercialCheckoutValidation =
  | {
      ok: true;
      sessionId: string;
      paymentIntentId: string | null;
      customerEmail: string | null;
      customerName: string | null;
      amountTotal: number;
      currency: string;
            checkoutCreatedAt: number | null;
      checkoutSourceId: string;
    }
  | { ok: false; error: string };

type CommercialOrderRow = {
  session_id: string;
  license_key: string;
  customer_email: string | null;
  customer_name: string | null;
  download_count: number | string;
};

type CommercialDownloadTokenRow = {
  token_hash: string;
  session_id: string;
  expires_at: string;
  used_at: string | null;
  download_count: number | string;
};

function jsonResponse(payload: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store, private",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function sanitizeStripeError(payload: unknown): JsonRecord {
  const error = asRecord(asRecord(payload)?.error);
  return {
    type: stringValue(error?.type, 120),
    code: stringValue(error?.code, 120),
    param: stringValue(error?.param, 120),
    message: stringValue(error?.message, 300),
  };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringValue(value: unknown, maxLength = 1000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function integerValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function expandableId(value: unknown): string | null {
  if (typeof value === "string") return stringValue(value, 255);
  const record = asRecord(value);
  return record ? stringValue(record.id, 255) : null;
}

function timingSafeTextEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function validateCommercialCheckoutSessionPayload(payload: unknown): CommercialCheckoutValidation {
  const session = asRecord(payload);
  if (!session) return { ok: false, error: "invalid_checkout_session" };

  const sessionId = stringValue(session.id, 255);
  if (!sessionId || !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    return { ok: false, error: "invalid_checkout_session_id" };
  }

  if (stringValue(session.payment_status, 40) !== "paid") {
    return { ok: false, error: "checkout_not_paid" };
  }
  if (stringValue(session.status, 40) !== "complete") {
    return { ok: false, error: "checkout_not_complete" };
  }

  const amountTotal = integerValue(session.amount_total);
  const currency = stringValue(session.currency, 3)?.toLowerCase() ?? "";
  if (amountTotal !== COMMERCIAL_PRODUCT_AMOUNT || currency !== COMMERCIAL_PRODUCT_CURRENCY) {
    return { ok: false, error: "checkout_amount_mismatch" };
  }

    const paymentLinkId = expandableId(session.payment_link);
  const metadata = asRecord(session.metadata);
  const isCanonicalPaymentLink = Boolean(
    paymentLinkId && timingSafeTextEqual(paymentLinkId, COMMERCIAL_PAYMENT_LINK_ID),
  );
  const isCanonicalEmbeddedCheckout =
    stringValue(session.ui_mode, 40) === "embedded"
    && stringValue(metadata?.checkout_surface, 80) === COMMERCIAL_EMBEDDED_CHECKOUT_MARKER
    && stringValue(metadata?.product_key, 120) === COMMERCIAL_PRODUCT_KEY
    && stringValue(metadata?.release, 80) === COMMERCIAL_PRODUCT_RELEASE;
  const checkoutSourceId = isCanonicalPaymentLink
    ? COMMERCIAL_PAYMENT_LINK_ID
    : isCanonicalEmbeddedCheckout
      ? COMMERCIAL_EMBEDDED_CHECKOUT_MARKER
      : null;
  if (!checkoutSourceId) {
    return { ok: false, error: "checkout_source_mismatch" };
  }


  const lineItems = asRecord(session.line_items);
  const lineItemData = Array.isArray(lineItems?.data) ? lineItems.data : [];
  const matchingLine = lineItemData.find((entry) => {
    const line = asRecord(entry);
    if (!line) return false;
    const priceId = expandableId(line.price);
    const quantity = integerValue(line.quantity);
    return priceId === COMMERCIAL_PRODUCT_PRICE_ID && quantity === 1;
  });
  if (!matchingLine) return { ok: false, error: "checkout_line_item_mismatch" };

  const customerDetails = asRecord(session.customer_details);
  return {
    ok: true,
    sessionId,
    paymentIntentId: expandableId(session.payment_intent),
    customerEmail: stringValue(customerDetails?.email, 320),
    customerName: stringValue(customerDetails?.name, 250),
    amountTotal,
        currency,
    checkoutCreatedAt: integerValue(session.created),
    checkoutSourceId,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function deterministicLicenseKey(sessionId: string): Promise<string> {
  const digest = (await sha256Hex(`lensically-commercial-license:${sessionId}`)).toUpperCase();
  return `LOT-${digest.slice(0, 6)}-${digest.slice(6, 12)}-${digest.slice(12, 18)}`;
}





async function createCommercialEmbeddedCheckoutSession(
  request: Request,
  env: CommercialDeliveryEnv,
): Promise<Response> {
  const stripeKey = env.LENSICALLY_STRIPE_KEY?.trim() ?? "";
  if (!stripeKey || (!stripeKey.startsWith("sk_") && !stripeKey.startsWith("rk_"))) {
    return jsonResponse({ ok: false, error: "checkout_creation_unavailable" }, 503);
  }

  const publishableKey = env.LENSICALLY_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!/^pk_(?:live|test)_[A-Za-z0-9]+$/.test(publishableKey)) {
    return jsonResponse({ ok: false, error: "checkout_publishable_key_unavailable" }, 503);
  }
  const secretMode = /^(?:sk|rk)_live_/.test(stripeKey) ? "live" : "test";
  const publishableMode = publishableKey.startsWith("pk_live_") ? "live" : "test";
  if (secretMode !== publishableMode) {
    return jsonResponse({ ok: false, error: "checkout_key_mode_mismatch" }, 503);
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("ui_mode", "embedded");
  params.set("redirect_on_completion", "always");
  params.set("line_items[0][price]", COMMERCIAL_PRODUCT_PRICE_ID);
  params.set("line_items[0][quantity]", "1");
  params.set("return_url", `${env.ROOT_SITE_URL?.trim() || "https://lensically.com"}/download/?session_id={CHECKOUT_SESSION_ID}`);
  params.set("metadata[product_key]", COMMERCIAL_PRODUCT_KEY);
  params.set("metadata[release]", COMMERCIAL_PRODUCT_RELEASE);
  params.set("metadata[checkout_surface]", COMMERCIAL_EMBEDDED_CHECKOUT_MARKER);

  const response = await fetch(`${STRIPE_API_ORIGIN}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.warn("COMMERCIAL_CHECKOUT_SESSION_CREATE_FAILED", {
      status: response.status,
      stripe_error: sanitizeStripeError(payload),
    });
    return jsonResponse({ ok: false, error: "checkout_session_creation_failed" }, 502);
  }
  const session = asRecord(payload);
  const sessionId = stringValue(session?.id, 255);
  const clientSecret = stringValue(session?.client_secret, 2000);
  if (!sessionId || !clientSecret) {
    return jsonResponse({ ok: false, error: "checkout_session_creation_failed" }, 502);
  }
  return jsonResponse({
    ok: true,
    publishable_key: publishableKey,
    client_secret: clientSecret,
    session_id: sessionId,
  });
}

async function fetchStripeCheckoutSession(
  env: CommercialDeliveryEnv,
  sessionId: string,
): Promise<{ ok: true; session: JsonRecord } | { ok: false; status: number; error: string }> {
  const stripeKey = env.LENSICALLY_STRIPE_KEY?.trim() ?? "";
  if (!stripeKey || (!stripeKey.startsWith("sk_") && !stripeKey.startsWith("rk_"))) {
    return { ok: false, status: 503, error: "checkout_verification_unavailable" };
  }

  const query = new URLSearchParams();
  query.append("expand[]", "line_items.data.price");
  const response = await fetch(
    `${STRIPE_API_ORIGIN}/checkout/sessions/${encodeURIComponent(sessionId)}?${query.toString()}`,
    {
      headers: { Authorization: `Bearer ${stripeKey}` },
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 404 ? 404 : 502,
      error: response.status === 404 ? "checkout_session_not_found" : "checkout_verification_failed",
    };
  }
  const session = asRecord(payload);
  return session
    ? { ok: true, session }
    : { ok: false, status: 502, error: "checkout_verification_failed" };
}

async function issueCommercialDownload(
  request: Request,
  env: CommercialDeliveryEnv,
  sessionId: string,
): Promise<Response> {
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    return jsonResponse({ ok: false, error: "invalid_checkout_session_id" }, 400);
  }

  const stripeResult = await fetchStripeCheckoutSession(env, sessionId);
  if (!stripeResult.ok) {
    return jsonResponse({ ok: false, error: stripeResult.error }, stripeResult.status);
  }

  const validation = validateCommercialCheckoutSessionPayload(stripeResult.session);
  if (!validation.ok) {
    const status = validation.error === "checkout_not_paid" || validation.error === "checkout_not_complete"
      ? 402
      : 403;
    return jsonResponse({ ok: false, error: validation.error }, status);
  }

    const now = new Date();
  const nowIso = now.toISOString();
  const existing = await env.DB.prepare(
    `SELECT session_id, license_key, customer_email, customer_name, download_count
     FROM commercial_orders
     WHERE session_id = ?`,
  ).bind(validation.sessionId).first<CommercialOrderRow>();
  const downloadCount = Number(existing?.download_count ?? 0);
  if (downloadCount >= MAX_DOWNLOADS_PER_PURCHASE) {
    return jsonResponse({ ok: false, error: "download_limit_reached" }, 429);
  }

  const licenseKey = existing?.license_key ?? await deterministicLicenseKey(validation.sessionId);
  await env.DB.prepare(
    `INSERT INTO commercial_orders (
       session_id, payment_intent_id, customer_email, customer_name, product_key,
       release_version, payment_link_id, price_id, amount_total, currency,
       payment_status, license_key, checkout_created_at, first_verified_at, last_verified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       payment_intent_id = excluded.payment_intent_id,
       customer_email = COALESCE(excluded.customer_email, commercial_orders.customer_email),
       customer_name = COALESCE(excluded.customer_name, commercial_orders.customer_name),
       amount_total = excluded.amount_total,
       currency = excluded.currency,
       payment_status = 'paid',
       last_verified_at = excluded.last_verified_at`,
  ).bind(
    validation.sessionId,
    validation.paymentIntentId,
    validation.customerEmail,
    validation.customerName,
        COMMERCIAL_PRODUCT_KEY,
    COMMERCIAL_PRODUCT_RELEASE,
    validation.checkoutSourceId,
    COMMERCIAL_PRODUCT_PRICE_ID,
    validation.amountTotal,
    validation.currency,
    licenseKey,
    validation.checkoutCreatedAt,
    nowIso,
    nowIso,
  ).run();

  await env.DB.prepare(
    `DELETE FROM commercial_download_tokens
     WHERE datetime(expires_at) <= datetime(?)
        OR (used_at IS NOT NULL AND datetime(used_at) <= datetime(?, '-1 day'))`,
  ).bind(nowIso, nowIso).run();

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(now.getTime() + DOWNLOAD_TOKEN_TTL_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO commercial_download_tokens (token_hash, session_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).bind(tokenHash, validation.sessionId, nowIso, expiresAt).run();

  const downloadUrl = new URL("/api/commercial/download", request.url);
  downloadUrl.searchParams.set("token", token);
  return jsonResponse({
    ok: true,
    product: "Lensically Operator for Threads",
    release: COMMERCIAL_PRODUCT_RELEASE,
    license_key: licenseKey,
    customer_email: validation.customerEmail,
    downloads_remaining: MAX_DOWNLOADS_PER_PURCHASE - downloadCount,
    download_url: downloadUrl.toString(),
    download_expires_at: expiresAt,
    sha256: COMMERCIAL_RELEASE_SHA256,
  });
}

async function fetchCommercialReleaseAsset(
  env: CommercialDeliveryEnv,
): Promise<{ ok: true; response: Response } | { ok: false; error: string }> {
  const githubToken = env.GITHUB_TOKEN?.trim() ?? "";
  if (!githubToken) return { ok: false, error: "release_delivery_unavailable" };
  const owner = env.GITHUB_OWNER?.trim() || "profitproperly";
  const commonHeaders = {
    Authorization: `Bearer ${githubToken}`,
    "User-Agent": "Lensically-Commercial-Delivery",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const releaseResponse = await fetch(
    `${GITHUB_API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(COMMERCIAL_RELEASE_REPOSITORY)}/releases/tags/${encodeURIComponent(COMMERCIAL_PRODUCT_RELEASE)}`,
    { headers: { ...commonHeaders, Accept: "application/vnd.github+json" } },
  );
  const releasePayload = await releaseResponse.json().catch(() => null);
  if (!releaseResponse.ok) return { ok: false, error: "release_lookup_failed" };
  const release = asRecord(releasePayload);
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const asset = assets
    .map(asRecord)
    .find((entry) => stringValue(entry?.name, 255) === COMMERCIAL_RELEASE_ASSET);
  const assetApiUrl = stringValue(asset?.url, 2000);
  if (!assetApiUrl) return { ok: false, error: "release_asset_missing" };

  const assetResponse = await fetch(assetApiUrl, {
    headers: { ...commonHeaders, Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!assetResponse.ok || !assetResponse.body) {
    return { ok: false, error: "release_download_failed" };
  }
  return { ok: true, response: assetResponse };
}

async function serveCommercialDownload(
  env: CommercialDeliveryEnv,
  token: string,
): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return jsonResponse({ ok: false, error: "invalid_download_token" }, 400);
  }
    const nowIso = new Date().toISOString();
  const tokenHash = await sha256Hex(token);
  const tokenRow = await env.DB.prepare(
    `SELECT t.token_hash, t.session_id, t.expires_at, t.used_at, o.download_count
     FROM commercial_download_tokens t
     JOIN commercial_orders o ON o.session_id = t.session_id
     WHERE t.token_hash = ?`,
  ).bind(tokenHash).first<CommercialDownloadTokenRow>();
  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ ok: false, error: "download_token_expired_or_used" }, 410);
  }
  if (Number(tokenRow.download_count) >= MAX_DOWNLOADS_PER_PURCHASE) {
    return jsonResponse({ ok: false, error: "download_limit_reached" }, 429);
  }

  const asset = await fetchCommercialReleaseAsset(env);
  if (!asset.ok) return jsonResponse({ ok: false, error: asset.error }, 502);

  const consumed = await env.DB.prepare(
    `UPDATE commercial_download_tokens
     SET used_at = ?
     WHERE token_hash = ?
       AND used_at IS NULL
       AND datetime(expires_at) > datetime(?)
     RETURNING session_id`,
  ).bind(nowIso, tokenHash, nowIso).first<{ session_id: string }>();
  if (!consumed) {
    return jsonResponse({ ok: false, error: "download_token_expired_or_used" }, 410);
  }
  await env.DB.prepare(
    `UPDATE commercial_orders
     SET download_count = download_count + 1,
         last_downloaded_at = ?
     WHERE session_id = ?`,
  ).bind(nowIso, tokenRow.session_id).run();

  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${COMMERCIAL_RELEASE_ASSET}"`);
  headers.set("cache-control", "no-store, private");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-lensically-release", COMMERCIAL_PRODUCT_RELEASE);
  headers.set("x-lensically-sha256", COMMERCIAL_RELEASE_SHA256);
  const contentLength = asset.response.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  return new Response(asset.response.body, { status: 200, headers });
}

export async function handleCommercialDeliveryRequest(
  request: Request,
  env: CommercialDeliveryEnv,
  normalizedPath: string,
): Promise<Response> {
  if (normalizedPath === "/api/commercial/embedded-checkout-session") {
    return request.method === "POST"
      ? createCommercialEmbeddedCheckoutSession(request, env)
      : jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }
  const url = new URL(request.url);
  if (normalizedPath === "/api/commercial/checkout-session") {
    const sessionId = stringValue(url.searchParams.get("session_id"), 255);
    return sessionId
      ? issueCommercialDownload(request, env, sessionId)
      : jsonResponse({ ok: false, error: "session_id_required" }, 400);
  }
  if (normalizedPath === "/api/commercial/download") {
    const token = stringValue(url.searchParams.get("token"), 200);
    return token
      ? serveCommercialDownload(env, token)
      : jsonResponse({ ok: false, error: "download_token_required" }, 400);
  }
  return jsonResponse({ ok: false, error: "not_found" }, 404);
}
