import { afterEach, describe, expect, it, vi } from "vitest";
import {
    COMMERCIAL_EMBEDDED_CHECKOUT_MARKER,
  COMMERCIAL_PAYMENT_LINK_ID,
  COMMERCIAL_PRODUCT_AMOUNT,
  COMMERCIAL_PRODUCT_CURRENCY,
  COMMERCIAL_PRODUCT_NAME,
  COMMERCIAL_PRODUCT_PRICE_ID,
  handleCommercialDeliveryRequest,
  validateCommercialCheckoutSessionPayload,
} from "../src/commercialDeliveryService";

afterEach(() => {
  vi.restoreAllMocks();
});

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_live_commercial123",
    status: "complete",
    payment_status: "paid",
    amount_total: COMMERCIAL_PRODUCT_AMOUNT,
    currency: COMMERCIAL_PRODUCT_CURRENCY,
        payment_link: COMMERCIAL_PAYMENT_LINK_ID,
    ui_mode: "hosted",
    payment_intent: "pi_commercial123",
    created: 1785698514,
    customer_details: {
      email: "buyer@example.com",
      name: "Buyer Name",
    },
    line_items: {
      data: [
        {
          quantity: 1,
          price: {
            id: COMMERCIAL_PRODUCT_PRICE_ID,
            unit_amount: COMMERCIAL_PRODUCT_AMOUNT,
            currency: COMMERCIAL_PRODUCT_CURRENCY,
            product: { name: COMMERCIAL_PRODUCT_NAME },
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("commercial delivery checkout verification", () => {
  it("accepts only the paid live product, price, quantity, and payment link", () => {
    expect(validateCommercialCheckoutSessionPayload(paidSession())).toEqual({
      ok: true,
      sessionId: "cs_live_commercial123",
      paymentIntentId: "pi_commercial123",
      customerEmail: "buyer@example.com",
      customerName: "Buyer Name",
      amountTotal: COMMERCIAL_PRODUCT_AMOUNT,
            currency: COMMERCIAL_PRODUCT_CURRENCY,
      checkoutCreatedAt: 1785698514,
      checkoutSourceId: COMMERCIAL_PAYMENT_LINK_ID,
    });
  });

    it("accepts a server-issued embedded checkout session for the same canonical offer", () => {
    expect(validateCommercialCheckoutSessionPayload(paidSession({
      payment_link: null,
      ui_mode: "embedded_page",
      line_items: {
        data: [
          {
            quantity: 1,
            price: {
              id: "price_embedded_inline",
              unit_amount: COMMERCIAL_PRODUCT_AMOUNT,
              currency: COMMERCIAL_PRODUCT_CURRENCY,
              product: { name: COMMERCIAL_PRODUCT_NAME },
            },
          },
        ],
      },
      metadata: {
        product_key: "lensically_operator_threads",
        release: "v1.0.0",
        checkout_surface: COMMERCIAL_EMBEDDED_CHECKOUT_MARKER,
      },
    }))).toMatchObject({
      ok: true,
      checkoutSourceId: COMMERCIAL_EMBEDDED_CHECKOUT_MARKER,
    });
  });

  it("rejects unpaid or incomplete sessions", () => {
    expect(validateCommercialCheckoutSessionPayload(paidSession({ payment_status: "unpaid" })))
      .toEqual({ ok: false, error: "checkout_not_paid" });
    expect(validateCommercialCheckoutSessionPayload(paidSession({ status: "open" })))
      .toEqual({ ok: false, error: "checkout_not_complete" });
  });

  it("rejects wrong amounts, links, prices, or quantities", () => {
    expect(validateCommercialCheckoutSessionPayload(paidSession({ amount_total: 100 })))
      .toEqual({ ok: false, error: "checkout_amount_mismatch" });
        expect(validateCommercialCheckoutSessionPayload(paidSession({ payment_link: "plink_other" })))
      .toEqual({ ok: false, error: "checkout_source_mismatch" });
    expect(validateCommercialCheckoutSessionPayload(paidSession({
      payment_link: null,
      ui_mode: "embedded_page",
      metadata: { checkout_surface: COMMERCIAL_EMBEDDED_CHECKOUT_MARKER },
    }))).toEqual({ ok: false, error: "checkout_source_mismatch" });
    expect(validateCommercialCheckoutSessionPayload(paidSession({
      line_items: { data: [{ quantity: 1, price: { id: "price_other" } }] },
    }))).toEqual({ ok: false, error: "checkout_line_item_mismatch" });
    expect(validateCommercialCheckoutSessionPayload(paidSession({
      line_items: { data: [{ quantity: 2, price: { id: COMMERCIAL_PRODUCT_PRICE_ID } }] },
    }))).toEqual({ ok: false, error: "checkout_line_item_mismatch" });
  });

  it("creates embedded checkout sessions that return to the root sales download route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      id: "cs_live_embedded123",
      client_secret: "cs_live_embedded123_secret_abc",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await handleCommercialDeliveryRequest(
      new Request("https://api.lensically.com/api/commercial/embedded-checkout-session", { method: "POST" }),
      {
        DB: {} as D1Database,
        LENSICALLY_STRIPE_KEY: "sk_live_testsecret",
        LENSICALLY_STRIPE_PUBLISHABLE_KEY: "pk_live_testpublishable",
        ROOT_SITE_URL: "https://lensically.com",
      },
      "/api/commercial/embedded-checkout-session",
    );

    expect(response.status).toBe(200);
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    const params = new URLSearchParams(body);
    expect(params.get("ui_mode")).toBe("embedded_page");
    expect(params.get("redirect_on_completion")).toBe("always");
    expect(params.get("line_items[0][price]")).toBeNull();
    expect(params.get("line_items[0][price_data][currency]")).toBe(COMMERCIAL_PRODUCT_CURRENCY);
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe(String(COMMERCIAL_PRODUCT_AMOUNT));
    expect(params.get("line_items[0][price_data][product_data][name]")).toBe(COMMERCIAL_PRODUCT_NAME);
    expect(params.get("return_url")).toBe("https://lensically.com/download/?session_id={CHECKOUT_SESSION_ID}");
  });
});
