import { useState } from "react";
import { ShoppingCart, Users, TrendingUp, Package, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useProducts, useSales, useCustomerCredits } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";

export default function EmployeeDashboard() {
  const { user, role } = useAuth();
  const { products } = useProducts();
  const { sales } = useSales();
  const { credits } = useCustomerCredits();

  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === today);
  const mySalesCount = todaySales.length;
  const lowStockItems = products.filter(p => p.stock <= p.minStock);
  const myCredits = credits.filter(c => c.employeeName === user?.user_metadata?.full_name || c.employeeName === user?.email);

  return (
    <div className="pb-24">
      <PageHeader 
        title="Employee Dashboard" 
        subtitle="Your daily operations" 
        showNotification 
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Welcome Banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Welcome Back</span>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold text-foreground">
              {user?.user_metadata?.full_name || user?.email || 'Employee'}
            </p>
            <p className="text-xs text-muted-foreground">
              Ready to process sales and serve customers
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Today's Sales"
            value={mySalesCount.toString()}
            icon={ShoppingCart}
            variant="success"
            trend="Sales processed"
          />
          <StatCard
            title="Products"
            value={products.length.toString()}
            icon={Package}
            variant="default"
            trend="Available items"
          />
          <StatCard
            title="Low Stock"
            value={lowStockItems.length.toString()}
            icon={AlertTriangle}
            variant={lowStockItems.length > 0 ? "destructive" : "default"}
            trend="Need attention"
          />
          <StatCard
            title="Active Credits"
            value={myCredits.length.toString()}
            icon={Users}
            variant="accent"
            trend="Customer credits"
          />
        </div>

        {/* Quick Actions */}
        {/* <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">New Sale</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
              <Users className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Add Customer</span>
            </button>
          </div>
        </div> */}

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-semibold text-sm text-foreground">Low Stock Alert</span>
              <span className="ml-auto text-xs font-medium bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                {lowStockItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {lowStockItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-destructive font-semibold">{item.stock} left</span>
                </div>
              ))}
              {lowStockItems.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{lowStockItems.length - 3} more items
                </p>
              )}
            </div>
          </div>
        )}

        {/* My Recent Sales */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            My Recent Sales
          </h3>
          <div className="space-y-3">
            {todaySales.slice(0, 5).map(sale => (
              <div key={sale.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{sale.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {sale.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">RWF {sale.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{sale.date}</p>
                </div>
              </div>
            ))}
            {todaySales.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No sales today yet</p>
            )}
          </div>
        </div>

        {/* My Active Credits */}
        {myCredits.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              My Active Credits
            </h3>
            <div className="space-y-2">
              {myCredits.slice(0, 3).map(credit => (
                <div key={credit.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-foreground">{credit.customerName}</p>
                    <p className="text-xs text-muted-foreground">{credit.productName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      RWF {Math.max(0, Number(credit.amountDue) - Number(credit.paidAmount)).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{credit.status}</p>
                  </div>
                </div>
              ))}
              {myCredits.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{myCredits.length - 3} more credits
                </p>
              )}
            </div>
          </div>
        )}

        {/* Information Banner */}
        <div className="rounded-xl border border-info/30 bg-info/5 p-4">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Employee Access</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can process sales, manage customers, and view your own activity. 
                For stock management, pricing changes, or expense tracking, please contact your manager.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
