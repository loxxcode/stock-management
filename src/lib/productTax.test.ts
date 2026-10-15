import { describe, expect, it } from "vitest";
import { calculateProductTax } from "./productTax";

describe("calculateProductTax", () => {
  it("does not charge tax for a non-taxable product", () => {
    expect(calculateProductTax(10000, false, 18)).toBe(0);
  });

  it("calculates tax from the product rate and rounds to whole RWF", () => {
    expect(calculateProductTax(10000, true, 18)).toBe(1800);
    expect(calculateProductTax(1001, true, 18)).toBe(180);
  });

  it("bounds an invalid rate to 0 through 100 percent", () => {
    expect(calculateProductTax(10000, true, 120)).toBe(10000);
    expect(calculateProductTax(10000, true, -1)).toBe(0);
  });
});