import ExcelJS from "exceljs";
import type { Product } from "@/lib/store";

export type ImportedProduct = Omit<Product, "id">;

export interface ProductImportError {
  row: number;
  message: string;
  sheetName?: string;
}

export interface ProductImportResult {
  products: ImportedProduct[];
  errors: ProductImportError[];
}

const MAX_IMPORT_ROWS = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTaxable(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["yes", "true", "1", "taxable"].includes(normalized)) return true;
  if (["no", "false", "0", "non-taxable", "nontaxable"].includes(normalized)) return false;
  return normalized ? null : false;
}

export function parseProductRows(
  rows: unknown[][],
  sheetName?: string,
  seenNames = new Set<string>(),
): ProductImportResult {
  const makeError = (row: number, message: string): ProductImportError => ({
    row,
    message,
    ...(sheetName ? { sheetName } : {}),
  });

  if (!rows.length) {
    return { products: [], errors: [makeError(1, "The spreadsheet is empty.")] };
  }

  let headerRowIndex = -1;
  let headerIndexes = new Map<string, number>();
  const headerRowsToCheck = Math.min(rows.length, 20);
  for (let rowIndex = 0; rowIndex < headerRowsToCheck; rowIndex++) {
    const candidateIndexes = new Map<string, number>();
    (rows[rowIndex] ?? []).forEach((header, index) => {
      const normalized = normalizeHeader(header);
      if (normalized) candidateIndexes.set(normalized, index);
    });
    const hasColumn = (...names: string[]) =>
      names.some((name) => candidateIndexes.has(normalizeHeader(name)));
    if (
      hasColumn("name", "product", "product name", "productname") &&
      hasColumn("price", "unit price", "selling price") &&
      hasColumn("stock", "quantity", "qty")
    ) {
      headerRowIndex = rowIndex;
      headerIndexes = candidateIndexes;
      break;
    }
  }

  const findColumn = (...names: string[]) =>
    names.map(normalizeHeader).map((name) => headerIndexes.get(name)).find((index) => index !== undefined);

  const nameIndex = findColumn("name", "product", "product name", "productname");
  const priceIndex = findColumn("price", "unit price", "selling price");
  const stockIndex = findColumn("stock", "quantity", "qty");

  if (nameIndex === undefined || priceIndex === undefined || stockIndex === undefined) {
    return {
      products: [],
      errors: [makeError(1, "Include required columns: Name, Price, and Stock (or Quantity).")],
    };
  }

  if (rows.length - headerRowIndex - 1 > MAX_IMPORT_ROWS) {
    return {
      products: [],
      errors: [makeError(1, `Import up to ${MAX_IMPORT_ROWS} product rows at a time.`)],
    };
  }

  const categoryIndex = findColumn("category");
  const minStockIndex = findColumn("min stock", "minimum stock", "minstock");
  const taxableIndex = findColumn("taxable", "is taxable", "charge tax");
  const taxRateIndex = findColumn("tax rate", "taxrate");
  const products: ImportedProduct[] = [];
  const errors: ProductImportError[] = [];
  rows.slice(headerRowIndex + 1).forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const name = String(row[nameIndex] ?? "").trim();
    if (!name && row.every((cell) => String(cell ?? "").trim() === "")) return;
    if (!name) {
      errors.push(makeError(rowNumber, "Product name is required."));
      return;
    }

    const normalizedName = name.toLocaleLowerCase();
    if (seenNames.has(normalizedName)) {
      errors.push(makeError(rowNumber, `Duplicate product name "${name}" in the file.`));
      return;
    }

    const price = parseNumber(row[priceIndex]);
    const stock = parseNumber(row[stockIndex]);
    const minStockValue = minStockIndex === undefined ? "" : String(row[minStockIndex] ?? "").trim();
    const minStock = minStockIndex === undefined || !minStockValue ? 10 : parseNumber(row[minStockIndex]);
    const isTaxable = taxableIndex === undefined ? false : parseTaxable(row[taxableIndex]);
    const taxRate = taxRateIndex === undefined || !String(row[taxRateIndex] ?? "").trim()
      ? 0
      : parseNumber(row[taxRateIndex]);

    if (price === null || price < 0) {
      errors.push(makeError(rowNumber, "Price must be a valid non-negative number."));
      return;
    }
    if (stock === null || !Number.isInteger(stock) || stock < 0) {
      errors.push(makeError(rowNumber, "Stock must be a valid non-negative whole number."));
      return;
    }
    if (minStock === null || !Number.isInteger(minStock) || minStock < 0) {
      errors.push(makeError(rowNumber, "Min Stock must be a valid non-negative whole number."));
      return;
    }
    if (isTaxable === null) {
      errors.push(makeError(rowNumber, "Taxable must be Yes or No."));
      return;
    }
    if (taxRate === null || taxRate < 0 || taxRate > 100) {
      errors.push(makeError(rowNumber, "Tax Rate must be a number from 0 to 100."));
      return;
    }

    seenNames.add(normalizedName);
    products.push({
      name,
      price,
      stock,
      category: String(categoryIndex === undefined ? "General" : row[categoryIndex] ?? "").trim() || "General",
      minStock,
      isTaxable,
      taxRate: isTaxable ? taxRate : 0,
    });
  });

  return { products, errors };
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

export async function parseProductWorkbook(data: ArrayBuffer): Promise<ProductImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);

  if (workbook.worksheets.length === 0) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const result: ProductImportResult = { products: [], errors: [] };
  const seenNames = new Set<string>();
  let totalRows = 0;

  for (const worksheet of workbook.worksheets) {
    const rows: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        values[columnNumber - 1] = getCellValue(cell.value);
      });
      rows[rowNumber - 1] = values;
    });
    if (rows.length === 0) continue;

    totalRows += rows.length;
    const sheetResult = parseProductRows(rows, worksheet.name, seenNames);
    result.products.push(...sheetResult.products);
    result.errors.push(...sheetResult.errors);
  }

  if (totalRows > MAX_IMPORT_ROWS) {
    return {
      products: [],
      errors: [{ row: 1, message: `Import up to ${MAX_IMPORT_ROWS} product rows at a time.` }],
    };
  }

  return result;
}

export async function readProductImportFile(file: File): Promise<ProductImportResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Choose an Excel file smaller than 10 MB.");
  }

  return parseProductWorkbook(await file.arrayBuffer());
}
