import { describe, expect, test } from "@jest/globals";
import { PAYMENT_TOLERANCE, isOverPayment, isPaymentCovered, sumPayments } from "@/lib/payments";

describe("payments utils", () => {
  test("sumPayments works with arrays of numbers", () => {
    expect(sumPayments([100, 50.5, 0.5])).toBeCloseTo(151, 5);
    expect(sumPayments([])).toBe(0);
  });

  test("sumPayments works with payment objects", () => {
    const payments = [{ amount: 60 }, { amount: 40.25 }];
    expect(sumPayments(payments)).toBeCloseTo(100.25, 5);
  });

  test("isPaymentCovered respects tolerance", () => {
    const target = 100;
    const payments = [{ amount: 60 }, { amount: 40 - PAYMENT_TOLERANCE / 2 }];
    expect(isPaymentCovered(target, payments)).toBe(true);
  });

  test("isOverPayment detects when total exceeds tolerance", () => {
    const target = 120;
    const payments = [{ amount: 80 }, { amount: 40 + PAYMENT_TOLERANCE * 2 }];
    expect(isOverPayment(target, payments)).toBe(true);
  });

  test("isPaymentCovered is false when remaining amount is above tolerance", () => {
    const target = 75;
    const payments = [{ amount: 25 }, { amount: 49 }];
    expect(isPaymentCovered(target, payments)).toBe(false);
  });
});


