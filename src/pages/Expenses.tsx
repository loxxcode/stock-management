import { useState } from "react";
import { Plus, Receipt, Zap, Droplets, Home, MoreHorizontal, TrendingDown, Grid3x3, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useExpenses } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth } from "date-fns";

const categoryIcons: Record<string, React.ReactNode> = {
  Rent: <Home className="h-4 w-4" />,
  Electricity: <Zap className="h-4 w-4" />,
  Water: <Droplets className="h-4 w-4" />,
  Other: <MoreHorizontal className="h-4 w-4" />,
};

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const { role } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<typeof expenses[0] | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const startOfCurrentMonth = startOfMonth(new Date());
  const thisMonthExpenses = expenses.filter(e => new Date(e.date) >= startOfCurrentMonth);
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoriesCount = new Set(expenses.map(e => e.category)).size;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addExpense({
      category: fd.get("category") as string,
      amount: parseFloat(fd.get("amount") as string),
      description: fd.get("description") as string,
      date: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingExpense) {
      console.log('Updating expense:', editingExpense.id, {
        category: editCategory,
        amount: parseFloat(editAmount),
        description: editDescription,
        date: editDate,
      });
      updateExpense(editingExpense.id, {
        category: editCategory,
        amount: parseFloat(editAmount),
        description: editDescription,
        date: editDate,
      });
      setEditDialogOpen(false);
      setEditingExpense(null);
    }
  };

  const handleEdit = (expense: typeof expenses[0]) => {
    setEditingExpense(expense);
    setEditCategory(expense.category);
    setEditAmount(expense.amount.toString());
    setEditDescription(expense.description);
    setEditDate(expense.date);
    setEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (deletingExpenseId) {
      console.log('Deleting expense:', deletingExpenseId);
      deleteExpense(deletingExpenseId);
      setDeleteDialogOpen(false);
      setDeletingExpenseId(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingExpenseId(id);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="pb-24">
      <PageHeader title="Expenses" subtitle="Track business expenses" />

      <div className="px-4 space-y-4 mt-2">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Total Expenses"
            value={`RWF ${totalExpenses.toLocaleString()}`}
            icon={TrendingDown}
            variant="destructive"
            compact
          />
          <StatCard
            title="This Month"
            value={`RWF ${thisMonthTotal.toLocaleString()}`}
            icon={Receipt}
            variant="warning"
            compact
          />
          <StatCard
            title="Categories"
            value={categoriesCount.toString()}
            icon={Grid3x3}
            compact
          />
        </div>
        {(role === "manager" || role === "employee") && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-primary text-primary-foreground gap-2">
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <Select name="category" required defaultValue="Rent">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Electricity">Electricity</SelectItem>
                      <SelectItem value="Water">Water</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div><Label>Description</Label><Input name="description" placeholder="e.g. Monthly rent" required /></div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground">Add Expense</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        <div className="space-y-2">
          {expenses.slice().reverse().map(expense => (
            <div key={expense.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                {categoryIcons[expense.category] || <Receipt className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{expense.description}</p>
                <p className="text-xs text-muted-foreground">{expense.category} · {expense.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-destructive text-sm">-RWF {expense.amount.toLocaleString()}</span>
                {role === "manager" && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(expense)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(expense.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses recorded yet</p>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
            {editingExpense && (
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory} required>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Electricity">Electricity</SelectItem>
                      <SelectItem value="Water">Water</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    placeholder="e.g. Monthly rent"
                    required
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary text-primary-foreground">Update Expense</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Expense
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This will permanently delete this expense. This action cannot be undone.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
