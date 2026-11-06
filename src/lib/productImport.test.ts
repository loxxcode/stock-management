import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseProductWorkbook } from "./productImport";

async function toArrayBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const data = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(data);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("parseProductWorkbook", () => {
  it("reads product rows from every worksheet and reports invalid rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const firstSheet = workbook.addWorksheet("North");
    firstSheet.addRows([
      ["Product Name", "Unit Price", "Qty", "Category"],
      ["Tea", 1200, 5, "Drinks"],
    ]);

    const secondSheet = workbook.addWorksheet("South");
    secondSheet.addRows([
      ["Stock list"],
      ["Name", "Price", "Stock", "Min Stock"],
      ["Coffee", 1500, 2, 4],
      ["Broken", "not a price", -1, 3],
    ]);

    const result = await parseProductWorkbook(await toArrayBuffer(workbook));

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.name)).toEqual(["Tea", "Coffee"]);
    expect(result.rows[0]).toMatchObject({
      sheetName: "North",
      price: 1200,
      stock: 5,
      category: "Drinks",
    });
    expect(result.rows[1]).toMatchObject({
      sheetName: "South",
      minStock: 4,
    });
    expect(result.issues).toEqual([
      'Sheet "South", row 4: price must be a non-negative number, stock must be a non-negative whole number.',
    ]);
  });
});
