import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { role } = useAuth();

  // Route to role-specific dashboard
  if (role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (role === "manager") {
    return <Navigate to="/manager/dashboard" replace />;
  } else if (role === "employee") {
    return <Navigate to="/employee/dashboard" replace />;
  }

  // Fallback for unauthenticated or unknown roles
  return <Navigate to="/login" replace />;
}
