/**
 * Role-based permissions for UI gating.
 * Mirrors backend PERMISSIONS so we can hide/disable actions by role.
 */
export type UserRole = 'super_admin' | 'admin' | 'warehouse_manager' | 'sales' | 'accountant' | 'user';

export type Resource =
  | 'warehouses'
  | 'users'
  | 'products'
  | 'customers'
  | 'vendors'
  | 'purchase-orders'
  | 'grn'
  | 'stock-ledger'
  | 'stock-transfers'
  | 'stock-adjustments'
  | 'sales-orders'
  | 'pick-lists'
  | 'delivery-challans'
  | 'invoices'
  | 'sales-returns'
  | 'reports';

export type Action = 'create' | 'read' | 'update' | 'delete';

const ALL_ROLES: UserRole[] = ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant', 'user'];

const PERMISSIONS: Record<Resource, Partial<Record<Action, UserRole[]>>> = {
  warehouses: { create: ['super_admin', 'admin'], read: ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant'], update: ['super_admin', 'admin'], delete: ['super_admin', 'admin'] },
  users: { create: ['super_admin', 'admin'], read: ['super_admin', 'admin'], update: ['super_admin', 'admin'], delete: ['super_admin', 'admin'] },
  products: { create: ['super_admin', 'admin'], read: ALL_ROLES, update: ['super_admin', 'admin'], delete: ['super_admin', 'admin'] },
  customers: { create: ['super_admin', 'admin', 'sales'], read: ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant'], update: ['super_admin', 'admin', 'sales'], delete: ['super_admin', 'admin', 'sales'] },
  vendors: { create: ['super_admin', 'admin'], read: ['super_admin', 'admin', 'warehouse_manager', 'accountant'], update: ['super_admin', 'admin'], delete: ['super_admin', 'admin'] },
  'purchase-orders': { create: ['super_admin', 'admin', 'warehouse_manager'], read: ['super_admin', 'admin', 'warehouse_manager'], update: ['super_admin', 'admin', 'warehouse_manager'], delete: ['super_admin', 'admin', 'warehouse_manager'] },
  grn: { create: ['super_admin', 'admin', 'warehouse_manager'], read: ['super_admin', 'admin', 'warehouse_manager'], update: ['super_admin', 'admin', 'warehouse_manager'], delete: ['super_admin', 'admin', 'warehouse_manager'] },
  'stock-ledger': { read: ['super_admin', 'admin', 'warehouse_manager'] },
  'stock-transfers': { create: ['super_admin', 'admin', 'warehouse_manager'], read: ['super_admin', 'admin', 'warehouse_manager'], update: ['super_admin', 'admin', 'warehouse_manager'], delete: ['super_admin', 'admin', 'warehouse_manager'] },
  'stock-adjustments': { create: ['super_admin', 'admin', 'warehouse_manager'], read: ['super_admin', 'admin', 'warehouse_manager'], update: ['super_admin', 'admin', 'warehouse_manager'], delete: ['super_admin', 'admin', 'warehouse_manager'] },
  'sales-orders': { create: ['super_admin', 'admin', 'sales'], read: ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant'], update: ['super_admin', 'admin', 'warehouse_manager', 'sales'], delete: ['super_admin', 'admin', 'warehouse_manager', 'sales'] },
  'pick-lists': { create: ['super_admin', 'admin', 'sales'], read: ['super_admin', 'admin', 'warehouse_manager', 'sales'], update: ['super_admin', 'admin', 'warehouse_manager', 'sales'], delete: ['super_admin', 'admin', 'warehouse_manager', 'sales'] },
  'delivery-challans': { create: ['super_admin', 'admin', 'warehouse_manager'], read: ['super_admin', 'admin', 'warehouse_manager'], update: ['super_admin', 'admin', 'warehouse_manager'], delete: ['super_admin', 'admin', 'warehouse_manager'] },
  invoices: { create: ['super_admin', 'admin', 'accountant'], read: ['super_admin', 'admin', 'accountant'], update: ['super_admin', 'admin', 'accountant'], delete: ['super_admin', 'admin', 'accountant'] },
  'sales-returns': { create: ['super_admin', 'admin', 'warehouse_manager'], read: ['super_admin', 'admin', 'warehouse_manager'], update: ['super_admin', 'admin', 'warehouse_manager'], delete: ['super_admin', 'admin', 'warehouse_manager'] },
  reports: { read: ['super_admin', 'admin', 'accountant'] },
};

export function can(userRole: UserRole | undefined, resource: Resource, action: Action): boolean {
  if (!userRole) return false;
  if (userRole === 'super_admin') return true;
  const roles = PERMISSIONS[resource]?.[action];
  if (!roles) return false;
  return roles.includes(userRole);
}
