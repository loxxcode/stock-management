import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Package, AlertCircle, FileSpreadsheet, LoaderCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchInput from "@/components/SearchInput";
import CurrencyAmountField from "@/components/CurrencyAmountField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useProducts, Product } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { formatRwf, toRwf, type EntryCurrency } from "@/lib/currency";
import { calculateProductTax } from "@/lib/productTax";
import type { ProductImportResult } from "@/lib/productImport";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function Products() {
  const { products, addProduct, addProducts, updateProduct, deleteProduct, loading: productsLoading } = useProducts();
  const { role, permissions } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);
  const [priceInput, setPriceInput] = useState("");
  const [priceCurrency, setPriceCurrency] = useState<EntryCurrency>("RWF");
  const [isTaxable, setIsTaxable] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState("18");

  const isAddingNew = dialogOpen && !editing;

  const canAdd = role === "admin" || role === "manager" || (permissions && permissions.can_add_product);
  const canEdit = role === "admin" || role === "manager" || (permissions && permissions.can_edit_product);
  const canDelete = role === "admin" || role === "manager" || (permissions && permissions.can_delete_product);

  const debouncedSearch = useDebouncedValue(search);
  const searchTerm = debouncedSearch.trim().toLowerCase();
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm) ||
    p.category.toLowerCase().includes(searchTerm)
  );
  const { importableProducts, existingDuplicates } = useMemo(() => {
    const existingNames = new Set(products.map((product) => product.name.trim().toLocaleLowerCase()));
    const importable: NonNullable<typeof importResult>["products"] = [];
    const duplicates: string[] = [];

    (importResult?.products ?? []).forEach((product) => {
      if (existingNames.has(product.name.trim().toLocaleLowerCase())) {
        duplicates.push(product.name);
      } else {
        importable.push(product);
      }
    });

    return { importableProducts: importable, existingDuplicates: duplicates };
  }, [importResult, products]);
  const previewPriceRwf = toRwf(parseFloat(priceInput) || 0, priceCurrency);
  const previewTaxRwf = calculateProductTax(previewPriceRwf, isTaxable, parseFloat(taxRateInput) || 0);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportLoading(true);
    setImportResult(null);
    try {
      const { readProductImportFile } = await import("@/lib/productImport");
      setImportResult(await readProductImportFile(file));
    } catch (error) {
      console.error("Could not read product spreadsheet:", error);
      toast.error(error instanceof Error ? error.message : "Could not read the Excel file.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    try {
      const { createProductImportTemplate } = await import("@/lib/productImport");
      const template = await createProductImportTemplate();
      const url = URL.createObjectURL(new Blob([template], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "product-import-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Could not create product import template:", error);
      toast.error(error instanceof Error ? error.message : "Could not create the Excel template.");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleImportProducts = async () => {
    if (!importableProducts.length) return;

    setImportLoading(true);
    try {
      const result = await addProducts(importableProducts);
      if (result.error) {
        toast.error(`Products were not imported: ${result.error}`);
        return;
      }

      const rejectedCount = (importResult?.errors.length ?? 0) + existingDuplicates.length;
      toast.success(
        `Imported ${result.added} product${result.added === 1 ? "" : "s"}${rejectedCount ? `; skipped ${rejectedCount} row${rejectedCount === 1 ? "" : "s"}` : ""}.`
      );
      setImportDialogOpen(false);
      setImportResult(null);
    } catch (error) {
      console.error("Could not import products:", error);
      toast.error(error instanceof Error ? error.message : "Could not import products.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      price: toRwf(parseFloat(priceInput) || 0, priceCurrency),
      stock: parseInt(fd.get("stock") as string),
      category: fd.get("category") as string,
      minStock: parseInt(fd.get("minStock") as string),
      isTaxable,
      taxRate: isTaxable ? Math.min(100, Math.max(0, parseFloat(taxRateInput) || 0)) : 0,
    };

    if (editing) {
      // Add new stock to existing stock instead of replacing
      const updatedData = {
        ...data,
        stock: editing.stock + data.stock
      };
      setSavingProduct(true);
      try {
        const updated = await updateProduct(editing.id, updatedData);
        if (!updated) {
          toast.error("Could not update product. Check your permissions and try again.");
          return;
        }
        setEditing(null);
        setDialogOpen(false);
      } catch (error) {
        console.error("Could not update product:", error);
        toast.error(error instanceof Error ? error.message : "Could not update product.");
      } finally {
        setSavingProduct(false);
      }
    } else {
      // Check if product with same name already exists
      const existingProduct = products.find(p => 
        p.name.toLowerCase() === data.name.toLowerCase()
      );

      if (existingProduct) {
        // Product exists, show confirmation dialog
        setDuplicateProduct(existingProduct);
        setPendingData(data);
        setConfirmDialogOpen(true);
      } else {
        // New product, add it
        setSavingProduct(true);
        try {
          const created = await addProduct(data);
          if (!created) {
            toast.error("Could not add product. Check your permissions and try again.");
            return;
          }
          setDialogOpen(false);
        } catch (error) {
          console.error("Could not add product:", error);
          toast.error(error instanceof Error ? error.message : "Could not add product.");
        } finally {
          setSavingProduct(false);
        }
      }
    }
  };

  const handleUpdateExisting = async () => {
    if (duplicateProduct && pendingData) {
      // Add new stock to existing stock instead of replacing
      const updatedData = {
        ...pendingData,
        stock: duplicateProduct.stock + pendingData.stock
      };
      setSavingProduct(true);
      try {
        const updated = await updateProduct(duplicateProduct.id, updatedData);
        if (!updated) {
          toast.error("Could not update product. Check your permissions and try again.");
          return;
        }
        setDuplicateProduct(null);
        setPendingData(null);
        setConfirmDialogOpen(false);
        setDialogOpen(false);
      } catch (error) {
        console.error("Could not update product:", error);
        toast.error(error instanceof Error ? error.message : "Could not update product.");
      } finally {
        setSavingProduct(false);
      }
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateProduct(null);
    setPendingData(null);
    setConfirmDialogOpen(false);
  };

  return (
    <div className="pb-24">
      <PageHeader title="Products" subtitle={productsLoading ? "Loading products..." : `${products.length} items`} />

      <div className="px-4 space-y-4 mt-2">
        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchInput
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              isSearching={search.trim() !== debouncedSearch.trim()}
              disabled={isAddingNew}
            />
          </div>
          {canAdd && (
            <Dialog
              open={importDialogOpen}
              onOpenChange={(open) => {
                if (!importLoading && !templateLoading) {
                  setImportDialogOpen(open);
                  if (!open) setImportResult(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="shrink-0 gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">Import Excel</span>
                  <span className="sm:hidden">Import</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] rounded-2xl sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Import Products from Excel</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Upload an .xlsx file. Its first row must include Name, Price, and Stock (or Quantity).
                    Category, Min Stock, Taxable, and Tax Rate are optional. Prices are treated as RWF.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleDownloadTemplate}
                    loading={templateLoading}
                    disabled={importLoading}
                  >
                    <Download className="h-4 w-4" />
                    Download Excel template
                  </Button>
                  <Input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleImportFile}
                    disabled={importLoading}
                  />
                  {importLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Processing products...
                    </div>
                  )}
                  {importResult && (
                    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        {importableProducts.length} ready to import
                        {importResult.errors.length > 0 && ` · ${importResult.errors.length} invalid rows`}
                        {existingDuplicates.length > 0 && ` · ${existingDuplicates.length} existing products skipped`}
                      </p>
                      {existingDuplicates.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Already in inventory: {existingDuplicates.slice(0, 5).join(", ")}
                          {existingDuplicates.length > 5 ? ` and ${existingDuplicates.length - 5} more` : ""}
                        </p>
                      )}
                      {importResult.errors.length > 0 && (
                        <ul className="space-y-1 text-xs text-destructive">
                          {importResult.errors.slice(0, 8).map((item) => (
                            <li key={`${item.sheetName ?? ""}-${item.row}-${item.message}`}>
                              {item.sheetName ? `Sheet "${item.sheetName}", ` : ""}Row {item.row}: {item.message}
                            </li>
                          ))}
                          {importResult.errors.length > 8 && (
                            <li>And {importResult.errors.length - 8} more invalid rows.</li>
                          )}
                        </ul>
                      )}
                      {importableProducts.length > 0 && (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {importableProducts.slice(0, 5).map((product, index) => (
                            <li key={`${product.name}-${index}`}>
                              {product.name} · {formatRwf(product.price)} · Stock {product.stock}
                            </li>
                          ))}
                          {importableProducts.length > 5 && (
                            <li>And {importableProducts.length - 5} more products.</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={handleImportProducts}
                    loading={importLoading}
                    disabled={importableProducts.length === 0}
                  >
                    Import {importableProducts.length} Product{importableProducts.length === 1 ? "" : "s"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {canAdd && (
            <Dialog open={dialogOpen} onOpenChange={(o) => {
              setDialogOpen(o);
              if (o) {
                setPriceInput("");
                setPriceCurrency("RWF");
                setIsTaxable(false);
                setTaxRateInput("18");
              } else {
                setEditing(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="icon" className="shrink-0 bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
                  <CurrencyAmountField
                    label="Price"
                    value={priceInput}
                    onChange={setPriceInput}
                    currency={priceCurrency}
                    onCurrencyChange={setPriceCurrency}
                    step="0.01"
                    required
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="product-taxable"
                      type="checkbox"
                      checked={isTaxable}
                      onChange={(event) => setIsTaxable(event.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="product-taxable">Charge tax on this product</Label>
                  </div>
                  {isTaxable && (
                    <div>
                      <Label htmlFor="product-tax-rate">Tax rate (%)</Label>
                      <Input
                        id="product-tax-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxRateInput}
                        onChange={(event) => setTaxRateInput(event.target.value)}
                        required
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRwf(previewPriceRwf)} × {parseFloat(taxRateInput) || 0}% = {formatRwf(previewTaxRwf)} tax per unit; total with tax: {formatRwf(previewPriceRwf + previewTaxRwf)}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Stock</Label><Input name="stock" type="number" defaultValue={editing?.stock} required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Category</Label><Input name="category" defaultValue={editing?.category || "General"} required /></div>
                    <div><Label>Min Stock</Label><Input name="minStock" type="number" defaultValue={editing?.minStock || 10} required /></div>
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground" loading={savingProduct}>
                    {savingProduct ? "Saving..." : editing ? "Update" : "Add Product"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Confirmation Dialog for Duplicate Product */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Product Already Exists
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  A product named <span className="font-semibold text-foreground">{duplicateProduct?.name}</span> already exists.
                </p>
                <div className="p-3 bg-secondary rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground">Current details:</p>
                  <p className="text-sm">Price: RWF {duplicateProduct?.price.toLocaleString()}</p>
                  <p className="text-sm">Tax: {duplicateProduct?.isTaxable ? `${duplicateProduct.taxRate}%` : "Not charged"}</p>
                  <p className="text-sm">Stock: {duplicateProduct?.stock}</p>
                  <p className="text-sm">Category: {duplicateProduct?.category}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Would you like to update the existing product with the new details?
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleCancelDuplicate}
                  className="flex-1"
                >
                  Change Name
                </Button>
                <Button 
                  onClick={handleUpdateExisting}
                  className="flex-1 bg-primary text-primary-foreground"
                  loading={savingProduct}
                >
                  {savingProduct ? "Updating..." : "Update Existing"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Product List */}
        <div className="space-y-2" aria-busy={productsLoading}>
          {productsLoading ? (
            <div className="space-y-2" role="status" aria-label="Loading products">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-xl border border-border bg-muted/50" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground" role="status">
              {searchTerm ? "No products match your search." : "No products added yet."}
            </p>
          ) : filtered.map(product => (
            <div key={product.id} className={cn(
              "flex items-center gap-3 p-3 rounded-xl border border-border bg-card",
              isAddingNew && "opacity-50 pointer-events-none"
            )}>
              <div className={cn(
                "p-2.5 rounded-lg",
                product.stock <= product.minStock ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              )}>
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.category} · Stock: {product.stock}</p>
                <p className="text-xs text-muted-foreground">
                  {product.isTaxable
                    ? `Tax ${product.taxRate}%: ${formatRwf(calculateProductTax(product.price, true, product.taxRate))} per unit`
                    : "Tax not charged"}
                </p>
              </div>
              <span className="font-semibold text-foreground text-sm">RWF {product.price.toLocaleString()}</span>
              <div className="flex gap-1">
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditing(product);
                      setPriceInput(product.price.toString());
                      setPriceCurrency("RWF");
                      setIsTaxable(product.isTaxable);
                      setTaxRateInput(product.taxRate.toString());
                      setDialogOpen(true);
                    }}
                    disabled={isAddingNew || deletingProductId === product.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={async () => {
                      setDeletingProductId(product.id);
                      try {
                        const deleted = await deleteProduct(product.id);
                        if (!deleted) toast.error("Could not delete product. Check your permissions and try again.");
                      } catch (error) {
                        console.error("Could not delete product:", error);
                        toast.error(error instanceof Error ? error.message : "Could not delete product.");
                      } finally {
                        setDeletingProductId(null);
                      }
                    }}
                    disabled={isAddingNew || deletingProductId !== null}
                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingProductId === product.id
                      ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
