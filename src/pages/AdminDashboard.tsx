import { useEffect, useState } from "react";
import { Users, Activity, Shield, TrendingUp, Clock, AlertCircle, CheckCircle, XCircle, BarChart3, FileText } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  total_managers: number;
  total_employees: number;
  active_users: number;
  total_products: number;
  total_sales: number;
  recent_activities: number;
}

interface SalesActivity {
  full_name: string;
  role: string;
  sales_count: number;
  first_sale: string;
  last_sale: string;
}

interface SystemActivity {
  action: string;
  entity: string;
  description: string;
  user_name: string;
  user_role: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesActivity, setSalesActivity] = useState<SalesActivity[]>([]);
  const [systemActivity, setSystemActivity] = useState<SystemActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === "admin") {
      fetchDashboardData();
    }
  }, [role]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch actual data from database tables
      
      // Count managers
      const { count: managerCount } = await supabase
        .from("user_roles" as any)
        .select("*", { count: 'exact', head: true })
        .eq("role", "manager");

      // Count employees
      const { count: employeeCount } = await supabase
        .from("user_roles" as any)
        .select("*", { count: 'exact', head: true })
        .eq("role", "employee");

      // Count total products
      const { count: productCount } = await supabase
        .from("products" as any)
        .select("*", { count: 'exact', head: true });

      // Count total sales
      const { count: salesCount } = await supabase
        .from("sales" as any)
        .select("*", { count: 'exact', head: true });

      // Count recent audit logs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: activityCount } = await supabase
        .from("audit_logs" as any)
        .select("*", { count: 'exact', head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      setStats({
        total_managers: managerCount || 0,
        total_employees: employeeCount || 0,
        active_users: (managerCount || 0) + (employeeCount || 0),
        total_products: productCount || 0,
        total_sales: salesCount || 0,
        recent_activities: activityCount || 0,
      });

      // Fetch sales activity by user
      const { data: salesData } = await supabase
        .from("sales" as any)
        .select("employee_name, employee_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (salesData) {
        // Group by employee
        const salesByUser = salesData.reduce((acc: any, sale: any) => {
          const key = sale.employee_id;
          if (!acc[key]) {
            acc[key] = {
              full_name: sale.employee_name || "Unknown",
              role: "employee",
              sales_count: 0,
              first_sale: sale.created_at,
              last_sale: sale.created_at,
            };
          }
          acc[key].sales_count++;
          if (sale.created_at < acc[key].first_sale) {
            acc[key].first_sale = sale.created_at;
          }
          if (sale.created_at > acc[key].last_sale) {
            acc[key].last_sale = sale.created_at;
          }
          return acc;
        }, {});

        setSalesActivity(Object.values(salesByUser).slice(0, 10) as SalesActivity[]);
      }

      // Fetch recent audit logs
      const { data: activityData } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (activityData) {
        setSystemActivity(activityData.map((log: any) => ({
          action: log.action,
          entity: log.entity,
          description: log.description,
          user_name: log.user_name || "Unknown",
          user_role: log.user_role,
          created_at: log.created_at,
        })));
      }
    } catch (error) {
      console.error("Error fetching admin dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "update":
        return <Activity className="h-4 w-4 text-primary" />;
      case "delete":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="pb-24">
      <PageHeader 
        title="Admin Dashboard" 
        subtitle="System monitoring and governance" 
        showNotification 
      />

      <div className="px-4 space-y-6 mt-2">
        {/* Admin Overview Banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">System Overview</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-foreground">Monitoring Dashboard</p>
              <p className="text-xs text-muted-foreground">
                Track system usage, user activity, and operational metrics
              </p>
            </div>
            <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Live
            </div>
          </div>
        </div>

        {/* User Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Managers"
            value={stats?.total_managers?.toString() || "0"}
            icon={Users}
            variant="default"
            trend="Active accounts"
          />
          <StatCard
            title="Employees"
            value={stats?.total_employees?.toString() || "0"}
            icon={Users}
            variant="accent"
            trend="Active accounts"
          />
          <StatCard
            title="Active Users"
            value={stats?.active_users?.toString() || "0"}
            icon={CheckCircle}
            variant="success"
            trend="Currently active"
          />
          <StatCard
            title="Products"
            value={stats?.total_products?.toString() || "0"}
            icon={BarChart3}
            variant="default"
            trend="Registered items"
          />
        </div>

        {/* Operational Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Sales Transactions"
            value={stats?.total_sales?.toString() || "0"}
            icon={Activity}
            variant="success"
            trend="Total recorded"
          />
          <StatCard
            title="Recent Activities"
            value={stats?.recent_activities?.toString() || "0"}
            icon={Clock}
            variant="warning"
            trend="Last 30 days"
          />
        </div>

        {/* Sales Activity by Role */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Sales Activity by User
          </h3>
          <div className="space-y-2">
            {salesActivity.length > 0 ? (
              salesActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-foreground">{activity.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.role} · Last activity: {formatDate(activity.last_sale)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{activity.sales_count}</p>
                    <p className="text-xs text-muted-foreground">sales</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No sales activity recorded</p>
            )}
          </div>
        </div>

        {/* Recent System Activity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent System Activity
          </h3>
          <div className="space-y-2">
            {systemActivity.length > 0 ? (
              systemActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 text-sm p-2 rounded-lg bg-secondary/50">
                  <div className="mt-0.5">
                    {getActionIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{activity.description || activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.user_name} ({activity.user_role}) · {formatDate(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent system activity</p>
            )}
          </div>
        </div>

        {/* Information Banner */}
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Admin Access Scope</p>
              <p className="text-xs text-muted-foreground mt-1">
                As an Admin, you can monitor system usage and manage user accounts. 
                Financial data (prices, profits, expenses) and detailed inventory information 
                are restricted to Manager-level access for security purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
