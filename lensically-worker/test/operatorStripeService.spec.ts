import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_STRIPE_TOOL_NAMES,
  OPERATOR_STRIPE_TOOLS,
  handleOperatorStripeTool,
} from "../src/operatorStripeService";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("native Stripe operator service", () => {
  it("advertises the bounded native Stripe surface", () => {
    expect(OPERATOR_STRIPE_TOOL_NAMES).toEqual([
      "getStripeAccountState",
      "readStripeObjects",
      "operateStripe",
    ]);
    expect(OPERATOR_STRIPE_TOOLS.map((tool) => tool.name)).toEqual(OPERATOR_STRIPE_TOOL_NAMES);
  });

  it("reads account state through the protected Cloudflare secret without returning the key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      id: "acct_test",
      country: "US",
      default_currency: "usd",
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      business_profile: { name: "Lensically" },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await handleOperatorStripeTool(
      { LENSICALLY_STRIPE_KEY: "sk_test_example" },
      "getStripeAccountState",
      {},
    );

    expect(result).toMatchObject({
      ok: true,
      account: {
        id: "acct_test",
        country: "US",
        charges_enabled: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("sk_test_example");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/account");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_example");
  });

  it("uses Stripe idempotency for product mutations", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      id: "prod_test",
      object: "product",
      name: "Lensically Operator Threads",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await handleOperatorStripeTool(
      { LENSICALLY_STRIPE_KEY: "rk_test_example" },
      "operateStripe",
      {
        operation: "create_product",
        operation_id: "stripe-product-v1-20260802",
        name: "Lensically Operator Threads",
        description: "Customer-owned Threads operating system.",
        metadata: { release: "1.0.0" },
      },
    );

    expect(result).toMatchObject({ ok: true, stripe: { id: "prod_test" } });
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toBe("stripe-product-v1-20260802");
    expect(String(init?.body)).toContain("name=Lensically+Operator+Threads");
    expect(String(init?.body)).toContain("metadata%5Brelease%5D=1.0.0");
  });

    it("creates embedded Checkout Sessions without hosted success or cancel URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      id: "cs_test_embedded",
      client_secret: "cs_test_embedded_secret_test",
      ui_mode: "embedded",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await handleOperatorStripeTool(
      { LENSICALLY_STRIPE_KEY: "sk_test_example" },
      "operateStripe",
      {
        operation: "create_checkout_session",
        operation_id: "embedded-checkout-test-20260807",
        price_id: "price_test",
        quantity: 1,
        mode: "payment",
        ui_mode: "embedded",
        return_url: "https://example.com/return?session_id={CHECKOUT_SESSION_ID}",
      },
    );

    expect(result).toMatchObject({ ok: true, stripe: { id: "cs_test_embedded" } });
    const [, init] = fetchSpy.mock.calls[0];
    const body = String(init?.body);
    expect(body).toContain("ui_mode=embedded");
    expect(body).toContain("return_url=https%3A%2F%2Fexample.com%2Freturn%3Fsession_id%3D%7BCHECKOUT_SESSION_ID%7D");
    expect(body).not.toContain("success_url=");
    expect(body).not.toContain("cancel_url=");
  });

  it("blocks refunds without the owner's exact approval before contacting Stripe", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await handleOperatorStripeTool(
      { LENSICALLY_STRIPE_KEY: "sk_test_example" },
      "operateStripe",
      {
        operation: "refund_payment",
        operation_id: "refund-test-20260802",
        payment_intent_id: "pi_test",
      },
    );

    expect(result).toEqual({ ok: false, error: "owner_approval_required_for_refund" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when the Stripe secret is absent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await handleOperatorStripeTool({}, "getStripeAccountState", {});
    expect(result).toMatchObject({ ok: false, error: "stripe_key_missing_or_invalid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
