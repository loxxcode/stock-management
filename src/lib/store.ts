// Supabase-backed store hooks
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCreditStatus, getVisibleCreditUserIds } from "@/lib/credit";
import type { AppRole } from "@/contexts/AuthContext";

// Use the project's Supabase client (cast to any for tables not yet in generated types)
const db = supabase as any;

// ---------- Types ----------

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  minStock: number;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  date: string;
  employeeName: string;
  source?: "sale" | "loan_payment";
  customerName?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface CustomerCredit {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  amountDue: number;
  paidAmount: number;
  status: "open" | "partial" | "paid" | "completed";
  date: string;
  dueDate: string;
  employeeName: string;
  note?: string;
}

export interface CustomerCreditPayment {
  id: string;
  creditId: string;
  amount: number;
  paidOn: string;
  employeeName: string;
  note?: string;
}

export interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  type: "in" | "out";
  quantity: number;
  date: string;
  note: string;
}

// ---------- Helper ----------

async function getUserId(): Promise<string | null> {
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}

async function getUserRole(): Promise<AppRole | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return data?.role as AppRole ?? null;
}

async function getUserFullName(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await db.from("profiles").select("full_name").eq("user_id", userId).single();
  return data?.full_name ?? null;
}

// Audit logging function
async function logAuditEvent(
  action: string,
  entity: string | null = null,
  entityId: string | null = null,
  oldValue: any = null,
  newValue: any = null,
  description: string | null = null
) {
  const userId = await getUserId();
  const role = await getUserRole();
  if (!userId || !role) return;

  try {
    await db.rpc('log_audit_event', {
      p_user_id: userId,
      p_user_role: role,
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId,
      p_old_value: oldValue,
      p_new_value: newValue,
      p_description: description
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// ---------- useProducts ----------

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const userId = await getUserId();
      const role = await getUserRole();
      if (!userId) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Single query for all roles - admin can see all product data
      const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } else if (data) {
        setProducts(
          data.map((r: any) => ({
            id: r.id,
            name: r.name,
            price: Number(r.price),
            stock: Number(r.stock),
            category: r.category ?? "General",
            minStock: Number(r.min_stock ?? 10),
          }))
        );
      }
    } catch (error) {
      console.error('Error in fetchProducts:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchProducts();

    const { data: authListener } = db.auth.onAuthStateChange((event, session) => {
      if (isMounted && (event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
        fetchProducts();
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProducts]);

  const addProduct = async (p: Omit<Product, "id">) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;
    
    // Only managers can add products
    if (role !== 'manager') {
      console.error('Only managers can add products');
      return;
    }

    const { data, error } = await db
      .from("products")
      .insert({
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        min_stock: p.minStock,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      await logAuditEvent('create', 'product', data.id, null, data, `Created product: ${data.name}`);
      setProducts((prev) => [
        {
          id: data.id,
          name: data.name,
          price: Number(data.price),
          stock: Number(data.stock),
          category: data.category ?? "General",
          minStock: Number(data.min_stock ?? 10),
        },
        ...prev,
      ]);
    }
  };

  const updateProduct = async (id: string, p: Partial<Product>) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;
    
    // Only managers can update products
    if (role !== 'manager') {
      console.error('Only managers can update products');
      return;
    }

    const updates: any = {};
    if (p.name !== undefined) updates.name = p.name;
    if (p.price !== undefined) updates.price = p.price;
    if (p.stock !== undefined) updates.stock = p.stock;
    if (p.category !== undefined) updates.category = p.category;
    if (p.minStock !== undefined) updates.min_stock = p.minStock;

    const { error } = await db.from("products").update(updates).eq("id", id);
    if (!error) {
      await logAuditEvent('update', 'product', id, null, updates, `Updated product: ${id}`);
      setProducts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...p } : item))
      );
    }
  };

  const deleteProduct = async (id: string) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;
    
    // Only managers can delete products
    if (role !== 'manager') {
      console.error('Only managers can delete products');
      return;
    }

    const { error } = await db.from("products").delete().eq("id", id);
    if (!error) {
      await logAuditEvent('delete', 'product', id, null, null, `Deleted product: ${id}`);
      setProducts((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return { products, addProduct, updateProduct, deleteProduct, setProducts, loading };
}

// ---------- useSales ----------

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    try {
      const userId = await getUserId();
      const role = await getUserRole();
      if (!userId) {
        setSales([]);
        setLoading(false);
        return;
      }

      let query = db.from("sales").select("*").order("created_at", { ascending: false });

      // Employees only see their own sales
      if (role === 'employee') {
        query = query.eq("employee_id", userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sales:', error);
        setSales([]);
      } else if (data) {
        setSales(
          data.map((r: any) => ({
            id: r.id,
            productId: r.product_id,
            productName: r.product_name,
            quantity: Number(r.quantity ?? 1),
            total: Number(r.total ?? 0),
            date: r.date,
            employeeName: r.employee_name ?? "Unknown",
            source: (r.source as "sale" | "loan_payment") ?? "sale",
            customerName: r.customer_name ?? undefined,
          }))
        );
      }
    } catch (error) {
      console.error('Error in fetchSales:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchSales();

    return () => {
      isMounted = false;
    };
  }, [fetchSales]);

  const addSale = async (s: Omit<Sale, "id">) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;
    
    // Admin cannot create sales
    if (role === 'admin') {
      console.error('Admins cannot create sales');
      return;
    }

    const fullName = s.employeeName || (await getUserFullName()) || "Unknown";
    const source = s.source ?? "sale";
    
    // Get manager_id if employee
    let managerId = null;
    if (role === 'employee') {
      const { data: permData } = await db
        .from("employee_permissions")
        .select("manager_user_id")
        .eq("employee_user_id", userId)
        .maybeSingle();
      managerId = permData?.manager_user_id || null;
    }

    const { data, error } = await db
      .from("sales")
      .insert({
        product_id: s.productId,
        product_name: s.productName,
        quantity: s.quantity,
        total: s.total,
        date: s.date,
        employee_name: fullName,
        employee_id: userId,
        manager_id: managerId,
        source,
        customer_name: s.customerName ?? null,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      await logAuditEvent('create', 'sale', data.id, null, data, `Created sale: ${data.product_name}`);
      setSales((prev) => [
        {
          id: data.id,
          productId: data.product_id,
          productName: data.product_name,
          quantity: Number(data.quantity),
          total: Number(data.total),
          date: data.date,
          employeeName: data.employee_name ?? fullName,
          source: (data.source as "sale" | "loan_payment") ?? source,
          customerName: data.customer_name ?? s.customerName,
        },
        ...prev,
      ]);
    }
  };

  return { sales, addSale, loading };
}

// ---------- useCustomerCredits ----------

export function useCustomerCredits() {
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [paymentsByCredit, setPaymentsByCredit] = useState<Record<string, CustomerCreditPayment[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) {
      setCredits([]);
      setLoading(false);
      return;
    }

    try {
      const { data: roleData } = await db.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      const role = roleData?.role ?? "employee";

      let visibilityUserIds: string[] | null = null;
      if (role !== "admin") {
        const { data: employeeLinks } = await db
          .from("employee_permissions")
          .select("manager_user_id, employee_user_id")
          .or(`manager_user_id.eq.${userId},employee_user_id.eq.${userId}`);

        visibilityUserIds = getVisibleCreditUserIds(userId, role, employeeLinks ?? []);
      }

      let query = db.from("customer_credits").select("*").order("created_at", { ascending: false });

      if (visibilityUserIds && visibilityUserIds.length) {
        query = query.in("user_id", visibilityUserIds);
      }

      const { data, error } = await query;

      if (error) {
        const missingTable = ["42P01", "42501", "406", "404"].includes(String(error.code ?? "")) || /does not exist|permission denied|relation .*customer_credits/i.test(error.message ?? "");
        if (missingTable) {
          console.warn("customer_credits table is not available yet:", error.message);
          setCredits([]);
          setLoading(false);
          return;
        }
        console.error("Failed to fetch customer credits:", error);
      }

      if (data) {
        setCredits(
          data.map((r: any) => ({
            id: r.id,
            customerName: r.customer_name ?? "Unknown customer",
            productName: r.product_name ?? "Product",
            quantity: Number(r.quantity ?? 1),
            amountDue: Number(r.amount_due ?? 0),
            paidAmount: Number(r.paid_amount ?? 0),
            status: (r.status as "open" | "partial" | "paid" | "completed") ?? "open",
            date: r.date,
            dueDate: r.due_date ?? r.date,
            employeeName: r.employee_name ?? "Unknown",
            note: r.note ?? "",
          }))
        );
      }
    } catch (error: any) {
      console.warn("customer_credits unavailable:", error?.message ?? error);
      setCredits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCreditPayments = useCallback(async (creditId: string) => {
    const userId = await getUserId();
    if (!userId) return [] as CustomerCreditPayment[];

    try {
      const { data, error } = await db
        .from("customer_credit_payments")
        .select("*")
        .eq("credit_id", creditId)
        .order("paid_on", { ascending: false });

      if (error) {
        const missingTable = ["42P01", "42501", "406", "404"].includes(String(error.code ?? "")) || /does not exist|permission denied|relation .*customer_credit_payments/i.test(error.message ?? "");
        if (missingTable) {
          console.warn("customer_credit_payments table is not available yet:", error.message);
          setPaymentsByCredit((prev) => ({ ...prev, [creditId]: [] }));
          return [] as CustomerCreditPayment[];
        }
        console.error("Failed to fetch customer credit payments:", error);
      }

      const mapped = (data ?? []).map((r: any) => ({
        id: r.id,
        creditId: r.credit_id,
        amount: Number(r.amount ?? 0),
        paidOn: r.paid_on,
        employeeName: r.employee_name ?? "Unknown",
        note: r.note ?? "",
      }));

      setPaymentsByCredit((prev) => ({ ...prev, [creditId]: mapped }));
      return mapped;
    } catch (error: any) {
      console.warn("customer_credit_payments unavailable:", error?.message ?? error);
      setPaymentsByCredit((prev) => ({ ...prev, [creditId]: [] }));
      return [] as CustomerCreditPayment[];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchCredits();

    return () => {
      isMounted = false;
    };
  }, [fetchCredits]);

  const addCustomerCredit = async (c: Omit<CustomerCredit, "id" | "status" | "paidAmount" > & { paidAmount?: number; status?: "open" | "partial" | "paid" }) => {
    const userId = await getUserId();
    if (!userId) return;
    const fullName = c.employeeName || (await getUserFullName()) || "Unknown";
    const amountDue = Number(c.amountDue ?? 0);
    const paidAmount = Number(c.paidAmount ?? 0);
    const dueDate = c.dueDate || c.date;
    const status = c.status ?? getCreditStatus(amountDue, paidAmount);

    const { data, error } = await db
      .from("customer_credits")
      .insert({
        customer_name: c.customerName,
        product_name: c.productName,
        quantity: c.quantity,
        amount_due: amountDue,
        paid_amount: paidAmount,
        status,
        date: c.date,
        due_date: dueDate,
        note: c.note ?? "",
        employee_name: fullName,
        user_id: userId,
      })
      .select()
      .single();

    if (!error && data) {
      await db.from("sales").insert({
        product_id: null,
        product_name: `Loan - ${c.customerName}`,
        quantity: c.quantity,
        total: amountDue,
        date: c.date,
        employee_name: fullName,
        source: "loan",
        customer_name: c.customerName,
        user_id: userId,
      });
      setCredits((prev) => [
        {
          id: data.id,
          customerName: data.customer_name ?? c.customerName,
          productName: data.product_name ?? c.productName,
          quantity: Number(data.quantity ?? c.quantity),
          amountDue: Number(data.amount_due ?? amountDue),
          paidAmount: Number(data.paid_amount ?? paidAmount),
          status: (data.status as "open" | "partial" | "paid" | "completed") ?? status,
          date: data.date,
          dueDate: data.due_date ?? dueDate,
          employeeName: data.employee_name ?? fullName,
          note: data.note ?? c.note ?? "",
        },
        ...prev,
      ]);
    }
  };

  const updateCustomerCredit = async (id: string, updates: Partial<Pick<CustomerCredit, "amountDue" | "paidAmount" | "status">>) => {
    const userId = await getUserId();
    if (!userId) return;

    const payload: any = {};
    if (updates.amountDue !== undefined) payload.amount_due = updates.amountDue;
    if (updates.paidAmount !== undefined) payload.paid_amount = updates.paidAmount;
    if (updates.status !== undefined) payload.status = updates.status;

    const currentRecord = credits.find((credit) => credit.id === id);
    if (currentRecord && updates.paidAmount !== undefined) {
      const nextStatus = getCreditStatus(
        updates.amountDue ?? currentRecord.amountDue,
        updates.paidAmount
      );
      payload.status = nextStatus;
    } else if (updates.status !== undefined) {
      payload.status = updates.status;
    }

    const { data, error } = await db
      .from("customer_credits")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      setCredits((prev) =>
        prev.map((credit) =>
          credit.id === id
            ? {
                ...credit,
                amountDue: Number(data.amount_due ?? credit.amountDue),
                paidAmount: Number(data.paid_amount ?? credit.paidAmount),
                status: (data.status as "open" | "partial" | "paid" | "completed") ?? credit.status,
              }
            : credit
        )
      );
    }
  };

  const recordPayment = async (creditId: string, amount: number, employeeName?: string, note?: string) => {
    const userId = await getUserId();
    if (!userId || amount <= 0) return;

    const currentCredit = credits.find((credit) => credit.id === creditId);
    if (!currentCredit) return;

    const fullName = employeeName || (await getUserFullName()) || "Unknown";
    const paidOn = new Date().toISOString().split("T")[0];

    const { data, error } = await db
      .from("customer_credit_payments")
      .insert({
        credit_id: creditId,
        amount,
        paid_on: paidOn,
        employee_name: fullName,
        note: note ?? "",
        user_id: userId,
      })
      .select()
      .single();

    if (error || !data) return;

    const nextPaidAmount = Number(currentCredit.paidAmount || 0) + amount;
    const nextStatus = getCreditStatus(currentCredit.amountDue, nextPaidAmount);

    await updateCustomerCredit(creditId, {
      paidAmount: nextPaidAmount,
      status: nextStatus,
    });

    const paymentEntry: CustomerCreditPayment = {
      id: data.id,
      creditId: creditId,
      amount: Number(data.amount ?? amount),
      paidOn: data.paid_on ?? paidOn,
      employeeName: data.employee_name ?? fullName,
      note: data.note ?? note ?? "",
    };

    setPaymentsByCredit((prev) => ({
      ...prev,
      [creditId]: [paymentEntry, ...(prev[creditId] ?? [])],
    }));

    await db.from("sales").insert({
      product_id: null,
      product_name: `Loan payment - ${currentCredit.customerName}`,
      quantity: 1,
      total: amount,
      date: paidOn,
      employee_name: fullName,
      user_id: userId,
    });
  };

  return { credits, paymentsByCredit, addCustomerCredit, updateCustomerCredit, recordPayment, fetchCreditPayments, loading };
}

// ---------- useExpenses ----------

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    try {
      const userId = await getUserId();
      const role = await getUserRole();
      if (!userId) {
        setExpenses([]);
        setLoading(false);
        return;
      }

      // Managers, admins, and employees can view expenses
      if (role !== 'manager' && role !== 'admin' && role !== 'employee') {
        setExpenses([]);
        setLoading(false);
        return;
      }

      const { data, error } = await db
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching expenses:', error);
        setExpenses([]);
      } else if (data) {
        setExpenses(
          data.map((r: any) => ({
            id: r.id,
            category: r.category,
            amount: Number(r.amount),
            description: r.description ?? "",
            date: r.date,
          }))
        );
      }
    } catch (error) {
      console.error('Error in fetchExpenses:', error);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchExpenses();

    const { data: authListener } = db.auth.onAuthStateChange((event, session) => {
      if (isMounted && (event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
        fetchExpenses();
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchExpenses]);

  const addExpense = async (e: Omit<Expense, "id">) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;

    // Managers and employees can add expenses
    if (role !== 'manager' && role !== 'employee') {
      console.error('Only managers and employees can add expenses');
      return;
    }

    const { data, error } = await db
      .from("expenses")
      .insert({
        category: e.category,
        amount: e.amount,
        description: e.description,
        date: e.date,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      await logAuditEvent('create', 'expense', data.id, null, data, `Created expense: ${data.category}`);
      setExpenses((prev) => [
        {
          id: data.id,
          category: data.category,
          amount: Number(data.amount),
          description: data.description ?? "",
          date: data.date,
        },
        ...prev,
      ]);
    }
  };

  const updateExpense = async (id: string, e: Omit<Expense, "id">) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;

    // Only managers can update expenses
    if (role !== 'manager') {
      console.error('Only managers can update expenses');
      return;
    }

    console.log('Updating expense:', id, e);
    const { data, error } = await db
      .from("expenses")
      .update({
        category: e.category,
        amount: e.amount,
        description: e.description,
        date: e.date,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error('Error updating expense:', error);
      return;
    }

    if (data) {
      console.log('Expense updated successfully:', data);
      await logAuditEvent('update', 'expense', data.id, null, data, `Updated expense: ${data.category}`);
      setExpenses((prev) =>
        prev.map((expense) =>
          expense.id === id
            ? {
                id: data.id,
                category: data.category,
                amount: Number(data.amount),
                description: data.description ?? "",
                date: data.date,
              }
            : expense
        )
      );
    }
  };

  const deleteExpense = async (id: string) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;

    // Only managers can delete expenses
    if (role !== 'manager') {
      console.error('Only managers can delete expenses');
      return;
    }

    console.log('Deleting expense:', id);
    const { data, error } = await db
      .from("expenses")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting expense:', error);
      return;
    }

    if (data) {
      console.log('Expense deleted successfully:', data);
      await logAuditEvent('delete', 'expense', id, data, null, `Deleted expense: ${data.category}`);
      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    } else {
      console.log('No data returned from delete, but no error. Removing from local state.');
      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    }
  };

  return { expenses, addExpense, updateExpense, deleteExpense, loading };
}

// ---------- useStockEntries ----------

export function useStockEntries() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const userId = await getUserId();
      const role = await getUserRole();
      if (!userId) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Admin and managers can view stock entries
      if (role !== 'manager' && role !== 'admin') {
        setEntries([]);
        setLoading(false);
        return;
      }

      const { data, error } = await db
        .from("stock_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching stock entries:', error);
        setEntries([]);
      } else if (data) {
        setEntries(
          data.map((r: any) => ({
            id: r.id,
            productId: r.product_id,
            productName: r.product_name,
            type: r.type as "in" | "out",
            quantity: Number(r.quantity),
            date: r.date,
            note: r.note ?? "",
          }))
        );
      }
    } catch (error) {
      console.error('Error in fetchEntries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchEntries();

    return () => {
      isMounted = false;
    };
  }, [fetchEntries]);

  const addEntry = async (e: Omit<StockEntry, "id">) => {
    const userId = await getUserId();
    const role = await getUserRole();
    if (!userId) return;
    
    // Only managers can add stock entries
    if (role !== 'manager') {
      console.error('Only managers can add stock entries');
      return;
    }

    const { data, error } = await db
      .from("stock_entries")
      .insert({
        product_id: e.productId,
        product_name: e.productName,
        type: e.type,
        quantity: e.quantity,
        date: e.date,
        note: e.note,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      await logAuditEvent('create', 'stock_entry', data.id, null, data, `Created stock entry: ${e.type}`);
      setEntries((prev) => [
        {
          id: data.id,
          productId: data.product_id,
          productName: data.product_name,
          type: data.type as "in" | "out",
          quantity: Number(data.quantity),
          date: data.date,
          note: data.note ?? "",
        },
        ...prev,
      ]);
    }
  };

  return { entries, addEntry, loading };
}
