import { BarChart3, Bell, LayoutDashboard, Moon, Package, Receipt, Settings, Shield, ShoppingCart, Sun, Users, Warehouse, Activity, FileText, UserCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

// Admin navigation - system monitoring only
const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Shield, label: "User Management", path: "/admin" },
  { icon: Activity, label: "System Activity", path: "/admin/activity" },
  { icon: FileText, label: "Audit Logs", path: "/admin/audit" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Settings, label: "System Settings", path: "/admin/settings" },
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
  { icon: Activity, label: "My Activity", path: "/my-activity" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const hiddenPaths = ["/login", "/register"];
  if (hiddenPaths.includes(location.pathname)) return null;

  // Get navigation items based on role
  const navItems = role === "admin" 
    ? adminNavItems 
    : role === "manager" 
      ? managerNavItems 
      : employeeNavItems;

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-card/80 backdrop-blur-lg lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-5 text-center">
        {/* <BrandLogo variant="header" /> */}
        <div className="min-w-0 text-center">
          <h1 className="truncate text-xl font-bold text-foreground p-3">STOCK MANAGEMENT <br /> SYSTEM</h1>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "stroke-[2.5]")} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
            aria-label="Toggle light or dark theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors hover:bg-secondary/80"
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors hover:bg-secondary/80"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
