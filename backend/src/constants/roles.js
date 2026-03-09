'use strict';

const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  SALES: 'sales',
  ACCOUNTANT: 'accountant',
  USER: 'user',
});

// Role hierarchy (higher index = higher privilege)
const ROLE_HIERARCHY = [
  ROLES.USER,
  ROLES.SALES,
  ROLES.ACCOUNTANT,
  ROLES.WAREHOUSE_MANAGER,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

/**
 * Route-level permissions matrix.
 * Key: 'METHOD /path/pattern'
 * Value: array of allowed roles
 * super_admin: full access (checked in middleware).
 * admin: full CRUD on most resources.
 * warehouse_manager: inventory, transfers, stock, GRN, PO, pick lists, challans.
 * sales: orders, customers, pick lists.
 * accountant: invoices, payments, reports.
 * user: read-only where granted.
 */
const PERMISSIONS = {
  // Setup
  'GET /warehouses':         [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES, ROLES.ACCOUNTANT],
  'POST /warehouses':        [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /warehouses/:id':     [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /warehouses/:id':  [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Users
  'GET /users':              [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'POST /users':             [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /users/:id':          [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /users/:id':       [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Products / Master
  'GET /products':           Object.values(ROLES),
  'POST /products':          [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /products/:id':       [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'GET /customers':          [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES, ROLES.ACCOUNTANT],
  'POST /customers':         [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'PUT /customers/:id':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'DELETE /customers/:id':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'GET /vendors':            [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTANT],
  'POST /vendors':           [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /vendors/:id':        [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /vendors/:id':     [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Purchase
  'GET /purchase-orders':    [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /purchase-orders':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /purchase-orders/:id':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /purchase-orders/:id/confirm': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /purchase-orders/:id': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'GET /grn':                [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /grn':               [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /grn/:id/post':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],

  // Stock / Inventory
  'GET /stock/ledger':       [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'GET /stock/summary':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /stock-transfers':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /stock-transfers/:id':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /stock-transfers/:id/execute': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /stock-adjustments': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /stock-adjustments/:id/approve':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],

  // Sales Orders
  'GET /sales-orders':       [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES, ROLES.ACCOUNTANT],
  'GET /sales-orders/:id':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES, ROLES.ACCOUNTANT],
  'POST /sales-orders':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'PUT /sales-orders/:id':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES],
  'DELETE /sales-orders/:id':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES],
  'POST /sales-orders/:id/confirm': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],

  // Pick lists, Challans, Invoices, Returns
  'GET /pick-lists':         [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES],
  'POST /pick-lists':        [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'PUT /pick-lists/:id':     [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES],
  'GET /delivery-challans':  [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /delivery-challans': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'GET /invoices':           [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'POST /invoices':          [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'POST /invoices/:id/issue':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'GET /sales-returns':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /sales-returns':     [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],

  // Accounts
  'POST /customer-payments': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'POST /vendor-payments':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],

  // Reports
  'GET /reports':            [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
};

module.exports = { ROLES, ROLE_HIERARCHY, PERMISSIONS };
