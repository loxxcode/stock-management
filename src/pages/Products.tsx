import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Package, AlertCircle, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencyAmountField from "@/components/CurrencyAmountField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useProducts, Product } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { formatRwf, toRwf, type EntryCurrency } from "@/lib/currency";
import { calculateProductTax } from "@/lib/productTax";
import { readProductImportFile, type ProductImportResult } from "@/lib/productImport";
import { toast } from "sonner";

export default function Products() {
  const { products, addProduct, addProducts, updateProduct, deleteProduct } = useProducts();
  const { role, permissions } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
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
      setImportResult(await readProductImportFile(file));
    } catch (error) {
      console.error("Could not read product spreadsheet:", error);
      toast.error(error instanceof Error ? error.message : "Could not read the Excel file.");
    } finally {
      setImportLoading(false);
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
      updateProduct(editing.id, updatedData);
      setEditing(null);
      setDialogOpen(false);
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
        addProduct(data);
        setDialogOpen(false);
      }
    }
  };

  const handleUpdateExisting = () => {
    if (duplicateProduct && pendingData) {
      // Add new stock to existing stock instead of replacing
      const updatedData = {
        ...pendingData,
        stock: duplicateProduct.stock + pendingData.stock
      };
      updateProduct(duplicateProduct.id, updatedData);
      setDuplicateProduct(null);
      setPendingData(null);
      setConfirmDialogOpen(false);
      setDialogOpen(false);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateProduct(null);
    setPendingData(null);
    setConfirmDialogOpen(false);
  };

  return (
    <div className="pb-24">
      <PageHeader title="Products" subtitle={`${products.length} items`} />

      <div className="px-4 space-y-4 mt-2">
        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              disabled={isAddingNew}
            />
          </div>
          {canAdd && (
            <Dialog
              open={importDialogOpen}
              onOpenChange={(open) => {
                setImportDialogOpen(open);
                if (!open) setImportResult(null);
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
                            <li key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</li>
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
                    disabled={importLoading || importableProducts.length === 0}
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
                  <Button type="submit" className="w-full bg-primary text-primary-foreground">{editing ? "Update" : "Add Product"}</Button>
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
                >
                  Update Existing
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Product List */}
        <div className="space-y-2">
          {filtered.map(product => (
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
                    disabled={isAddingNew}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => deleteProduct(product.id)}
                    disabled={isAddingNew}
                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
