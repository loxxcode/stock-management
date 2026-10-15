import { describe, expect, it } from "vitest";
import { formatRwf, toRwf, USD_TO_RWF_RATE } from "./currency";

describe("currency conversion", () => {
  it("keeps RWF amounts unchanged", () => {
    expect(toRwf(1250, "RWF")).toBe(1250);
  });

  it("converts USD amounts to RWF using the shared rate", () => {
    expect(toRwf(10, "USD")).toBe(10 * USD_TO_RWF_RATE);
  });

  it("formats amounts for display in RWF", () => {
    expect(formatRwf(14500)).toBe("RWF 14,500");
  });
});