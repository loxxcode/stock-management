import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/BottomNav";
import AppSidebar from "@/components/AppSidebar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stock from "./pages/Stock";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Employees from "./pages/Employees";
import EmployeeActivity from "./pages/EmployeeActivity";
import EmployeePerformance from "./pages/EmployeePerformance";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import AdminSettings from "./pages/AdminSettings";
import AdminDashboard from "./pages/AdminDashboard";
import SystemActivity from "./pages/SystemActivity";
import AuditLogs from "./pages/AuditLogs";
import ManagerDashboard from "./pages/ManagerDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import MyActivity from "./pages/MyActivity";

const queryClient = new QueryClient();

const AppShell = () => {
  const location = useLocation();
  const isAuthLayoutRoute = ["/login", "/register", "/reset-password"].includes(location.pathname);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto min-h-screen max-w-7xl">
        <AppSidebar />
        <main className={isAuthLayoutRoute ? "min-h-screen" : "min-h-screen lg:ml-72 lg:pt-6"}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/manager/dashboard" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/employee/dashboard" element={<ProtectedRoute allowedRoles={["employee"]}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute allowedRoles={["manager", "employee"]}><Products /></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute allowedRoles={["manager"]}><Stock /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute allowedRoles={["manager", "employee"]}><Sales /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute allowedRoles={["manager", "employee"]}><Expenses /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute allowedRoles={["manager"]}><Employees /></ProtectedRoute>} />
            <Route path="/employees/:employeeId/activity" element={<ProtectedRoute allowedRoles={["manager"]}><EmployeeActivity /></ProtectedRoute>} />
            <Route path="/employees/:employeeId/performance" element={<ProtectedRoute allowedRoles={["manager"]}><EmployeePerformance /></ProtectedRoute>} />
            <Route path="/employee/dashboard" element={<ProtectedRoute allowedRoles={["employee"]}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/my-activity" element={<ProtectedRoute allowedRoles={["employee"]}><MyActivity /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={["manager"]}><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={["admin"]}><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/activity" element={<ProtectedRoute allowedRoles={["admin"]}><SystemActivity /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLogs /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Admin /></ProtectedRoute>} />
            <Route path="/admin/managers/:employeeId/activity" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeeActivity /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <BottomNav />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
