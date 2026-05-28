'use strict';

const { query } = require('../../config/db');
const { parsePagination } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../../middlewares/error.middleware');

const DEFAULT_SETTINGS = {
  earn_rate_amount: 100,
  earn_rate_points: 1,
  point_value_amount: 1,
  min_redeem_points: 1,
  max_redeem_percent: 25,
  cashback_percent: 0,
  referral_reward_points: 50,
  tiers: [
    { name: 'Bronze', min_points: 0, benefit: 'Standard loyalty benefits' },
    { name: 'Silver', min_points: 500, benefit: 'Priority promotions' },
    { name: 'Gold', min_points: 1500, benefit: 'Higher-value offers' },
  ],
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeSettings = (row) => {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    earn_rate_amount: toNumber(row.earn_rate_amount, DEFAULT_SETTINGS.earn_rate_amount),
    earn_rate_points: toNumber(row.earn_rate_points, DEFAULT_SETTINGS.earn_rate_points),
    point_value_amount: toNumber(row.point_value_amount, DEFAULT_SETTINGS.point_value_amount),
    min_redeem_points: toNumber(row.min_redeem_points, DEFAULT_SETTINGS.min_redeem_points),
    max_redeem_percent: toNumber(row.max_redeem_percent, DEFAULT_SETTINGS.max_redeem_percent),
    cashback_percent: toNumber(row.cashback_percent, DEFAULT_SETTINGS.cashback_percent),
    referral_reward_points: toNumber(row.referral_reward_points, DEFAULT_SETTINGS.referral_reward_points),
    tiers: parseJson(row.tiers_json, DEFAULT_SETTINGS.tiers),
  };
};

const getSettings = async (tenantId) => {
  const rows = await query('SELECT * FROM loyalty_settings WHERE tenant_id = ? LIMIT 1', [tenantId]);
  return normalizeSettings(rows[0]);
};

const upsertSettings = async (tenantId, userId, data) => {
  const current = await getSettings(tenantId);
  const settings = {
    ...current,
    earn_rate_amount: Math.max(1, toNumber(data.earn_rate_amount, current.earn_rate_amount)),
    earn_rate_points: Math.max(0, toNumber(data.earn_rate_points, current.earn_rate_points)),
    point_value_amount: Math.max(0, toNumber(data.point_value_amount, current.point_value_amount)),
    min_redeem_points: Math.max(0, toNumber(data.min_redeem_points, current.min_redeem_points)),
    max_redeem_percent: Math.min(100, Math.max(0, toNumber(data.max_redeem_percent, current.max_redeem_percent))),
    cashback_percent: Math.min(100, Math.max(0, toNumber(data.cashback_percent, current.cashback_percent))),
    referral_reward_points: Math.max(0, toNumber(data.referral_reward_points, current.referral_reward_points)),
    tiers: Array.isArray(data.tiers) ? data.tiers : current.tiers,
  };

  await query(
    `INSERT INTO loyalty_settings
       (id, tenant_id, earn_rate_amount, earn_rate_points, point_value_amount, min_redeem_points,
        max_redeem_percent, cashback_percent, referral_reward_points, tiers_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       earn_rate_amount = VALUES(earn_rate_amount),
       earn_rate_points = VALUES(earn_rate_points),
       point_value_amount = VALUES(point_value_amount),
       min_redeem_points = VALUES(min_redeem_points),
       max_redeem_percent = VALUES(max_redeem_percent),
       cashback_percent = VALUES(cashback_percent),
       referral_reward_points = VALUES(referral_reward_points),
       tiers_json = VALUES(tiers_json),
       updated_at = NOW()`,
    [
      uuidv4(),
      tenantId,
      settings.earn_rate_amount,
      settings.earn_rate_points,
      settings.point_value_amount,
      settings.min_redeem_points,
      settings.max_redeem_percent,
      settings.cashback_percent,
      settings.referral_reward_points,
      JSON.stringify(settings.tiers),
      userId,
    ]
  );
  return getSettings(tenantId);
};

const getBalance = async (tenantId, customerId, trx = null) => {
  const executor = trx ?? { query };
  const rows = await executor.query(
    `SELECT
       COALESCE(SUM(points_delta), 0) AS points_balance,
       COALESCE(SUM(cashback_delta), 0) AS cashback_balance
     FROM loyalty_transactions
     WHERE tenant_id = ? AND customer_id = ? AND status = 'posted'`,
    [tenantId, customerId]
  );
  return {
    points_balance: toNumber(rows[0]?.points_balance),
    cashback_balance: toNumber(rows[0]?.cashback_balance),
  };
};

const getTier = (settings, points) => {
  const tiers = [...(settings.tiers || [])].sort((a, b) => toNumber(b.min_points) - toNumber(a.min_points));
  return tiers.find((tier) => points >= toNumber(tier.min_points)) || tiers[tiers.length - 1] || DEFAULT_SETTINGS.tiers[0];
};

const calculateEarnedPoints = (settings, amount) => {
  const rateAmount = Math.max(1, toNumber(settings.earn_rate_amount, 100));
  const ratePoints = Math.max(0, toNumber(settings.earn_rate_points, 1));
  return Math.floor(Math.max(0, toNumber(amount)) / rateAmount) * ratePoints;
};

const calculateCashback = (settings, amount) => {
  return Math.round((Math.max(0, toNumber(amount)) * toNumber(settings.cashback_percent)) / 100 * 100) / 100;
};

const calculateRedemption = async (tenantId, customerId, requestedPoints, orderAmount, trx = null) => {
  const settings = await getSettings(tenantId);
  const points = Math.floor(Math.max(0, toNumber(requestedPoints)));
  if (points <= 0) return { points, discount: 0 };
  if (points < settings.min_redeem_points) {
    throw new AppError(`Minimum redemption is ${settings.min_redeem_points} points`, 400, 'LOYALTY_MIN_REDEEM');
  }
  const balance = await getBalance(tenantId, customerId, trx);
  if (points > balance.points_balance) {
    throw new AppError('Customer does not have enough loyalty points', 400, 'LOYALTY_INSUFFICIENT_POINTS');
  }
  const maxDiscount = Math.max(0, toNumber(orderAmount)) * (settings.max_redeem_percent / 100);
  const requestedDiscount = points * settings.point_value_amount;
  return {
    points,
    discount: Math.min(requestedDiscount, maxDiscount),
  };
};

const addTransaction = async (tenantId, userId, data, trx = null) => {
  const executor = trx ?? { query };
  const id = uuidv4();
  await executor.query(
    `INSERT INTO loyalty_transactions
       (id, tenant_id, customer_id, sales_order_id, type, points_delta, cashback_delta,
        description, sales_channel, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      data.customer_id,
      data.sales_order_id || null,
      data.type,
      toNumber(data.points_delta),
      toNumber(data.cashback_delta),
      data.description || null,
      data.sales_channel || 'offline',
      data.status || 'posted',
      userId || null,
    ]
  );
  return id;
};

const postSalesOrderRewards = async (trx, tenantId, userId, salesOrder) => {
  const existing = await trx.query(
    `SELECT id FROM loyalty_transactions
     WHERE tenant_id = ? AND sales_order_id = ? AND type IN ('earn', 'redeem') LIMIT 1`,
    [tenantId, salesOrder.id]
  );
  if (existing.length) return;

  const settings = await getSettings(tenantId);
  const redeemPoints = Math.floor(toNumber(salesOrder.loyalty_points_redeemed));
  if (redeemPoints > 0) {
    await calculateRedemption(tenantId, salesOrder.customer_id, redeemPoints, salesOrder.sub_total, trx);
    await addTransaction(tenantId, userId, {
      customer_id: salesOrder.customer_id,
      sales_order_id: salesOrder.id,
      type: 'redeem',
      points_delta: -redeemPoints,
      cashback_delta: 0,
      description: `Redeemed on order ${salesOrder.so_number}`,
      sales_channel: salesOrder.sales_channel || 'offline',
    }, trx);
  }

  const earnedPoints = calculateEarnedPoints(settings, salesOrder.grand_total);
  const cashback = calculateCashback(settings, salesOrder.grand_total);
  if (earnedPoints > 0 || cashback > 0) {
    await addTransaction(tenantId, userId, {
      customer_id: salesOrder.customer_id,
      sales_order_id: salesOrder.id,
      type: 'earn',
      points_delta: earnedPoints,
      cashback_delta: cashback,
      description: `Earned from order ${salesOrder.so_number}`,
      sales_channel: salesOrder.sales_channel || 'offline',
    }, trx);
  }

  await trx.query(
    `UPDATE sales_orders
     SET loyalty_points_earned = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [earnedPoints, salesOrder.id, tenantId]
  );
};

const getCustomerSummaries = async (tenantId, params = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(params, ['name', 'points_balance', 'cashback_balance', 'created_at']);
  const conditions = ['c.tenant_id = ?', 'c.is_active = 1'];
  const values = [tenantId];
  if (search) {
    conditions.push('(c.name LIKE ? OR c.code LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.join(' AND ');
  const orderColumn = sortBy === 'points_balance' || sortBy === 'cashback_balance' ? sortBy : `c.${sortBy}`;
  const settings = await getSettings(tenantId);

  const [rows, count] = await Promise.all([
    query(
      `SELECT c.id, c.name, c.code, c.phone, c.email, c.created_at,
              COALESCE(SUM(lt.points_delta), 0) AS points_balance,
              COALESCE(SUM(lt.cashback_delta), 0) AS cashback_balance
       FROM customers c
       LEFT JOIN loyalty_transactions lt
         ON lt.customer_id = c.id AND lt.tenant_id = c.tenant_id AND lt.status = 'posted'
       WHERE ${where}
       GROUP BY c.id
       ORDER BY ${orderColumn} ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      values
    ),
    query(`SELECT COUNT(*) AS total FROM customers c WHERE ${where}`, values),
  ]);

  return {
    rows: rows.map((row) => ({ ...row, tier: getTier(settings, toNumber(row.points_balance)) })),
    total: count[0]?.total ?? 0,
  };
};

const getOverview = async (tenantId) => {
  const settings = await getSettings(tenantId);
  const [summaryRows, recent, promos, referrals] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(points_delta), 0) AS active_points,
         COALESCE(SUM(cashback_delta), 0) AS active_cashback,
         COUNT(DISTINCT customer_id) AS enrolled_customers
       FROM loyalty_transactions
       WHERE tenant_id = ? AND status = 'posted'`,
      [tenantId]
    ),
    query(
      `SELECT lt.*, c.name AS customer_name, so.so_number
       FROM loyalty_transactions lt
       JOIN customers c ON c.id = lt.customer_id
       LEFT JOIN sales_orders so ON so.id = lt.sales_order_id
       WHERE lt.tenant_id = ?
       ORDER BY lt.created_at DESC
       LIMIT 10`,
      [tenantId]
    ),
    query(
      `SELECT COUNT(*) AS active_promotions
       FROM loyalty_promotions
       WHERE tenant_id = ? AND is_active = 1 AND (end_date IS NULL OR end_date >= CURDATE())`,
      [tenantId]
    ),
    query(
      `SELECT COUNT(*) AS referral_count
       FROM loyalty_referrals
       WHERE tenant_id = ?`,
      [tenantId]
    ),
  ]);

  return {
    settings,
    summary: {
      active_points: toNumber(summaryRows[0]?.active_points),
      active_cashback: toNumber(summaryRows[0]?.active_cashback),
      enrolled_customers: toNumber(summaryRows[0]?.enrolled_customers),
      active_promotions: toNumber(promos[0]?.active_promotions),
      referral_count: toNumber(referrals[0]?.referral_count),
    },
    recent_transactions: recent,
  };
};

const getTransactions = async (tenantId, params = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(params, ['created_at', 'type', 'points_delta']);
  const conditions = ['lt.tenant_id = ?'];
  const values = [tenantId];
  if (params.customer_id) {
    conditions.push('lt.customer_id = ?');
    values.push(params.customer_id);
  }
  if (params.type) {
    conditions.push('lt.type = ?');
    values.push(params.type);
  }
  if (search) {
    conditions.push('(c.name LIKE ? OR lt.description LIKE ? OR so.so_number LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.join(' AND ');
  const [rows, count] = await Promise.all([
    query(
      `SELECT lt.*, c.name AS customer_name, so.so_number
       FROM loyalty_transactions lt
       JOIN customers c ON c.id = lt.customer_id
       LEFT JOIN sales_orders so ON so.id = lt.sales_order_id
       WHERE ${where}
       ORDER BY lt.${sortBy} ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      values
    ),
    query(
      `SELECT COUNT(*) AS total
       FROM loyalty_transactions lt
       JOIN customers c ON c.id = lt.customer_id
       LEFT JOIN sales_orders so ON so.id = lt.sales_order_id
       WHERE ${where}`,
      values
    ),
  ]);
  return { rows, total: count[0]?.total ?? 0 };
};

const getPromotions = async (tenantId) => {
  return query(
    `SELECT * FROM loyalty_promotions
     WHERE tenant_id = ?
     ORDER BY is_active DESC, start_date DESC, created_at DESC`,
    [tenantId]
  );
};

const createPromotion = async (tenantId, userId, data) => {
  const id = uuidv4();
  await query(
    `INSERT INTO loyalty_promotions
       (id, tenant_id, name, description, offer_type, points_multiplier, cashback_percent,
        start_date, end_date, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      data.name,
      data.description || null,
      data.offer_type || 'points_multiplier',
      toNumber(data.points_multiplier, 1),
      toNumber(data.cashback_percent),
      data.start_date || new Date(),
      data.end_date || null,
      data.is_active === false ? 0 : 1,
      userId,
    ]
  );
  const rows = await query('SELECT * FROM loyalty_promotions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return rows[0];
};

const updatePromotion = async (tenantId, id, data) => {
  await query(
    `UPDATE loyalty_promotions
     SET name = ?, description = ?, offer_type = ?, points_multiplier = ?, cashback_percent = ?,
         start_date = ?, end_date = ?, is_active = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [
      data.name,
      data.description || null,
      data.offer_type || 'points_multiplier',
      toNumber(data.points_multiplier, 1),
      toNumber(data.cashback_percent),
      data.start_date || new Date(),
      data.end_date || null,
      data.is_active === false ? 0 : 1,
      id,
      tenantId,
    ]
  );
  const rows = await query('SELECT * FROM loyalty_promotions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return rows[0];
};

const getReferrals = async (tenantId) => {
  return query(
    `SELECT lr.*, rc.name AS referrer_name, nc.name AS referred_customer_name
     FROM loyalty_referrals lr
     JOIN customers rc ON rc.id = lr.referrer_customer_id
     LEFT JOIN customers nc ON nc.id = lr.referred_customer_id
     WHERE lr.tenant_id = ?
     ORDER BY lr.created_at DESC`,
    [tenantId]
  );
};

const createReferral = async (tenantId, userId, data) => {
  const id = uuidv4();
  await query(
    `INSERT INTO loyalty_referrals
       (id, tenant_id, referrer_customer_id, referred_customer_id, referral_code,
        status, reward_points, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      data.referrer_customer_id,
      data.referred_customer_id || null,
      data.referral_code || `REF-${Date.now()}`,
      data.status || 'pending',
      toNumber(data.reward_points, (await getSettings(tenantId)).referral_reward_points),
      data.notes || null,
      userId,
    ]
  );
  const rows = await query('SELECT * FROM loyalty_referrals WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return rows[0];
};

const completeReferral = async (tenantId, userId, id) => {
  const rows = await query('SELECT * FROM loyalty_referrals WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  const referral = rows[0];
  if (!referral) throw new AppError('Referral not found', 404, 'NOT_FOUND');
  if (referral.status === 'rewarded') return referral;

  await addTransaction(tenantId, userId, {
    customer_id: referral.referrer_customer_id,
    type: 'referral',
    points_delta: referral.reward_points,
    cashback_delta: 0,
    description: `Referral reward ${referral.referral_code}`,
  });
  await query(
    `UPDATE loyalty_referrals
     SET status = 'rewarded', rewarded_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  const updated = await query('SELECT * FROM loyalty_referrals WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return updated[0];
};

module.exports = {
  getSettings,
  upsertSettings,
  getBalance,
  calculateRedemption,
  postSalesOrderRewards,
  getCustomerSummaries,
  getOverview,
  getTransactions,
  addTransaction,
  getPromotions,
  createPromotion,
  updatePromotion,
  getReferrals,
  createReferral,
  completeReferral,
};
