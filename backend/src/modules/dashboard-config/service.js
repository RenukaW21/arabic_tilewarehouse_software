'use strict';

const repo = require('./repository');

const DEFAULT_CONFIG = {
  widgets: {
    kpi_summary: true,
    kpi_secondary: true,
    chart_stock_by_category: true,
    table_recent_sales: true,
    table_recent_purchases: true,
    table_recent_grns: true,
    table_recent_transfers: true,
    table_low_stock: true,
    quick_actions: true,
  },
  kpis: {
    warehouses: true,
    products: true,
    vendors: true,
    customers: true,
    pending_pos: true,
    total_stock: true,
    monthly_sales: true,
    monthly_purchases: true,
    today_sales: true,
    month_revenue: true,
    unpaid_invoices: true,
    low_stock_count: true,
    active_pos: true,
    ledger_entries: true,
  },
  quick_actions: ['new_sale', 'new_purchase_order', 'new_grn', 'new_stock_transfer'],
};

const deepMerge = (base, incoming) => {
  const result = { ...base };
  for (const key of Object.keys(incoming)) {
    if (
      incoming[key] !== null &&
      typeof incoming[key] === 'object' &&
      !Array.isArray(incoming[key]) &&
      key in base &&
      typeof base[key] === 'object'
    ) {
      result[key] = deepMerge(base[key], incoming[key]);
    } else {
      result[key] = incoming[key];
    }
  }
  return result;
};

const getConfig = async (userId, tenantId) => {
  try {
    const saved = await repo.findByUser(userId, tenantId);
    if (!saved) return DEFAULT_CONFIG;
    return deepMerge(DEFAULT_CONFIG, saved);
  } catch {
    return DEFAULT_CONFIG;
  }
};

const saveConfig = async (userId, tenantId, incoming) => {
  const merged = deepMerge(DEFAULT_CONFIG, incoming);
  return repo.upsert(userId, tenantId, merged);
};

const resetConfig = async (userId, tenantId) => {
  await repo.remove(userId, tenantId);
};

module.exports = { getConfig, saveConfig, resetConfig, DEFAULT_CONFIG };
