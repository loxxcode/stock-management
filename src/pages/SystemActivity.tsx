import { useState, useEffect } from "react";
import { Activity, Users, Package, ShoppingCart, Receipt, Filter, Search, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SystemActivityLog {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: any;
  new_value: any;
  description: string | null;
  user_name: string;
  user_role: string;
  created_at: string;
}

export default function SystemActivity() {
  const { role } = useAuth();
  const [activities, setActivities] = useState<SystemActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role === "admin") {
      fetchActivities();
    }
  }, [role]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch system activity: " + error.message);
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
      case "expense":
        return <Receipt className="h-4 w-4" />;
      case "user":
      case "employee":
        return <Users className="h-4 w-4" />;
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

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      search === "" ||
      activity.description?.toLowerCase().includes(search.toLowerCase()) ||
      activity.user_name.toLowerCase().includes(search.toLowerCase()) ||
      activity.entity?.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "all" || activity.action === actionFilter;
    const matchesEntity = entityFilter === "all" || activity.entity === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const uniqueActions = Array.from(new Set(activities.map((a) => a.action)));
  const uniqueEntities = Array.from(new Set(activities.map((a) => a.entity).filter(Boolean)));

  if (role !== "admin") {
    return null;
  }

  return (
    <div className="pb-24">
      <PageHeader title="System Activity" subtitle="Track all system operations" />

      <div className="px-4 space-y-4 mt-2">
        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={fetchActivities} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Action</Label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Entity</Label>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">All Entities</option>
                {uniqueEntities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity.charAt(0).toUpperCase() + entity.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activities found
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <button
                  onClick={() => toggleRow(activity.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
                >
                  {getActionIcon(activity.action)}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground capitalize">{activity.action}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground capitalize">
                        {activity.entity || "System"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description || "No description"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatDate(activity.created_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.user_name} ({activity.user_role})
                    </p>
                  </div>
                  {expandedRows.has(activity.id) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {expandedRows.has(activity.id) && (
                  <div className="border-t border-border p-4 bg-secondary/30 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">User</Label>
                        <p className="font-medium text-foreground">{activity.user_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{activity.user_role}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Timestamp</Label>
                        <p className="font-medium text-foreground">{formatDate(activity.created_at)}</p>
                      </div>
                      {activity.entity && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Entity</Label>
                          <p className="font-medium text-foreground capitalize flex items-center gap-2">
                            {getEntityIcon(activity.entity)}
                            {activity.entity}
                          </p>
                        </div>
                      )}
                      {activity.entity_id && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Entity ID</Label>
                          <p className="font-medium text-foreground text-xs">{activity.entity_id}</p>
                        </div>
                      )}
                    </div>
                    {(activity.old_value || activity.new_value) && (
                      <div className="space-y-2">
                        {activity.old_value && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Old Value</Label>
                            <pre className="text-xs bg-secondary p-2 rounded-lg overflow-auto max-h-32">
                              {typeof activity.old_value === "object"
                                ? JSON.stringify(activity.old_value, null, 2)
                                : String(activity.old_value)}
                            </pre>
                          </div>
                        )}
                        {activity.new_value && (
                          <div>
                            <Label className="text-xs text-muted-foreground">New Value</Label>
                            <pre className="text-xs bg-secondary p-2 rounded-lg overflow-auto max-h-32">
                              {typeof activity.new_value === "object"
                                ? JSON.stringify(activity.new_value, null, 2)
                                : String(activity.new_value)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
