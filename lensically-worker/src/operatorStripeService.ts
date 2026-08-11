import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

export const OPERATOR_STRIPE_TOOL_NAMES = [
  "getStripeAccountState",
  "readStripeObjects",
  "operateStripe",
] as const;

export type OperatorStripeToolName = typeof OPERATOR_STRIPE_TOOL_NAMES[number];

export interface OperatorStripeEnv {
  LENSICALLY_STRIPE_KEY?: string;
}

const STRIPE_API_ORIGIN = "https://api.stripe.com/v1";
const STRIPE_MAX_LIST_LIMIT = 100;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeInteger(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return null;
  return parsed;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function appendMetadata(params: URLSearchParams, metadata: unknown): void {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return;
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>).slice(0, 50)) {
    const safeKey = normalizeText(key, 40);
    const safeValue = normalizeText(value, 500);
    if (safeKey && safeValue) params.set(`metadata[${safeKey}]`, safeValue);
  }
}

function stripeKey(env: OperatorStripeEnv): string | null {
  const key = env.LENSICALLY_STRIPE_KEY?.trim() ?? "";
  return key.startsWith("sk_") || key.startsWith("rk_") ? key : null;
}

async function stripeRequest(
  env: OperatorStripeEnv,
  path: string,
  init: { method?: "GET" | "POST"; params?: URLSearchParams; idempotencyKey?: string | null } = {},
): Promise<Record<string, unknown>> {
  const key = stripeKey(env);
  if (!key) {
    return { ok: false, error: "stripe_key_missing_or_invalid", required_secret: "LENSICALLY_STRIPE_KEY" };
  }

  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };
  let url = `${STRIPE_API_ORIGIN}${path}`;
  let body: string | undefined;
  if (init.params && method === "GET") {
    const query = init.params.toString();
    if (query) url += `?${query}`;
  } else if (init.params) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = init.params.toString();
  }
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey.slice(0, 255);

  const response = await fetch(url, { method, headers, body });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const stripeError = payload?.error && typeof payload.error === "object" && !Array.isArray(payload.error)
      ? payload.error as Record<string, unknown>
      : {};
    return {
      ok: false,
      status: response.status,
      error: "stripe_api_error",
      stripe_error: {
        type: stripeError.type ?? null,
        code: stripeError.code ?? null,
        param: stripeError.param ?? null,
        message: stripeError.message ?? `Stripe returned HTTP ${response.status}.`,
      },
    };
  }
  return { ok: true, status: response.status, stripe: payload ?? {} };
}

function accountSummary(payload: Record<string, unknown>): Record<string, unknown> {
  const stripe = payload.stripe && typeof payload.stripe === "object" && !Array.isArray(payload.stripe)
    ? payload.stripe as Record<string, unknown>
    : {};
  const businessProfile = stripe.business_profile && typeof stripe.business_profile === "object" && !Array.isArray(stripe.business_profile)
    ? stripe.business_profile as Record<string, unknown>
    : {};
  return {
    ok: payload.ok === true,
    status: payload.status ?? null,
    account: payload.ok === true ? {
      id: stripe.id ?? null,
      country: stripe.country ?? null,
      default_currency: stripe.default_currency ?? null,
      charges_enabled: stripe.charges_enabled ?? null,
      payouts_enabled: stripe.payouts_enabled ?? null,
      details_submitted: stripe.details_submitted ?? null,
      business_name: businessProfile.name ?? null,
      support_email: businessProfile.support_email ?? null,
    } : null,
    ...(payload.ok === true ? {} : payload),
  };
}

export function isOperatorStripeToolName(value: string): value is OperatorStripeToolName {
  return (OPERATOR_STRIPE_TOOL_NAMES as readonly string[]).includes(value);
}

export const OPERATOR_STRIPE_TOOLS: OperatorMcpToolDefinition[] = [
  {
    name: "getStripeAccountState",
    title: "Get Stripe account state",
    description: "Verify the native Lensically Stripe connection and read the account's operational payment status without exposing the API key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "readStripeObjects",
    title: "Read Stripe objects",
    description: "Read the connected Stripe account's products, prices, customers, payment intents, Checkout Sessions, refunds, or balance through Lensically Operator Mode.",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "account",
            "balance",
            "list_products",
            "list_prices",
            "list_customers",
            "list_payment_intents",
            "list_checkout_sessions",
            "retrieve_checkout_session",
            "list_refunds"
          ],
        },
        object_id: { type: "string", description: "Required for retrieve_checkout_session." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        starting_after: { type: "string" },
      },
      required: ["operation"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "operateStripe",
    title: "Operate Stripe",
    description: "Create or update Stripe products and prices, create customers, Checkout Sessions, Payment Links, or an owner-approved refund through the native Lensically Stripe connection. Reuse operation_id for idempotent retries.",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "validate_configuration",
                        "create_product",
            "update_product",
            "create_price",
            "update_price",
            "create_customer",
            "create_checkout_session",
            "create_payment_link",
            "refund_payment"
          ],
        },
        operation_id: { type: "string", minLength: 8, maxLength: 255 },
        name: { type: "string" },
        description: { type: "string" },
        product_id: { type: "string" },
        price_id: { type: "string" },
        unit_amount: { type: "integer", minimum: 1, description: "Amount in the currency's smallest unit, such as cents." },
        currency: { type: "string", minLength: 3, maxLength: 3, default: "usd" },
        recurring_interval: { type: "string", enum: ["day", "week", "month", "year"] },
        email: { type: "string" },
        customer_name: { type: "string" },
        customer_id: { type: "string" },
        quantity: { type: "integer", minimum: 1, maximum: 999999, default: 1 },
                mode: { type: "string", enum: ["payment", "subscription"], default: "payment" },
        ui_mode: { type: "string", enum: ["hosted", "embedded"], default: "hosted" },
        success_url: { type: "string" },
        cancel_url: { type: "string" },
        return_url: { type: "string" },
        after_completion_redirect_url: { type: "string" },
                allow_promotion_codes: { type: "boolean" },
        active: { type: "boolean" },
        payment_intent_id: { type: "string" },
        charge_id: { type: "string" },
        refund_amount: { type: "integer", minimum: 1 },
        refund_reason: { type: "string", enum: ["duplicate", "fraudulent", "requested_by_customer"] },
        metadata: { type: "object", additionalProperties: true },
        owner_response: { type: "string", description: "The owner's exact approval is mandatory for refund_payment." },
      },
      required: ["operation"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
];

export async function handleOperatorStripeTool(
  env: OperatorStripeEnv,
  toolName: OperatorStripeToolName,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (toolName === "getStripeAccountState") {
    return accountSummary(await stripeRequest(env, "/account"));
  }

  if (toolName === "readStripeObjects") {
    const operation = normalizeText(args.operation, 80);
    const params = new URLSearchParams();
    const limit = normalizeInteger(args.limit ?? 20, 1, STRIPE_MAX_LIST_LIMIT) ?? 20;
    const startingAfter = normalizeText(args.starting_after, 255);
    params.set("limit", String(limit));
    if (startingAfter) params.set("starting_after", startingAfter);

    if (operation === "account") return accountSummary(await stripeRequest(env, "/account"));
    if (operation === "balance") return stripeRequest(env, "/balance");
    if (operation === "list_products") return stripeRequest(env, "/products", { params });
    if (operation === "list_prices") return stripeRequest(env, "/prices", { params });
    if (operation === "list_customers") return stripeRequest(env, "/customers", { params });
    if (operation === "list_payment_intents") return stripeRequest(env, "/payment_intents", { params });
    if (operation === "list_checkout_sessions") return stripeRequest(env, "/checkout/sessions", { params });
    if (operation === "list_refunds") return stripeRequest(env, "/refunds", { params });
    if (operation === "retrieve_checkout_session") {
      const id = normalizeText(args.object_id, 255);
      return id
        ? stripeRequest(env, `/checkout/sessions/${encodeURIComponent(id)}`)
        : { ok: false, error: "object_id_required" };
    }
    return { ok: false, error: "unsupported_stripe_read_operation" };
  }

  const operation = normalizeText(args.operation, 80);
  if (operation === "validate_configuration") {
    return accountSummary(await stripeRequest(env, "/account"));
  }

  const operationId = normalizeText(args.operation_id, 255);
  if (!operationId) return { ok: false, error: "operation_id_required_for_stripe_mutation" };
  const params = new URLSearchParams();
  appendMetadata(params, args.metadata);

  if (operation === "create_product") {
    const name = normalizeText(args.name, 250);
    if (!name) return { ok: false, error: "product_name_required" };
    params.set("name", name);
    const description = normalizeText(args.description, 4000);
    if (description) params.set("description", description);
    return stripeRequest(env, "/products", { method: "POST", params, idempotencyKey: operationId });
  }

    if (operation === "update_product") {
    const productId = normalizeText(args.product_id, 255);
    if (!productId) return { ok: false, error: "product_id_required" };
    const name = normalizeText(args.name, 250);
    const description = normalizeText(args.description, 4000);
    const defaultPriceId = normalizeText(args.price_id, 255);
    const active = normalizeBoolean(args.active);
    if (name) params.set("name", name);
    if (description) params.set("description", description);
    if (defaultPriceId) params.set("default_price", defaultPriceId);
    if (active !== null) params.set("active", String(active));
    if (!params.toString()) return { ok: false, error: "product_update_fields_required" };
    return stripeRequest(env, `/products/${encodeURIComponent(productId)}`, { method: "POST", params, idempotencyKey: operationId });
  }

  if (operation === "create_price") {
    const productId = normalizeText(args.product_id, 255);
    const unitAmount = normalizeInteger(args.unit_amount, 1, Number.MAX_SAFE_INTEGER);
    const currency = (normalizeText(args.currency, 3) ?? "usd").toLowerCase();
    if (!productId || unitAmount === null || !/^[a-z]{3}$/.test(currency)) {
      return { ok: false, error: "product_id_unit_amount_and_currency_required" };
    }
    params.set("product", productId);
    params.set("unit_amount", String(unitAmount));
    params.set("currency", currency);
    const interval = normalizeText(args.recurring_interval, 10);
    if (interval && ["day", "week", "month", "year"].includes(interval)) {
      params.set("recurring[interval]", interval);
    }
    return stripeRequest(env, "/prices", { method: "POST", params, idempotencyKey: operationId });
  }

  if (operation === "create_customer") {
    const email = normalizeText(args.email, 320);
    const customerName = normalizeText(args.customer_name ?? args.name, 250);
    const description = normalizeText(args.description, 1000);
    if (!email && !customerName) return { ok: false, error: "customer_email_or_name_required" };
    if (email) params.set("email", email);
    if (customerName) params.set("name", customerName);
    if (description) params.set("description", description);
    return stripeRequest(env, "/customers", { method: "POST", params, idempotencyKey: operationId });
  }

    if (operation === "create_checkout_session") {
    const priceId = normalizeText(args.price_id, 255);
    const mode = normalizeText(args.mode, 20) ?? "payment";
    const uiMode = normalizeText(args.ui_mode, 20) ?? "hosted";
    const quantity = normalizeInteger(args.quantity ?? 1, 1, 999999) ?? 1;
    if (!priceId || !["payment", "subscription"].includes(mode) || !["hosted", "embedded"].includes(uiMode)) {
      return { ok: false, error: "price_id_mode_and_ui_mode_required" };
    }
    params.set("mode", mode);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", String(quantity));
    if (uiMode === "embedded") {
      const returnUrl = normalizeText(args.return_url, 2000);
      if (!returnUrl) return { ok: false, error: "return_url_required_for_embedded_checkout" };
      params.set("ui_mode", "embedded");
      params.set("return_url", returnUrl);
      params.set("redirect_on_completion", "always");
    } else {
      const successUrl = normalizeText(args.success_url, 2000);
      const cancelUrl = normalizeText(args.cancel_url, 2000);
      if (!successUrl || !cancelUrl) {
        return { ok: false, error: "success_url_and_cancel_url_required_for_hosted_checkout" };
      }
      params.set("success_url", successUrl);
      params.set("cancel_url", cancelUrl);
    }
    const customerId = normalizeText(args.customer_id, 255);
    const email = normalizeText(args.email, 320);
    if (customerId) params.set("customer", customerId);
    else if (email) params.set("customer_email", email);
    const allowPromotionCodes = normalizeBoolean(args.allow_promotion_codes);
    if (allowPromotionCodes !== null) params.set("allow_promotion_codes", String(allowPromotionCodes));
    return stripeRequest(env, "/checkout/sessions", { method: "POST", params, idempotencyKey: operationId });
  }

  if (operation === "create_payment_link") {
    const priceId = normalizeText(args.price_id, 255);
    const quantity = normalizeInteger(args.quantity ?? 1, 1, 999999) ?? 1;
    if (!priceId) return { ok: false, error: "price_id_required" };
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", String(quantity));
    const allowPromotionCodes = normalizeBoolean(args.allow_promotion_codes);
    if (allowPromotionCodes !== null) params.set("allow_promotion_codes", String(allowPromotionCodes));
    const redirectUrl = normalizeText(args.after_completion_redirect_url, 2000);
    if (redirectUrl) {
      params.set("after_completion[type]", "redirect");
      params.set("after_completion[redirect][url]", redirectUrl);
    }
    return stripeRequest(env, "/payment_links", { method: "POST", params, idempotencyKey: operationId });
  }

  if (operation === "refund_payment") {
    const ownerResponse = normalizeText(args.owner_response, 8000);
    if (!ownerResponse) return { ok: false, error: "owner_approval_required_for_refund" };
    const paymentIntentId = normalizeText(args.payment_intent_id, 255);
    const chargeId = normalizeText(args.charge_id, 255);
    if (!paymentIntentId && !chargeId) return { ok: false, error: "payment_intent_id_or_charge_id_required" };
    if (paymentIntentId) params.set("payment_intent", paymentIntentId);
    if (chargeId) params.set("charge", chargeId);
    const amount = normalizeInteger(args.refund_amount, 1, Number.MAX_SAFE_INTEGER);
    if (amount !== null) params.set("amount", String(amount));
    const reason = normalizeText(args.refund_reason, 40);
    if (reason && ["duplicate", "fraudulent", "requested_by_customer"].includes(reason)) params.set("reason", reason);
    return stripeRequest(env, "/refunds", { method: "POST", params, idempotencyKey: operationId });
  }

  return { ok: false, error: "unsupported_stripe_operation" };
}
