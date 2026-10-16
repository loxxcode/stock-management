import type { Product } from "@/lib/store";

export type ImportedProduct = Omit<Product, "id">;

export interface ProductImportError {
  row: number;
  message: string;
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

export function parseProductRows(rows: unknown[][]): ProductImportResult {
  if (!rows.length) {
    return { products: [], errors: [{ row: 1, message: "The spreadsheet is empty." }] };
  }

  const headerIndexes = new Map<string, number>();
  rows[0].forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized) headerIndexes.set(normalized, index);
  });

  const findColumn = (...names: string[]) =>
    names.map(normalizeHeader).map((name) => headerIndexes.get(name)).find((index) => index !== undefined);

  const nameIndex = findColumn("name", "product", "product name", "productname");
  const priceIndex = findColumn("price", "unit price", "selling price");
  const stockIndex = findColumn("stock", "quantity", "qty");

  if (nameIndex === undefined || priceIndex === undefined || stockIndex === undefined) {
    return {
      products: [],
      errors: [{
        row: 1,
        message: "Include required columns: Name, Price, and Stock (or Quantity).",
      }],
    };
  }

  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return {
      products: [],
      errors: [{ row: 1, message: `Import up to ${MAX_IMPORT_ROWS} product rows at a time.` }],
    };
  }

  const categoryIndex = findColumn("category");
  const minStockIndex = findColumn("min stock", "minimum stock", "minstock");
  const taxableIndex = findColumn("taxable", "is taxable", "charge tax");
  const taxRateIndex = findColumn("tax rate", "taxrate");
  const products: ImportedProduct[] = [];
  const errors: ProductImportError[] = [];
  const seenNames = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const name = String(row[nameIndex] ?? "").trim();
    if (!name && row.every((cell) => String(cell ?? "").trim() === "")) return;
    if (!name) {
      errors.push({ row: rowNumber, message: "Product name is required." });
      return;
    }

    const normalizedName = name.toLocaleLowerCase();
    if (seenNames.has(normalizedName)) {
      errors.push({ row: rowNumber, message: `Duplicate product name "${name}" in the file.` });
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
      errors.push({ row: rowNumber, message: "Price must be a valid non-negative number." });
      return;
    }
    if (stock === null || !Number.isInteger(stock) || stock < 0) {
      errors.push({ row: rowNumber, message: "Stock must be a valid non-negative whole number." });
      return;
    }
    if (minStock === null || !Number.isInteger(minStock) || minStock < 0) {
      errors.push({ row: rowNumber, message: "Min Stock must be a valid non-negative whole number." });
      return;
    }
    if (isTaxable === null) {
      errors.push({ row: rowNumber, message: "Taxable must be Yes or No." });
      return;
    }
    if (taxRate === null || taxRate < 0 || taxRate > 100) {
      errors.push({ row: rowNumber, message: "Tax Rate must be a number from 0 to 100." });
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

export async function readProductImportFile(file: File): Promise<ProductImportResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Choose an Excel file smaller than 10 MB.");
  }

  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const rows = await readXlsxFile(file);
  return parseProductRows(rows as unknown[][]);
}
