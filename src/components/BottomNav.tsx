import { LayoutDashboard, Package, ShoppingCart, Receipt, Users, BarChart3, Warehouse, Shield } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isManagerOrAdmin, useAuth } from "@/contexts/AuthContext";

const baseItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
  { icon: Warehouse, label: "Stock", path: "/stock" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, permissions } = useAuth();

  const hiddenPaths = ["/login", "/register"];
  if (hiddenPaths.includes(location.pathname)) return null;

  const filteredBaseItems = baseItems.filter(item => {
    if (item.label === "Reports" && permissions && !permissions.can_view_stock) {
      return false;
    }
    return true;
  });

  const navItems = role === "admin"
    ? [
        filteredBaseItems[0],
        { icon: Shield, label: "Admin", path: "/admin" },
        ...filteredBaseItems.slice(1),
        ...(isManagerOrAdmin(role)
          ? [{ icon: Users, label: "Employees", path: "/employees" }]
          : []),
      ]
    : [
        ...filteredBaseItems,
        ...(isManagerOrAdmin(role)
          ? [{ icon: Users, label: "Employees", path: "/employees" }]
          : []),
        ...(role === "admin"
          ? [{ icon: Shield, label: "Admin", path: "/admin" }]
          : []),
      ];

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
