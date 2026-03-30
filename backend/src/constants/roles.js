'use strict';

const ROLES = Object.freeze({
  SUPER_ADMIN:       'super_admin',
  ADMIN:             'admin',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  SUPERVISOR:        'supervisor',
  SALES:             'sales',
  ACCOUNTANT:        'accountant',
  WAREHOUSE_STAFF:   'warehouse_staff',
  VIEWER:            'viewer',
  USER:              'user',
});

// Role hierarchy (higher index = higher privilege)
const ROLE_HIERARCHY = [
  ROLES.VIEWER,
  ROLES.USER,
  ROLES.WAREHOUSE_STAFF,
  ROLES.SALES,
  ROLES.ACCOUNTANT,
  ROLES.SUPERVISOR,
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
  // Setup — admin+ only
  'GET /warehouses':         [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.SALES, ROLES.ACCOUNTANT, ROLES.WAREHOUSE_STAFF, ROLES.VIEWER],
  'POST /warehouses':        [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /warehouses/:id':     [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /warehouses/:id':  [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Users — admin+ only
  'GET /users':              [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'POST /users':             [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /users/:id':          [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /users/:id':       [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Products / Master
  'GET /products':           Object.values(ROLES),
  'POST /products':          [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /products/:id':       [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'GET /customers':          [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.SALES, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /customers':         [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'PUT /customers/:id':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'DELETE /customers/:id':   [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'GET /vendors':            [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /vendors':           [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'PUT /vendors/:id':        [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /vendors/:id':     [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Purchase — manager, supervisor can create/post GRN; accountant can view
  'GET /purchase-orders':    [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /purchase-orders':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /purchase-orders/:id':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /purchase-orders/:id/confirm': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'DELETE /purchase-orders/:id': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'GET /grn':                [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /grn':               [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR],
  'POST /grn/:id/post':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR],

  // Stock / Inventory
  'GET /stock/ledger':       [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'GET /stock/summary':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /stock-transfers':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /stock-transfers/:id':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /stock-transfers/:id/execute': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'POST /stock-adjustments': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],
  'PUT /stock-adjustments/:id/approve':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER],

  // Sales Orders
  'GET /sales-orders':       [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.SALES, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'GET /sales-orders/:id':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.SALES, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /sales-orders':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'PUT /sales-orders/:id':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES],
  'DELETE /sales-orders/:id':[ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'POST /sales-orders/:id/confirm': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],

  // Pick lists, Challans, Invoices, Returns
  'GET /pick-lists':         [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF, ROLES.SALES],
  'POST /pick-lists':        [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES],
  'PUT /pick-lists/:id':     [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF],
  'GET /delivery-challans':  [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /delivery-challans': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF],
  'GET /invoices':           [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /invoices':          [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'POST /invoices/:id/issue':[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'GET /sales-returns':      [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF, ROLES.ACCOUNTANT, ROLES.VIEWER],
  'POST /sales-returns':     [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SUPERVISOR, ROLES.WAREHOUSE_STAFF],

  // Accounts — accountant + admin
  'POST /customer-payments': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'POST /vendor-payments':   [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],

  // Reports — accountant, manager, viewer (read-only)
  'GET /reports':            [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTANT, ROLES.VIEWER],
};

module.exports = { ROLES, ROLE_HIERARCHY, PERMISSIONS };
