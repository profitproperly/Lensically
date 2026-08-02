import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_PAYMENT_LINK_ID,
  COMMERCIAL_PRODUCT_AMOUNT,
  COMMERCIAL_PRODUCT_CURRENCY,
  COMMERCIAL_PRODUCT_PRICE_ID,
  validateCommercialCheckoutSessionPayload,
} from "../src/commercialDeliveryService";

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_live_commercial123",
    status: "complete",
    payment_status: "paid",
    amount_total: COMMERCIAL_PRODUCT_AMOUNT,
    currency: COMMERCIAL_PRODUCT_CURRENCY,
    payment_link: COMMERCIAL_PAYMENT_LINK_ID,
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
          price: { id: COMMERCIAL_PRODUCT_PRICE_ID },
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
      .toEqual({ ok: false, error: "checkout_payment_link_mismatch" });
    expect(validateCommercialCheckoutSessionPayload(paidSession({
      line_items: { data: [{ quantity: 1, price: { id: "price_other" } }] },
    }))).toEqual({ ok: false, error: "checkout_line_item_mismatch" });
    expect(validateCommercialCheckoutSessionPayload(paidSession({
      line_items: { data: [{ quantity: 2, price: { id: COMMERCIAL_PRODUCT_PRICE_ID } }] },
    }))).toEqual({ ok: false, error: "checkout_line_item_mismatch" });
  });
});
