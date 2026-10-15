import { useEffect, useMemo, useState } from "react";
import { Activity, Shield, UserCheck, UserX, Users, Settings, FileText, Log } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Account {
  user_id: string;
  full_name: string;
  role: "manager" | "employee";
  is_active: boolean;
  manager_user_id?: string;
  activityCount: number;
}

export default function Admin() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === "admin") fetchAccounts();
  }, [role]);

  const fetchAccounts = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: permissions }] = await Promise.all([
      (supabase.from("profiles" as any) as any).select("user_id, full_name, is_active"),
      (supabase.from("user_roles" as any) as any).select("user_id, role").in("role", ["manager", "employee"]),
      (supabase.from("employee_permissions" as any) as any).select("employee_user_id, manager_user_id"),
    ]);

    const roleByUser = new Map((roles || []).map((item: any) => [item.user_id, item.role]));
    const managerByEmployee = new Map((permissions || []).map((item: any) => [item.employee_user_id, item.manager_user_id]));
    const userIds = (profiles || []).map((profile: any) => profile.user_id);
    const { data: activity } = userIds.length
      ? await (supabase.from("activity_log" as any) as any).select("user_id").in("user_id", userIds).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      : { data: [] };
    const activityByUser = new Map<string, number>();
    (activity || []).forEach((item: any) => activityByUser.set(item.user_id, (activityByUser.get(item.user_id) || 0) + 1));

    setAccounts((profiles || [])
      .filter((profile: any) => roleByUser.has(profile.user_id))
      .map((profile: any) => ({
        user_id: profile.user_id,
        full_name: profile.full_name || "Unnamed account",
        role: roleByUser.get(profile.user_id),
        is_active: profile.is_active !== false,
        manager_user_id: managerByEmployee.get(profile.user_id),
        activityCount: activityByUser.get(profile.user_id) || 0,
      })));
    setLoading(false);
  };

  const managers = useMemo(() => accounts.filter((account) => account.role === "manager"), [accounts]);
  const employees = useMemo(() => accounts.filter((account) => account.role === "employee"), [accounts]);

  const updateAccess = async (account: Account, isActive: boolean) => {
    const { error } = await (supabase.from("profiles" as any) as any)
      .update({ is_active: isActive })
      .eq("user_id", account.user_id);
    if (error) {
      toast.error("Unable to update account access");
      return;
    }
    setAccounts((current) => current.map((item) => item.user_id === account.user_id ? { ...item, is_active: isActive } : item));
    toast.success(`${account.full_name} is now ${isActive ? "allowed" : "blocked"}`);
  };

  const renderAccount = (account: Account) => (
    <div key={account.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{account.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {account.role === "employee" ? "Employee" : "Manager"} · {account.activityCount} activities in 30 days
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {account.role === "manager" && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/managers/${account.user_id}/activity`)}>
            View activity
          </Button>
        )}
        {account.is_active ? <UserCheck className="h-4 w-4 text-success" /> : <UserX className="h-4 w-4 text-destructive" />}
        <Switch checked={account.is_active} onCheckedChange={(checked) => updateAccess(account, checked)} aria-label={`Allow ${account.full_name} access`} />
      </div>
    </div>
  );

  if (role !== "admin") return null;

  return (
    <div className="pb-24">
      <PageHeader title="User Management" subtitle="Manage account access and permissions" />
      <div className="space-y-6 px-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 font-semibold text-foreground"><Shield className="h-4 w-4 text-primary" /> Access control</div>
          <p className="mt-1 text-sm text-muted-foreground">Blocked accounts cannot access the application. Activity totals cover the last 30 days.</p>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading accounts...</p> : (
          <>
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-foreground"><Activity className="h-4 w-4 text-primary" /> Managers ({managers.length})</h2>
              {managers.length ? managers.map(renderAccount) : <p className="text-sm text-muted-foreground">No managers found.</p>}
            </section>
            <section className="space-y-3">
              <h2 className="font-semibold text-foreground">Employees ({employees.length})</h2>
              {employees.length ? employees.map(renderAccount) : <p className="text-sm text-muted-foreground">No employees found.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}