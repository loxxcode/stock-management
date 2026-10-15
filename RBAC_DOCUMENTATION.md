# Role-Based Access Control (RBAC) Documentation

## Overview

This document describes the comprehensive RBAC system implemented for the Stock Management System. The system enforces security at multiple layers: database, API, and frontend, ensuring that users can only access data and perform actions appropriate to their role.

## Roles

### Admin
- **Purpose**: System monitoring and governance
- **Access**: User management, system activity monitoring, audit logs
- **Restrictions**: Cannot access sensitive business data (prices, profits, stock quantities, expenses)

### Manager
- **Purpose**: Business and stock management
- **Access**: Full access to products, stock, sales, customers, suppliers, expenses, reports, employees
- **Restrictions**: Cannot access Admin-only system settings

### Employee
- **Purpose**: Daily operational work
- **Access**: Sales processing, customer management, own activity, notifications
- **Restrictions**: Cannot modify stock, prices, expenses, or access Admin/Manager pages

## Permission Matrix

| Permission | Admin | Manager | Employee |
|-----------|-------|---------|----------|
| System Dashboard | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ |
| Role Management | ✅ | ❌ | ❌ |
| Product Details | ❌ | ✅ | Limited |
| Stock Quantity | ❌ | ✅ | ❌ |
| Purchase Price | ❌ | ✅ | ❌ |
| Selling Price | ❌ | ✅ | Limited |
| Add Stock | ❌ | ✅ | ❌ |
| Stock Adjustment | ❌ | ✅ | ❌ |
| Create Sale | ❌ | ✅ | ✅ |
| View All Sales | ❌ | ✅ | ❌ |
| View Own Sales | ❌ | ✅ | ✅ |
| Sales Activity Summary | ✅ | ✅ | Own |
| Profit | ❌ | ✅ | ❌ |
| Expenses | ❌ | ✅ | ❌ |
| Suppliers | ❌ | ✅ | ❌ |
| Customers | Limited | ✅ | ✅ |
| Employee Management | ✅ | ✅ | ❌ |
| Audit Logs | ✅ | Relevant | Own Activity |
| System Settings | ✅ | ❌ | ❌ |
| Notifications | ✅ | ✅ | ✅ |

## Database Schema Changes

### New Tables

#### audit_log
Comprehensive audit logging for all critical operations:
- `id`: UUID primary key
- `user_id`: UUID reference to auth.users
- `user_role`: app_role enum
- `action`: TEXT (create, update, delete, etc.)
- `entity`: TEXT (product, sale, user, etc.)
- `entity_id`: UUID
- `old_value`: JSONB
- `new_value`: JSONB
- `description`: TEXT
- `ip_address`: TEXT
- `created_at`: TIMESTAMPTZ

#### customers
Customer management:
- `id`: UUID primary key
- `name`: TEXT
- `phone`: TEXT
- `email`: TEXT
- `address`: TEXT
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

#### suppliers
Supplier management:
- `id`: UUID primary key
- `name`: TEXT
- `phone`: TEXT
- `email`: TEXT
- `address`: TEXT
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

### Enhanced Tables

#### sales
Added fields for sales ownership:
- `employee_id`: UUID (references auth.users)
- `manager_id`: UUID (references auth.users)
- `customer_id`: UUID
- `payment_method`: TEXT
- `status`: TEXT
- `updated_at`: TIMESTAMPTZ

#### activity_log
Enhanced for better audit tracking:
- `user_role`: app_role
- `entity`: TEXT
- `entity_id`: UUID
- `description`: TEXT
- `ip_address`: TEXT

### Database Views

#### admin_dashboard_view
Aggregated data for Admin dashboard (no sensitive data):
- `total_managers`: COUNT
- `total_employees`: COUNT
- `active_users`: COUNT
- `total_products`: COUNT
- `total_sales`: COUNT
- `recent_activities`: COUNT

#### sales_activity_summary
Sales activity by user (for Admin monitoring):
- `role`: app_role
- `full_name`: TEXT
- `sales_count`: COUNT
- `first_sale`: TIMESTAMPTZ
- `last_sale`: TIMESTAMPTZ

#### recent_system_activity
Recent system activities (for Admin monitoring):
- `action`: TEXT
- `entity`: TEXT
- `description`: TEXT
- `user_name`: TEXT
- `user_role`: app_role
- `created_at`: TIMESTAMPTZ

### Row Level Security (RLS) Policies

#### Products
- **Managers**: Full CRUD access
- **Employees**: Read-only access
- **Admin**: No access (via RLS)

#### Sales
- **Managers**: Full CRUD access
- **Employees**: Create and read own sales only
- **Admin**: No access (via RLS)

#### Expenses
- **Managers**: Full CRUD access
- **Employees**: No access
- **Admin**: No access

#### Stock Entries
- **Managers**: Full CRUD access
- **Employees**: No access
- **Admin**: No access

#### Audit Log
- **Admin**: Full read access
- **Managers**: Read access to relevant business logs
- **Employees**: Read access to own activity only

## API Security

### Data Filtering

All API responses are filtered based on user role:

#### Admin Response Example
```json
{
  "id": "123",
  "name": "Laptop"
}
```
(Sensitive fields like price, stock, profit are excluded)

#### Manager Response Example
```json
{
  "id": "123",
  "name": "Laptop",
  "price": 650000,
  "stock": 25,
  "category": "Electronics"
}
```

#### Employee Response Example
```json
{
  "id": "123",
  "name": "Laptop",
  "price": 650000,
  "stock": 25,
  "category": "Electronics"
}
```
(For sales, employees only see their own sales)

### Audit Logging

All critical operations are logged to the audit_log table:
- Product creation/update/deletion
- Stock adjustments
- Sales creation
- Expense creation
- User role changes
- Account activation/deactivation

## Frontend Security

### Route Protection

Routes are protected using the `ProtectedRoute` component:

```tsx
<ProtectedRoute allowedRoles={["admin"]}>
  <AdminDashboard />
</ProtectedRoute>
```

Unauthorized access displays the `AccessDenied` page instead of redirecting.

### Role-Based Navigation

Sidebar navigation is dynamically generated based on user role:

#### Admin Navigation
- Dashboard
- Users
- User Management
- System Activity
- Audit Logs
- Notifications
- System Settings

#### Manager Navigation
- Dashboard
- Products
- Stock
- Sales
- Customers
- Expenses
- Reports
- Employees
- Activity Log

#### Employee Navigation
- Dashboard
- Sales
- Customers
- My Activity
- Notifications

### Data Hiding

Frontend components conditionally render sensitive data:

```tsx
{!isEmployee && (
  <StatCard
    title="Revenue"
    value={`RWF ${totalRevenue.toLocaleString()}`}
  />
)}
```

## Migration Instructions

### Step 1: Apply Database Migration

Run the migration file in your Supabase project:

```bash
supabase db push
```

Or apply manually via Supabase SQL Editor:

```sql
-- Run the contents of:
-- supabase/migrations/20260920000000_enhance_rbac_system.sql
```

### Step 2: Update Application Code

The following files have been updated/created:

**New Files:**
- `src/pages/AdminDashboard.tsx` - Admin monitoring dashboard
- `src/pages/AccessDenied.tsx` - Access denied page

**Updated Files:**
- `src/lib/store.ts` - Role-specific data filtering
- `src/components/AppSidebar.tsx` - Role-based navigation
- `src/pages/Dashboard.tsx` - Hide sensitive data from Admin
- `src/pages/Admin.tsx` - Updated to User Management
- `src/components/ProtectedRoute.tsx` - Show AccessDenied page
- `src/App.tsx` - New routes with role protection

### Step 3: Create Admin User

After migration, create an admin user:

1. Create user in Supabase Auth
2. Update role in database:

```sql
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '<auth-user-id>';
```

### Step 4: Test Permissions

Verify the system works correctly:

#### Admin Tests
- ✅ Can access Admin dashboard
- ✅ Can manage users
- ✅ Can view activity logs
- ✅ Can see manager activity
- ❌ Cannot view stock quantity
- ❌ Cannot view purchase price
- ❌ Cannot view selling price
- ❌ Cannot view profit
- ❌ Cannot access Manager stock APIs

#### Manager Tests
- ✅ Can manage products
- ✅ Can manage stock
- ✅ Can manage sales
- ✅ Can view business reports
- ✅ Can monitor employees
- ❌ Cannot access Admin-only system settings

#### Employee Tests
- ✅ Can create sales
- ✅ Can view own sales
- ✅ Can manage permitted customers
- ❌ Cannot manage stock
- ❌ Cannot see purchase price
- ❌ Cannot see profit
- ❌ Cannot manage users
- ❌ Cannot access Admin pages
- ❌ Cannot access Manager pages

## Security Best Practices

### Backend Security
- Never trust role from frontend - always verify from database
- Use RLS policies at database level
- Implement audit logging for all critical operations
- Return minimal data based on user role

### Frontend Security
- Use ProtectedRoute for all protected pages
- Implement role-based navigation
- Conditionally render sensitive data
- Show AccessDenied page for unauthorized access

### Data Security
- Admin should never see financial data
- Employees should only see their own sales
- Managers have full business data access
- All role changes are logged

## Troubleshooting

### Issue: Admin can still see sensitive data
**Solution**: Ensure RLS policies are applied correctly and the migration has been run.

### Issue: Employees can access Manager pages
**Solution**: Check that route protection is properly configured in `App.tsx`.

### Issue: Audit logs not being created
**Solution**: Verify the `log_audit_event` function exists and is being called in store hooks.

### Issue: Sales ownership not tracking correctly
**Solution**: Ensure `employee_id` and `manager_id` are being set when creating sales.

## Future Enhancements

Potential improvements for the RBAC system:

1. **Granular Permissions**: Implement more fine-grained permissions within roles
2. **Time-Based Access**: Add time-based access restrictions
3. **IP Whitelisting**: Add IP-based access control for Admin
4. **Multi-Factor Authentication**: Add MFA for Admin and Manager roles
5. **Permission Groups**: Create permission groups for easier management
6. **Audit Log Export**: Add ability to export audit logs
7. **Real-time Monitoring**: Add real-time activity monitoring for Admin
8. **Custom Roles**: Allow creation of custom roles beyond the three defaults

## Support

For issues or questions about the RBAC system, refer to:
- Database migration file: `supabase/migrations/20260920000000_enhance_rbac_system.sql`
- Store hooks: `src/lib/store.ts`
- Authentication context: `src/contexts/AuthContext.tsx`
- Route protection: `src/components/ProtectedRoute.tsx`
