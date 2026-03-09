'use strict';
const repo = require('./repository');
const { query, beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { postStockMovement } = require('../../utils/stockHelper');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const ret = await repo.findById(id, tenantId);
  if (!ret) throw new AppError('Sales return not found', 404, 'NOT_FOUND');
  const items = await repo.findItemsByReturnId(id, tenantId);
  return { ...ret, items };
};

/**
 * Create sales return (draft) with items.
 */
const create = async (tenantId, userId, data) => {
  const returnNumber = await generateDocNumber(tenantId, 'SR', 'SR');
  const id = uuidv4();
  let totalBoxes = 0;
  const items = (data.items || []).map((it) => {
    const boxes = parseFloat(it.returned_boxes) || 0;
    totalBoxes += boxes;
    const unitPrice = parseFloat(it.unit_price) || 0;
    const lineTotal = boxes * unitPrice;
    return { ...it, returned_boxes: boxes, unit_price: unitPrice, line_total: lineTotal };
  });

  const trx = await beginTransaction();
  try {
    await repo.create(trx, {
      id,
      tenant_id: tenantId,
      return_number: returnNumber,
      sales_order_id: data.sales_order_id || null,
      invoice_id: data.invoice_id || null,
      customer_id: data.customer_id,
      warehouse_id: data.warehouse_id,
      return_date: data.return_date || new Date(),
      return_reason: data.return_reason || 'Return',
      total_boxes: totalBoxes,
      notes: data.notes || null,
      created_by: userId,
    });
    for (const it of items) {
      await repo.createItem(trx, {
        tenant_id: tenantId,
        sales_return_id: id,
        sales_order_item_id: it.sales_order_item_id || null,
        product_id: it.product_id,
        shade_id: it.shade_id || null,
        batch_id: it.batch_id || null,
        returned_boxes: it.returned_boxes,
        returned_pieces: it.returned_pieces || 0,
        good_boxes: it.good_boxes ?? it.returned_boxes,
        damaged_boxes: it.damaged_boxes || 0,
        unit_price: it.unit_price,
        line_total: it.line_total,
      });
    }
    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Receive return: post stock_ledger (return), update stock_summary, set status received, create credit note.
 */
const receive = async (id, tenantId, userId) => {
  const ret = await getById(id, tenantId);
  if (ret.status !== 'draft') throw new AppError('Only draft returns can be received', 400, 'INVALID_STATUS');
  const warehouseId = ret.warehouse_id;
  if (!warehouseId) throw new AppError('Warehouse not set on return', 400, 'MISSING_WAREHOUSE');

  const productRows = await query(
    `SELECT id, sqft_per_box FROM products WHERE id IN (${ret.items.map((i) => '?').join(',')})`,
    ret.items.map((i) => i.product_id)
  );
  const sqftMap = new Map(productRows.map((r) => [r.id, parseFloat(r.sqft_per_box) || 0]));

  const cnNumber = await generateDocNumber(tenantId, 'CN', 'CN');
  const cnId = uuidv4();
  const trx = await beginTransaction();
  try {
    for (const item of ret.items) {
      // Only good_boxes go back to stock; damaged must not be added
      const boxesIn = parseFloat(item.good_boxes ?? 0) || 0;
      if (boxesIn <= 0) continue;
      const sqftPerBox = sqftMap.get(item.product_id) || 0;
      await postStockMovement(trx, {
        tenantId,
        warehouseId,
        rackId: null,
        productId: item.product_id,
        shadeId: item.shade_id || null,
        batchId: item.batch_id || null,
        transactionType: 'return',
        referenceId: id,
        referenceType: 'sales_return',
        boxesIn,
        boxesOut: 0,
        piecesIn: 0,
        piecesOut: 0,
        sqftPerBox,
        unitPrice: parseFloat(item.unit_price) || null,
        notes: `Return ${ret.return_number}`,
        createdBy: userId,
      });
    }
    await trx.query(`UPDATE sales_returns SET status = 'received' WHERE id = ? AND tenant_id = ?`, [id, tenantId]);

    const totalAmount = ret.items.reduce((sum, i) => sum + (parseFloat(i.line_total) || 0), 0);
    await trx.query(
      `INSERT INTO credit_notes
         (id, tenant_id, cn_number, customer_id, sales_return_id, cn_date, amount,
          cgst_amount, sgst_amount, igst_amount, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, 0, 0, 0, 'draft', ?, NOW())`,
      [cnId, tenantId, cnNumber, ret.customer_id, id, totalAmount, userId]
    );
    await trx.query(
      `UPDATE sales_returns SET credit_note_id = ? WHERE id = ? AND tenant_id = ?`,
      [cnId, id, tenantId]
    );

    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const update = async (id, tenantId, data) => {
  const ret = await getById(id, tenantId);
  if (ret.status !== 'draft') throw new AppError('Only draft returns can be updated', 400, 'INVALID_STATUS');

  const header = {
    customer_id: data.customer_id ?? ret.customer_id,
    warehouse_id: data.warehouse_id ?? ret.warehouse_id,
    return_date: data.return_date ?? ret.return_date,
    return_reason: data.return_reason ?? ret.return_reason,
    notes: data.notes !== undefined ? data.notes : ret.notes,
  };

  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    let totalBoxes = 0;
    const itemsWithTotal = data.items.map((it) => {
      const boxes = parseFloat(it.returned_boxes) || 0;
      totalBoxes += boxes;
      const unitPrice = parseFloat(it.unit_price) || 0;
      return { ...it, returned_boxes: boxes, unit_price: unitPrice, line_total: boxes * unitPrice };
    });
    header.total_boxes = totalBoxes;

    const trx = await beginTransaction();
    try {
      await repo.updateDraft(id, tenantId, header);
      await trx.query('DELETE FROM sales_return_items WHERE sales_return_id = ? AND tenant_id = ?', [id, tenantId]);
      for (const it of itemsWithTotal) {
        await repo.createItem(trx, {
          tenant_id: tenantId,
          sales_return_id: id,
          sales_order_item_id: it.sales_order_item_id || null,
          product_id: it.product_id,
          shade_id: it.shade_id || null,
          batch_id: it.batch_id || null,
          returned_boxes: it.returned_boxes,
          returned_pieces: it.returned_pieces || 0,
          good_boxes: it.good_boxes ?? it.returned_boxes,
          damaged_boxes: it.damaged_boxes || 0,
          unit_price: it.unit_price,
          line_total: it.line_total,
        });
      }
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    } finally {
      trx.release();
    }
  } else {
    await repo.updateDraft(id, tenantId, header);
  }

  return getById(id, tenantId);
};

const remove = async (id, tenantId) => {
  const ret = await repo.findById(id, tenantId);
  if (!ret) throw new AppError('Sales return not found', 404, 'NOT_FOUND');
  if (ret.status !== 'draft') throw new AppError('Only draft returns can be deleted', 400, 'INVALID_STATUS');
  await repo.deleteById(id, tenantId);
};

module.exports = { getAll, getById, create, receive, update, remove };
