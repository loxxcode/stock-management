import ExcelJS from "exceljs";

export interface ProductImportRow {
  name: string;
  price: number;
  stock: number;
  category?: string;
  minStock?: number;
  isTaxable?: boolean;
  taxRate?: number;
  sheetName: string;
  rowNumber: number;
}

export interface ProductImportParseResult {
  rows: ProductImportRow[];
  issues: string[];
}

type HeaderKey = "name" | "price" | "stock" | "category" | "minStock" | "isTaxable" | "taxRate";
type HeaderColumns = Partial<Record<HeaderKey, number>>;

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  name: ["name", "product", "productname", "item", "itemname"],
  price: ["price", "unitprice", "sellingprice"],
  stock: ["stock", "quantity", "qty", "quantityinstock"],
  category: ["category"],
  minStock: ["minstock", "minimumstock", "reorderlevel"],
  isTaxable: ["taxable", "istaxable"],
  taxRate: ["taxrate", "taxpercent"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCellValue(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if ("result" in value) return value.result;
  if ("text" in value) return value.text;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) =>
      typeof part === "object" && part !== null && "text" in part ? part.text : ""
    ).join("");
  }
  return value;
}

function cellText(value: unknown): string {
  const resolved = getCellValue(value);
  return resolved == null ? "" : String(resolved).trim();
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = cellText(value).replace(/,/g, "");
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = cellText(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return undefined;
}

function findHeader(worksheet: ExcelJS.Worksheet): { rowNumber: number; columns: HeaderColumns } | undefined {
  const lastHeaderRow = Math.min(worksheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= lastHeaderRow; rowNumber++) {
    const columns: HeaderColumns = {};
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const normalized = normalizeHeader(getCellValue(cell.value));
      const key = (Object.keys(HEADER_ALIASES) as HeaderKey[])
        .find((headerKey) => HEADER_ALIASES[headerKey].includes(normalized));
      if (key && columns[key] === undefined) columns[key] = columnNumber;
    });

    if (columns.name !== undefined && columns.price !== undefined && columns.stock !== undefined) {
      return { rowNumber, columns };
    }
  }
  return undefined;
}

function isBlankRow(row: ExcelJS.Row): boolean {
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cellText(cell.value)) hasValue = true;
  });
  return !hasValue;
}

export async function parseProductWorkbook(data: ArrayBuffer): Promise<ProductImportParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);

  if (workbook.worksheets.length === 0) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const rows: ProductImportRow[] = [];
  const issues: string[] = [];

  for (const worksheet of workbook.worksheets) {
    const header = findHeader(worksheet);
    if (!header) {
      if (worksheet.rowCount > 0) {
        issues.push(`Sheet "${worksheet.name}" has no header row with Name, Price, and Stock columns.`);
      }
      continue;
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= header.rowNumber || isBlankRow(row)) return;

      const cell = (key: HeaderKey) => {
        const columnNumber = header.columns[key];
        return columnNumber === undefined ? undefined : row.getCell(columnNumber).value;
      };
      const name = cellText(cell("name"));
      const price = parseNumber(cell("price"));
      const stock = parseNumber(cell("stock"));
      const minStockValue = header.columns.minStock === undefined ? undefined : cell("minStock");
      const minStock = minStockValue === undefined || !cellText(minStockValue)
        ? undefined
        : parseNumber(minStockValue);
      const errors: string[] = [];

      if (!name) errors.push("product name is required");
      if (price === undefined || price < 0) errors.push("price must be a non-negative number");
      if (stock === undefined || !Number.isInteger(stock) || stock < 0) {
        errors.push("stock must be a non-negative whole number");
      }
      if (minStockValue !== undefined && cellText(minStockValue) && (
        minStock === undefined || !Number.isInteger(minStock) || minStock < 0
      )) {
        errors.push("minimum stock must be a non-negative whole number");
      }

      const taxableValue = cell("isTaxable");
      const taxable = taxableValue === undefined || !cellText(taxableValue)
        ? undefined
        : parseBoolean(taxableValue);
      if (taxableValue !== undefined && cellText(taxableValue) && taxable === undefined) {
        errors.push("taxable must be Yes or No");
      }

      const taxRateValue = cell("taxRate");
      const taxRate = taxRateValue === undefined || !cellText(taxRateValue)
        ? undefined
        : parseNumber(taxRateValue);
      if (taxRateValue !== undefined && cellText(taxRateValue) && (
        taxRate === undefined || taxRate < 0 || taxRate > 100
      )) {
        errors.push("tax rate must be between 0 and 100");
      }

      if (errors.length > 0) {
        issues.push(`Sheet "${worksheet.name}", row ${rowNumber}: ${errors.join(", ")}.`);
        return;
      }

      if (price === undefined || stock === undefined) return;

      rows.push({
        name,
        price,
        stock,
        ...(cell("category") !== undefined && cellText(cell("category"))
          ? { category: cellText(cell("category")) }
          : {}),
        ...(minStock !== undefined ? { minStock } : {}),
        ...(taxable !== undefined ? { isTaxable: taxable } : {}),
        ...(taxRate !== undefined
          ? { taxRate, ...(taxable === undefined ? { isTaxable: taxRate > 0 } : {}) }
          : taxable === true ? { taxRate: 18 } : {}),
        sheetName: worksheet.name,
        rowNumber,
      });
    });
  }

  return { rows, issues };
}
