export const PAYMENT_TOLERANCE = 0.01;

export interface PaymentAmount {
  amount: number;
}

export function sumPayments(payments: PaymentAmount[] | number[]): number {
  if (!payments?.length) return 0;

  if (typeof payments[0] === "number") {
    return (payments as number[]).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  return (payments as PaymentAmount[]).reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  );
}

export function calculateRemaining(target: number, payments: PaymentAmount[] | number[]): number {
  return target - sumPayments(payments);
}

export function isWithinTolerance(value: number): boolean {
  return Math.abs(value) <= PAYMENT_TOLERANCE;
}

export function isPaymentCovered(target: number, payments: PaymentAmount[] | number[]): boolean {
  return isWithinTolerance(calculateRemaining(target, payments));
}

export function isOverPayment(target: number, payments: PaymentAmount[] | number[]): boolean {
  return sumPayments(payments) - target > PAYMENT_TOLERANCE;
}


