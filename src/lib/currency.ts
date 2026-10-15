export type EntryCurrency = "RWF" | "USD";

export const USD_TO_RWF_RATE = 1450;

export function toRwf(amount: number, currency: EntryCurrency): number {
  return currency === "USD" ? amount * USD_TO_RWF_RATE : amount;
}

export function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString()}`;
}