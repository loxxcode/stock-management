import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Database, Users, Shield, Bell, RefreshCw, Trash2, Save, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SettingsView = "main" | "database" | "users" | "security" | "notifications";

export default function AdminSettings() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<SettingsView>("main");
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>("");

  // Database settings
  const [backupRetention, setBackupRetention] = useState(30);
  const [autoBackup, setAutoBackup] = useState(true);
  const [maxConnections, setMaxConnections] = useState(100);

  // User settings
  const [maxUsers, setMaxUsers] = useState(50);
  const [defaultRole, setDefaultRole] = useState("employee");
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);

  // Security settings
  const [sessionTimeout, setSessionTimeout] = useState(24);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [passwordMinLength, setPasswordMinLength] = useState(8);

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [auditLogAlerts, setAuditLogAlerts] = useState(true);

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      // Save settings to a system_settings table or similar
      const { error } = await (supabase.from("system_settings" as any) as any).upsert({
        key: "admin_config",
        value: {
          backupRetention,
          autoBackup,
          maxConnections,
          maxUsers,
          defaultRole,
          requireEmailVerification,
          sessionTimeout,
          maxLoginAttempts,
          passwordMinLength,
          emailNotifications,
          systemAlerts,
          auditLogAlerts,
        },
        user_id: user?.id,
      });

      if (error) throw error;
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error("Failed to save settings: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDatabaseCleanup = async () => {
    setLoading(true);
    try {
      // Clean up old audit logs, notifications, etc.
      const { error } = await (supabase.rpc as any)("cleanup_old_records", {
        days_to_keep: backupRetention,
      });

      if (error) throw error;
      toast.success("Database cleanup completed");
      setConfirmDialogOpen(false);
    } catch (error: any) {
      toast.error("Cleanup failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      // Force refresh all data
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = (action: string) => {
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  if (view === "database") {
    return (
      <div className="pb-24">
        <PageHeader title="Database Settings" subtitle="Manage database configuration" />
        <div className="px-4 space-y-4 mt-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label>Backup Retention (days)</Label>
              <Input
                type="number"
                value={backupRetention}
                onChange={(e) => setBackupRetention(parseInt(e.target.value) || 30)}
                min={1}
                max={365}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto Backup</Label>
              <input
                type="checkbox"
                checked={autoBackup}
                onChange={(e) => setAutoBackup(e.target.checked)}
                className="w-5 h-5"
              />
            </div>
            <div>
              <Label>Max Connections</Label>
              <Input
                type="number"
                value={maxConnections}
                onChange={(e) => setMaxConnections(parseInt(e.target.value) || 100)}
                min={10}
                max={1000}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-foreground">Database Maintenance</h3>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleConfirmAction("cleanup")}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cleanup Old Records
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRefreshData}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh All Data
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setView("main")}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleSaveSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "users") {
    return (
      <div className="pb-24">
        <PageHeader title="User Settings" subtitle="Manage user policies" />
        <div className="px-4 space-y-4 mt-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label>Max Users</Label>
              <Input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(parseInt(e.target.value) || 50)}
                min={1}
                max={1000}
              />
            </div>
            <div>
              <Label>Default Role for New Users</Label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value)}
                className="w-full p-2 rounded-lg border border-border bg-background"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Require Email Verification</Label>
              <input
                type="checkbox"
                checked={requireEmailVerification}
                onChange={(e) => setRequireEmailVerification(e.target.checked)}
                className="w-5 h-5"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setView("main")}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleSaveSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "security") {
    return (
      <div className="pb-24">
        <PageHeader title="Security Settings" subtitle="Configure security policies" />
        <div className="px-4 space-y-4 mt-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label>Session Timeout (hours)</Label>
              <Input
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 24)}
                min={1}
                max={168}
              />
            </div>
            <div>
              <Label>Max Login Attempts</Label>
              <Input
                type="number"
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(parseInt(e.target.value) || 5)}
                min={3}
                max={10}
              />
            </div>
            <div>
              <Label>Password Min Length</Label>
              <Input
                type="number"
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(parseInt(e.target.value) || 8)}
                min={6}
                max={32}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setView("main")}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleSaveSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "notifications") {
    return (
      <div className="pb-24">
        <PageHeader title="Notification Settings" subtitle="Configure system notifications" />
        <div className="px-4 space-y-4 mt-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Email Notifications</Label>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-5 h-5"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>System Alerts</Label>
              <input
                type="checkbox"
                checked={systemAlerts}
                onChange={(e) => setSystemAlerts(e.target.checked)}
                className="w-5 h-5"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Audit Log Alerts</Label>
              <input
                type="checkbox"
                checked={auditLogAlerts}
                onChange={(e) => setAuditLogAlerts(e.target.checked)}
                className="w-5 h-5"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setView("main")}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleSaveSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main settings view
  return (
    <div className="pb-24">
      <PageHeader title="System Settings" subtitle="Configure system-wide settings" />
      <div className="px-4 space-y-3 mt-2">
        <SettingsItem
          icon={Database}
          label="Database Settings"
          desc="Backup, connections, maintenance"
          onClick={() => setView("database")}
        />
        <SettingsItem
          icon={Users}
          label="User Settings"
          desc="User limits, default roles"
          onClick={() => setView("users")}
        />
        <SettingsItem
          icon={Shield}
          label="Security Settings"
          desc="Session, login, password policies"
          onClick={() => setView("security")}
        />
        <SettingsItem
          icon={Bell}
          label="Notification Settings"
          desc="Email alerts, system notifications"
          onClick={() => setView("notifications")}
        />

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {confirmAction === "cleanup"
                  ? "This will delete old records based on your retention policy. This action cannot be undone."
                  : "Are you sure you want to proceed with this action?"}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={confirmAction === "cleanup" ? "destructive" : "default"}
                onClick={confirmAction === "cleanup" ? handleDatabaseCleanup : () => setConfirmDialogOpen(false)}
                disabled={loading}
              >
                {loading ? "Processing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SettingsItem({ icon: Icon, label, desc, onClick }: {
  icon: React.ElementType;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center justify-between w-full p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="font-medium text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
