'use strict';
const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = (tenantId, q) => repo.findAll(tenantId, q);

const getById = async (id, tenantId) => {
  const grn = await repo.findById(id, tenantId);
  if (!grn) throw new AppError('GRN not found', 404, 'NOT_FOUND');
  return grn;
};

const create = async (tenantId, userId, data) => {
  const grnNumber = await generateDocNumber(tenantId, 'GRN', 'GRN');
  const trx = await beginTransaction();
  try {
    const grnId = await repo.createGRN(trx, {
      tenantId, grnNumber,
      purchaseOrderId: data.purchaseOrderId,
      vendorId: data.vendorId,
      warehouseId: data.warehouseId,
      receiptDate: data.receiptDate,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      vehicleNumber: data.vehicleNumber,
      notes: data.notes,
      createdBy: userId,
    });

    for (const item of data.items) {
      await repo.createGRNItem(trx, { tenantId, grnId, ...item });
    }

    await trx.commit();
    return repo.findById(grnId, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Post GRN — updates stock and changes status to 'posted'.
 * This is the critical transaction that moves goods into stock.
 */
const postGRN = async (id, tenantId, userId) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft' && grn.status !== 'verified') {
    throw new AppError(`GRN cannot be posted in status: ${grn.status}`, 400, 'INVALID_STATUS');
  }

  const trx = await beginTransaction();
  try {
    // Post each GRN item to stock; use sqft_per_box from products, not from GRN item
    for (const item of grn.items) {
      const netBoxes = parseFloat(item.received_boxes) - parseFloat(item.damaged_boxes || 0);
      if (netBoxes > 0) {
        const productRows = await trx.query(
          'SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?',
          [item.product_id, tenantId]
        );
        const sqftPerBox = productRows[0] ? parseFloat(productRows[0].sqft_per_box) || 0 : parseFloat(item.sqft_per_box || 0);
        await postStockMovement(trx, {
          tenantId,
          warehouseId: grn.warehouse_id,
          rackId: item.rack_id,
          productId: item.product_id,
          shadeId: item.shade_id,
          batchId: item.batch_id,
          transactionType: 'grn',
          referenceId: id,
          referenceType: 'grn',
          boxesIn: netBoxes,
          piecesIn: parseFloat(item.received_pieces || 0),
          sqftPerBox,
          notes: `GRN Posted: ${grn.grn_number}`,
          createdBy: userId,
        });
      }
    }

    await repo.updateStatus(trx, id, tenantId, 'posted');
    await repo.updatePOReceivedBoxes(trx, grn.purchase_order_id, tenantId);

    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const updateQuality = async (id, tenantId, itemId, qualityData) => {
  const { query } = require('../../config/db');
  await query(
    `UPDATE grn_items SET quality_status = ?, quality_notes = ?
     WHERE id = ? AND grn_id = ? AND tenant_id = ?`,
    [qualityData.qualityStatus, qualityData.qualityNotes || null, itemId, id, tenantId]
  );
  // If all items verified, update GRN status to verified
  const items = await query(
    `SELECT quality_status FROM grn_items WHERE grn_id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  const allVerified = items.every((i) => i.quality_status !== 'pending');
  if (allVerified) {
    await query(`UPDATE grn SET status = 'verified' WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  }
};

module.exports = { getAll, getById, create, postGRN, updateQuality };
