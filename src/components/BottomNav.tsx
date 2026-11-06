import { LayoutDashboard, Package, ShoppingCart, Receipt, Users, BarChart3, Warehouse, Shield, Activity, FileText, Bell, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Expenses from "@/pages/Expenses";

// Admin navigation - system monitoring only
const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Shield, label: "Users", path: "/admin" },
  { icon: Activity, label: "Activity", path: "/admin/activity" },
  { icon: FileText, label: "Audit", path: "/admin/audit" },
  { icon: Bell, label: "Notify", path: "/notifications" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
];

// Manager navigation - full business access
const managerNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/manager/dashboard" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: Warehouse, label: "Stock", path: "/stock" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Users, label: "Employees", path: "/employees" },
];

// Employee navigation - limited operational access
const employeeNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/employee/dashboard" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
  { icon: Activity, label: "Activity", path: "/my-activity" },
  { icon: Bell, label: "Notify", path: "/notifications" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const hiddenPaths = ["/login", "/register"];
  if (hiddenPaths.includes(location.pathname)) return null;

  // Get navigation items based on role (same as sidebar)
  const navItems = role === "admin"
    ? adminNavItems
    : role === "manager"
      ? managerNavItems
      : employeeNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-1 lg:px-6">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all min-w-0",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "stroke-[2.5]")} />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
