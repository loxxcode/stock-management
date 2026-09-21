import { useState, useEffect } from "react";
import { FileText, Search, Filter, Download, Trash2, RefreshCw, Calendar, User, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: any;
  new_value: any;
  description: string | null;
  user_id: string;
  user_name: string;
  user_role: string;
  created_at: string;
}

export default function AuditLogs() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  useEffect(() => {
    if (role === "admin") {
      fetchLogs();
    }
  }, [role]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo + "T23:59:59");
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch audit logs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!deleteLogId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("audit_logs" as any)
        .delete()
        .eq("id", deleteLogId);

      if (error) throw error;
      toast.success("Audit log deleted");
      setDeleteDialogOpen(false);
      setDeleteLogId(null);
      fetchLogs();
    } catch (error: any) {
      toast.error("Failed to delete log: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLogs = () => {
    const csvContent = [
      ["Timestamp", "Action", "Entity", "Entity ID", "User", "Role", "Description"].join(","),
      ...filteredLogs.map((log) =>
        [
          log.created_at,
          log.action,
          log.entity || "",
          log.entity_id || "",
          log.user_name,
          log.user_role,
          log.description || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Audit logs exported");
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

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "text-success bg-success/10";
      case "update":
        return "text-primary bg-primary/10";
      case "delete":
        return "text-destructive bg-destructive/10";
      default:
        return "text-muted-foreground bg-secondary";
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

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      search === "" ||
      log.description?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_name.toLowerCase().includes(search.toLowerCase()) ||
      log.entity?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEntity = entityFilter === "all" || log.entity === entityFilter;
    const matchesRole = roleFilter === "all" || log.user_role === roleFilter;

    return matchesSearch && matchesAction && matchesEntity && matchesRole;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));
  const uniqueEntities = Array.from(new Set(logs.map((l) => l.entity).filter(Boolean)));
  const uniqueRoles = Array.from(new Set(logs.map((l) => l.user_role)));

  if (role !== "admin") {
    return null;
  }

  return (
    <div className="pb-24">
      <PageHeader title="Audit Logs" subtitle="System audit trail and compliance" />

      <div className="px-4 space-y-4 mt-2">
        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" onClick={handleExportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export
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
            <div>
              <Label className="text-xs text-muted-foreground">User Role</Label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <button
                  onClick={() => toggleRow(log.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className={cn("p-1.5 rounded-lg", getActionColor(log.action))}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground capitalize">{log.action}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground capitalize">
                        {log.entity || "System"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.description || "No description"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.user_name} ({log.user_role})
                    </p>
                  </div>
                  {expandedRows.has(log.id) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {expandedRows.has(log.id) && (
                  <div className="border-t border-border p-4 bg-secondary/30 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">User</Label>
                        <p className="font-medium text-foreground">{log.user_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{log.user_role}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Timestamp</Label>
                        <p className="font-medium text-foreground">{formatDate(log.created_at)}</p>
                      </div>
                      {log.entity && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Entity</Label>
                          <p className="font-medium text-foreground capitalize">{log.entity}</p>
                        </div>
                      )}
                      {log.entity_id && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Entity ID</Label>
                          <p className="font-medium text-foreground text-xs">{log.entity_id}</p>
                        </div>
                      )}
                    </div>
                    {(log.old_value || log.new_value) && (
                      <div className="space-y-2">
                        {log.old_value && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Old Value</Label>
                            <pre className="text-xs bg-secondary p-2 rounded-lg overflow-auto max-h-32">
                              {typeof log.old_value === "object"
                                ? JSON.stringify(log.old_value, null, 2)
                                : String(log.old_value)}
                            </pre>
                          </div>
                        )}
                        {log.new_value && (
                          <div>
                            <Label className="text-xs text-muted-foreground">New Value</Label>
                            <pre className="text-xs bg-secondary p-2 rounded-lg overflow-auto max-h-32">
                              {typeof log.new_value === "object"
                                ? JSON.stringify(log.new_value, null, 2)
                                : String(log.new_value)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeleteLogId(log.id);
                        setDeleteDialogOpen(true);
                      }}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Log Entry
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Audit Log
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This will permanently delete this audit log entry. This action cannot be undone.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteLog} disabled={loading}>
                {loading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
