import { useState, useEffect, useMemo } from "react";
import { UserPlus, Users, Shield, Trash2, Search, TrendingUp, Activity, Package, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface EmployeeWithProfile {
  employee_user_id: string;
  full_name: string;
  employee_name?: string;
  email: string;
  can_record_sales: boolean;
  can_view_stock: boolean;
  can_add_product: boolean;
  can_add_stock: boolean;
  can_remove_stock: boolean;
  can_view_sales: boolean;
  can_edit_product: boolean;
  can_delete_product: boolean;
  can_add_expenses: boolean;
}

interface ManagerSummary {
  user_id: string;
  full_name: string;
  employeeCount: number;
  salesToday: number;
  sales30d: number;
  stockUnits: number;
  activityCount: number;
}

const PERMISSION_LABELS: Record<string, string> = {
  can_record_sales: "Record Sales",
  can_view_stock: "View Stock",
  can_add_product: "Add Products",
  can_add_stock: "Stock In",
  can_remove_stock: "Stock Out",
  can_view_sales: "View Sales",
  can_edit_product: "Edit Products",
  can_delete_product: "Delete Products",
  can_add_expenses: "Add Expenses",
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  can_record_sales: "Record sales transactions",
  can_view_stock: "View stock levels and entries",
  can_add_product: "Add new products",
  can_add_stock: "Add stock entries",
  can_remove_stock: "Remove stock entries",
  can_view_sales: "View sales history",
  can_edit_product: "Edit product details",
  can_delete_product: "Remove products from inventory",
  can_add_expenses: "Record expenses",
};

const FULL_ACCESS_PERMISSIONS = {
  can_record_sales: true,
  can_view_stock: true,
  can_add_product: true,
  can_add_stock: true,
  can_remove_stock: true,
  can_view_sales: true,
  can_edit_product: true,
  can_delete_product: true,
  can_add_expenses: true,
};

const dbToUiPermissions = (row: any) => ({
  can_record_sales: row.can_record_sales,
  can_view_stock: row.can_view_stock,
  can_add_product: row.can_add_product,
  can_edit_product: row.can_edit_product,
  can_delete_product: row.can_delete_product,
  can_view_sales: row.can_view_sales,
  can_add_stock: row.can_add_stock,
  can_remove_stock: row.can_remove_stock,
  can_add_expenses: row.can_add_expenses,
  can_view_expenses: row.can_view_expenses,
});

const uiToDbPermissions = (perms: Partial<typeof FULL_ACCESS_PERMISSIONS>) => ({
  can_record_sales: perms.can_record_sales,
  can_view_stock: perms.can_view_stock,
  can_add_product: perms.can_add_product,
  can_edit_product: perms.can_edit_product,
  can_delete_product: perms.can_delete_product,
  can_view_sales: perms.can_view_sales,
  can_add_stock: perms.can_add_stock,
  can_remove_stock: perms.can_remove_stock,
  can_add_expenses: perms.can_add_expenses,
  can_view_expenses: perms.can_view_expenses,
});

export default function Employees() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
  const [managers, setManagers] = useState<ManagerSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [perms, setPerms] = useState({ ...FULL_ACCESS_PERMISSIONS });
  const [searchQuery, setSearchQuery] = useState("");
  const [employeePerformance, setEmployeePerformance] = useState<Record<string, any>>({});
  const [managerSearchQuery, setManagerSearchQuery] = useState("");

  const isAdminView = role === "admin";

  useEffect(() => {
    if (role !== "manager" && role !== "admin") return;
    if (role === "admin") {
      fetchManagers();
      return;
    }
    fetchEmployees();
  }, [role]);

  const fetchEmployees = async () => {
    if (!user) return;
    const { data: empPerms } = await (supabase
      .from("employee_permissions" as any) as any)
      .select("*")
      .eq("manager_user_id", user.id);

    if (!empPerms?.length) {
      setEmployees([]);
      return;
    }

    const empIds = empPerms.map((e) => e.employee_user_id);
    const { data: profiles } = await (supabase
      .from("profiles" as any) as any)
      .select("*")
      .in("user_id", empIds);

    const result: EmployeeWithProfile[] = empPerms.map((ep) => {
      const prof = profiles?.find((p) => p.user_id === ep.employee_user_id);
      return {
        employee_user_id: ep.employee_user_id,
        full_name: prof?.full_name || "Unknown Employee",
        employee_name: prof?.full_name || "Unknown Employee",
        email: prof?.phone || "",
        ...dbToUiPermissions(ep),
      };
    });

    setEmployees(result);
    fetchEmployeePerformance(result);
  };

  const fetchManagers = async () => {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [{ data: managerRoles }, { data: profiles }, { data: permissions }, { data: products }, { data: sales30d }, { data: salesToday }] = await Promise.all([
      (supabase.from("user_roles" as any) as any).select("user_id").eq("role", "manager"),
      (supabase.from("profiles" as any) as any).select("user_id, full_name"),
      (supabase.from("employee_permissions" as any) as any).select("manager_user_id, employee_user_id"),
      (supabase.from("products" as any) as any).select("user_id, stock"),
      (supabase.from("sales" as any) as any).select("user_id, total").gte("date", thirtyDaysAgo),
      (supabase.from("sales" as any) as any).select("user_id, total").eq("date", today),
    ]);

    const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile.full_name || "Manager"]));
    const employeeCounts = new Map<string, number>();
    (permissions || []).forEach((item: any) => {
      const managerId = item.manager_user_id;
      employeeCounts.set(managerId, (employeeCounts.get(managerId) || 0) + 1);
    });

    const stockByManager = new Map<string, number>();
    (products || []).forEach((product: any) => {
      const userId = product.user_id;
      if (!userId) return;
      stockByManager.set(userId, (stockByManager.get(userId) || 0) + Number(product.stock || 0));
    });

    const sales30dByManager = new Map<string, number>();
    (sales30d || []).forEach((sale: any) => {
      sales30dByManager.set(sale.user_id, (sales30dByManager.get(sale.user_id) || 0) + Number(sale.total || 0));
    });

    const salesTodayByManager = new Map<string, number>();
    (salesToday || []).forEach((sale: any) => {
      salesTodayByManager.set(sale.user_id, (salesTodayByManager.get(sale.user_id) || 0) + Number(sale.total || 0));
    });

    const managerList = (managerRoles || []).map((manager: any) => ({
      user_id: manager.user_id,
      full_name: profileMap.get(manager.user_id) || "Manager",
      employeeCount: employeeCounts.get(manager.user_id) || 0,
      salesToday: salesTodayByManager.get(manager.user_id) || 0,
      sales30d: sales30dByManager.get(manager.user_id) || 0,
      stockUnits: stockByManager.get(manager.user_id) || 0,
      activityCount: 0,
    }));

    setManagers(managerList);
  };

  const fetchEmployeePerformance = async (employeeList: EmployeeWithProfile[]) => {
    const performance: Record<string, any> = {};

    for (const emp of employeeList) {
      const { data: sales } = await (supabase
        .from("sales" as any) as any)
        .select("*")
        .eq("user_id", emp.employee_user_id)
        .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

      const { data: activities } = await (supabase
        .from("activity_log" as any) as any)
        .select("*")
        .eq("user_id", emp.employee_user_id)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const totalSales = sales?.reduce((sum: number, sale: any) => sum + Number(sale.total), 0) || 0;
      const salesCount = sales?.length || 0;
      const activityCount = activities?.length || 0;

      performance[emp.employee_user_id] = {
        totalSales,
        salesCount,
        activityCount,
        averageSale: salesCount > 0 ? totalSales / salesCount : 0,
      };
    }

    setEmployeePerformance(performance);
  };

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    return employees.filter(emp => {
      const name = (emp.employee_name || emp.full_name).toLowerCase();
      return (
        name.includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [employees, searchQuery]);

  const filteredManagers = useMemo(() => {
    const valid = managers.filter(m => m.full_name !== "Manager");
    if (!managerSearchQuery.trim()) return valid;
    return valid.filter(manager =>
      manager.full_name.toLowerCase().includes(managerSearchQuery.toLowerCase())
    );
  }, [managers, managerSearchQuery]);

  const waitForEmployeeSetup = async (employeeUserId: string) => {
    const retries = 30;
    const delayMs = 1000;

    for (let i = 0; i < retries; i++) {
      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase.from("profiles" as any).select("user_id").eq("user_id", employeeUserId).maybeSingle(),
        supabase.from("user_roles" as any).select("user_id").eq("user_id", employeeUserId).maybeSingle(),
      ]);

      if (profileData && roleData) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return false;
  };

  const handleCreateEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const fullName = fd.get("fullName") as string;
    const { data: { session: managerSession } } = await supabase.auth.getSession();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "employee",
        },
      },
    });

    if (signUpError || !signUpData.user) {
      toast.error(signUpError?.message || "Failed to create employee account");
      if (managerSession) {
        await supabase.auth.setSession({
          access_token: managerSession.access_token,
          refresh_token: managerSession.refresh_token,
        });
      }
      setLoading(false);
      return;
    }

    const employeeUserId = signUpData.user.id;

    if (managerSession) {
      await supabase.auth.setSession({
        access_token: managerSession.access_token,
        refresh_token: managerSession.refresh_token,
      });
    }

    const setupReady = await waitForEmployeeSetup(employeeUserId);
    const permissionsData = uiToDbPermissions(fullAccess ? { ...FULL_ACCESS_PERMISSIONS } : { ...perms });

    const { error: permError } = await (supabase.from("employee_permissions" as any) as any).upsert(
      {
        employee_user_id: employeeUserId,
        manager_user_id: user!.id,
        ...permissionsData,
      },
      { onConflict: "employee_user_id" }
    );

    if (permError) {
      console.error("Employee permission insert failed:", permError);
      toast.error("Account created but failed to set permissions: " + permError.message);
    } else {
      if (setupReady) {
        toast.success(`Employee ${fullName} created! They'll receive a confirmation email.`);
      } else {
        toast.success(`Employee ${fullName} created! Setup is still provisioning and may take a few more seconds.`);
      }
    }

    setCreateOpen(false);
    setLoading(false);
    setFullAccess(false);
    setPerms({ ...FULL_ACCESS_PERMISSIONS });
    fetchEmployees();
  };

  const handleCreateManager = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const fullName = fd.get("fullName") as string;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "manager",
        },
      },
    });

    if (signUpError || !signUpData.user) {
      toast.error(signUpError?.message || "Failed to create manager account");
      setLoading(false);
      return;
    }

    const managerUserId = signUpData.user.id;

    try {
      const { error: roleError } = await (supabase.from("user_roles" as any) as any).upsert(
        { user_id: managerUserId, role: "manager" },
        { onConflict: "user_id" }
      );

      if (roleError) {
        const { error: insertError } = await (supabase.from("user_roles" as any) as any).insert({
          user_id: managerUserId,
          role: "manager",
        });

        if (insertError && insertError.code !== "23505") {
          throw new Error(insertError.message);
        }
      }

      toast.success(`${fullName} was added as a manager.`);
    } catch (roleError: any) {
      console.error("Manager role insert failed:", roleError);
      toast.error("Account created but role assignment failed: " + roleError.message);
    }

    setCreateOpen(false);
    setLoading(false);
    fetchManagers();
  };

  const handleUpdatePermissions = async (employeeUserId: string, newPerms: Partial<typeof FULL_ACCESS_PERMISSIONS>) => {
    const { error } = await (supabase
      .from("employee_permissions" as any) as any)
      .update(uiToDbPermissions(newPerms))
      .eq("employee_user_id", employeeUserId)
      .eq("manager_user_id", user!.id);

    if (error) {
      toast.error("Failed to update permissions");
    } else {
      toast.success("Permissions updated");
      fetchEmployees();
    }
  };

  const handleDeleteEmployee = async (employeeUserId: string) => {
    const { error } = await (supabase
      .from("employee_permissions" as any) as any)
      .delete()
      .eq("employee_user_id", employeeUserId)
      .eq("manager_user_id", user!.id);

    if (error) {
      toast.error("Failed to remove employee");
    } else {
      toast.success("Employee removed");
      fetchEmployees();
    }
  };

  if (role !== "manager" && role !== "admin") {
    return (
      <div className="pb-24">
        <PageHeader title="Managers" subtitle="Access restricted" />
        <div className="px-4 mt-8 text-center">
          <p className="text-muted-foreground">Only managers and admins can access this page.</p>
        </div>
      </div>
    );
  }

  if (isAdminView) {
    return (
      <div className="pb-24">
        <PageHeader title="Managers" subtitle="Track team performance and access" />

        <div className="px-4 space-y-4 mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search managers..."
              value={managerSearchQuery}
              onChange={(e) => setManagerSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 text-left w-full">
                <div className="p-2 rounded-lg bg-primary/20">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Add Manager</p>
                  <p className="text-xs text-muted-foreground">Create a new manager account</p>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Create Manager Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateManager} className="space-y-3">
                <div>
                  <Label>Full Name</Label>
                  <Input name="fullName" placeholder="Manager name" required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="manager@example.com" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input name="password" type="password" placeholder="••••••••" minLength={6} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create Manager"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Managers ({filteredManagers.length})
            </h3>

            {filteredManagers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No managers found.</p>
            ) : (
              filteredManagers.map((manager) => (
                <div key={manager.user_id} className="rounded-xl border border-border bg-background p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{manager.full_name}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary uppercase tracking-wide">
                      Manager
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-success/10 p-2 text-center">
                      <p className="font-semibold text-success">RWF {manager.salesToday.toLocaleString()}</p>
                      <p className="text-muted-foreground">Today</p>
                    </div>
                    <div className="rounded-lg bg-accent/10 p-2 text-center">
                      <p className="font-semibold text-accent">RWF {manager.sales30d.toLocaleString()}</p>
                      <p className="text-muted-foreground">30d sales</p>
                    </div>
                    <div className="rounded-lg bg-warning/10 p-2 text-center">
                      <p className="font-semibold text-warning">{manager.stockUnits}</p>
                      <p className="text-muted-foreground">Stock units</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">Performance</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{manager.employeeCount > 0 ? `${manager.sales30d / Math.max(manager.employeeCount, 1)} / emp` : "No team"}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">Stock managed</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{manager.stockUnits} units</span>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => navigate(`/employees/${manager.user_id}/performance`)}>
                    <BarChart3 className="h-4 w-4 mr-2" /> View manager performance
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader title="Employees" subtitle="Manage your team" />

      <div className="px-4 space-y-4 mt-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 text-left w-full">
              <div className="p-2 rounded-lg bg-primary/20">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Add Employee</p>
                <p className="text-xs text-muted-foreground">Create a new employee account</p>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Employee Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input name="fullName" placeholder="Employee name" required />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" placeholder="employee@example.com" required />
              </div>
              <div>
                <Label>Password</Label>
                <Input name="password" type="password" placeholder="••••••••" minLength={6} required />
              </div>

              <div className="border border-border rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">All Permissions</span>
                  </div>
                  <Switch
                    checked={fullAccess}
                    onCheckedChange={(v) => {
                      setFullAccess(v);
                      if (v) setPerms({ ...FULL_ACCESS_PERMISSIONS });
                    }}
                  />
                </div>

                {!fullAccess && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium">Custom Permissions</p>
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="text-sm text-foreground font-medium">{label}</span>
                          <p className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[key]}</p>
                        </div>
                        <Switch
                          checked={perms[key as keyof typeof perms]}
                          onCheckedChange={(v) => setPerms((p) => ({ ...p, [key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Members ({filteredEmployees.length}{searchQuery && ` of ${employees.length}`})
          </h3>

          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {searchQuery ? "No employees match your search." : "No employees yet. Add your first team member above."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((emp) => {
                const perf = employeePerformance[emp.employee_user_id] || {};
                return (
                  <div key={emp.employee_user_id} className="border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {(emp.employee_name || emp.full_name).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{emp.employee_name || emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Object.entries(PERMISSION_LABELS).filter(([k]) => emp[k as keyof typeof emp]).length}/6 permissions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/employees/${emp.employee_user_id}/activity`)} title="View Activity">
                          <Activity className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/employees/${emp.employee_user_id}/performance`)} title="View Performance">
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setPermOpen(permOpen === emp.employee_user_id ? null : emp.employee_user_id)} title="Edit Permissions">
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteEmployee(emp.employee_user_id)} title="Remove Employee">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                      <div className="text-center p-2 rounded bg-success/10">
                        <p className="font-semibold text-success">RWF {perf.totalSales?.toLocaleString() || 0}</p>
                        <p className="text-muted-foreground">Sales (30d)</p>
                      </div>
                      <div className="text-center p-2 rounded bg-primary/10">
                        <p className="font-semibold text-primary">{perf.salesCount || 0}</p>
                        <p className="text-muted-foreground">Transactions</p>
                      </div>
                      <div className="text-center p-2 rounded bg-accent/10">
                        <p className="font-semibold text-accent">{perf.activityCount || 0}</p>
                        <p className="text-muted-foreground">Activities</p>
                      </div>
                    </div>

                    {permOpen === emp.employee_user_id && (
                      <div className="border-t border-border pt-2 space-y-2">
                        <div className="flex items-center justify-between pb-2">
                          <span className="text-xs font-medium text-foreground">All Permissions</span>
                          <Button variant="outline" size="sm" onClick={() => handleUpdatePermissions(emp.employee_user_id, FULL_ACCESS_PERMISSIONS)} className="text-xs h-7">
                            Grant All
                          </Button>
                        </div>
                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between">
                            <div className="flex-1">
                              <span className="text-xs text-foreground font-medium">{label}</span>
                              <p className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[key]}</p>
                            </div>
                            <Switch
                              checked={emp[key as keyof typeof emp] as boolean}
                              onCheckedChange={(v) => handleUpdatePermissions(emp.employee_user_id, { [key]: v })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
