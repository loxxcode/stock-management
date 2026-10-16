import { describe, expect, it } from "vitest";
import { parseProductRows } from "./productImport";

describe("parseProductRows", () => {
  it("maps required and optional Excel columns into product records", () => {
    const result = parseProductRows([
      ["Product Name", "Unit Price", "Quantity", "Category", "Min Stock", "Taxable", "Tax Rate"],
      ["Coffee", "1,500", 12, "Drinks", 3, "Yes", 18],
      ["Tea", 800, 6, "", "", "No", ""],
    ]);

    expect(result.errors).toEqual([]);
    expect(result.products).toEqual([
      {
        name: "Coffee",
        price: 1500,
        stock: 12,
        category: "Drinks",
        minStock: 3,
        isTaxable: true,
        taxRate: 18,
      },
      {
        name: "Tea",
        price: 800,
        stock: 6,
        category: "General",
        minStock: 10,
        isTaxable: false,
        taxRate: 0,
      },
    ]);
  });

  it("reports invalid rows and skips repeated product names", () => {
    const result = parseProductRows([
      ["Name", "Price", "Stock"],
      ["Coffee", 1000, 5],
      ["coffee", 1100, 2],
      ["Tea", -1, 2],
      ["Broken", 100, 1.5],
    ]);

    expect(result.products.map((product) => product.name)).toEqual(["Coffee"]);
    expect(result.errors).toEqual([
      { row: 3, message: 'Duplicate product name "coffee" in the file.' },
      { row: 4, message: "Price must be a valid non-negative number." },
      { row: 5, message: "Stock must be a valid non-negative whole number." },
    ]);
  });

  it("requires name, price, and stock columns", () => {
    expect(parseProductRows([["Name", "Category"], ["Coffee", "Drinks"]])).toEqual({
      products: [],
      errors: [{
        row: 1,
        message: "Include required columns: Name, Price, and Stock (or Quantity).",
      }],
    });
  });
});
