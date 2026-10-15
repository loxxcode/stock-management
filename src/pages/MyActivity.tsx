import { useState, useEffect } from "react";
import { Activity, Calendar, Package, ShoppingCart, TrendingUp, Clock, Filter, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useSales } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  action: string;
  entity: string | null;
  description: string | null;
  created_at: string;
}

export default function MyActivity() {
  const { user, role } = useAuth();
  const { sales } = useSales();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (role === "employee" && user) {
      fetchMyActivity();
    }
  }, [role, user, period]);

  const fetchMyActivity = async () => {
    setLoading(true);
    try {
      const userId = user?.id;
      const userName = user?.user_metadata?.full_name || user?.email;

      if (!userId) return;

      let query = supabase
        .from("audit_logs" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      // Apply date filter
      const now = new Date();
      if (period === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte("created_at", start);
      } else if (period === "week") {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", start);
      } else if (period === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte("created_at", start);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching activity:', error);
      } else if (data) {
        setActivities(data);
      }
    } catch (error) {
      console.error('Error in fetchMyActivity:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return <div className="p-1.5 rounded-lg bg-success/10 text-success"><Activity className="h-4 w-4" /></div>;
      case "update":
        return <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div>;
      case "delete":
        return <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive"><Activity className="h-4 w-4" /></div>;
      default:
        return <div className="p-1.5 rounded-lg bg-secondary text-muted-foreground"><Activity className="h-4 w-4" /></div>;
    }
  };

  const getEntityIcon = (entity: string | null) => {
    if (!entity) return <Activity className="h-4 w-4" />;
    switch (entity.toLowerCase()) {
      case "product":
        return <Package className="h-4 w-4" />;
      case "sale":
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter sales by period
  const getFilteredSales = () => {
    const now = new Date();
    let startDate: Date;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(0); // All time
    }

    return sales.filter(s => new Date(s.date) >= startDate);
  };

  const filteredSales = getFilteredSales();
  const totalSales = filteredSales.length;
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);

  if (role !== "employee") {
    return (
      <div className="pb-24 px-4 pt-8 text-center">
        <p className="text-muted-foreground">This page is for employees only.</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader 
        title="My Activity" 
        subtitle="Track your performance and operations" 
        showNotification 
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Period Selector */}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Sales Made"
            value={totalSales.toString()}
            icon={ShoppingCart}
            variant="success"
            trend="Transactions"
          />
          <StatCard
            title="Revenue"
            value={`RWF ${totalRevenue.toLocaleString()}`}
            icon={TrendingUp}
            variant="accent"
            trend="Total earned"
          />
        </div>

        {/* Activity Log */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Activity Log
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchMyActivity} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity recorded in this period</p>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <button
                    onClick={() => toggleRow(activity.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
                  >
                    {getActionIcon(activity.action)}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground capitalize">{activity.action}</span>
                        {activity.entity && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground capitalize flex items-center gap-1">
                              {getEntityIcon(activity.entity)}
                              {activity.entity}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description || "No description"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{formatDate(activity.created_at)}</p>
                    </div>
                    {expandedRows.has(activity.id) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {expandedRows.has(activity.id) && (
                    <div className="border-t border-border p-3 bg-secondary/30">
                      <div className="text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Timestamp:</span> {formatDate(activity.created_at)}
                        </p>
                        {activity.entity && (
                          <p className="text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">Entity:</span> {activity.entity}
                          </p>
                        )}
                        {activity.description && (
                          <p className="text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">Description:</span> {activity.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Recent Sales
          </h3>
          <div className="space-y-2">
            {filteredSales.slice(0, 5).length > 0 ? (
              filteredSales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-foreground">{sale.productName}</p>
                    <p className="text-xs text-muted-foreground">Qty: {sale.quantity} · {sale.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">RWF {sale.total.toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No sales in this period</p>
            )}
          </div>
        </div>

        {/* Information Banner */}
        <div className="rounded-xl border border-info/30 bg-info/5 p-4">
          <div className="flex items-start gap-2">
            <Activity className="h-4 w-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Activity Tracking</p>
              <p className="text-xs text-muted-foreground mt-1">
                This page shows your sales performance and system activity. All your actions are logged for accountability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
