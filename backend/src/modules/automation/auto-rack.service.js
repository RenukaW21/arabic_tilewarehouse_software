'use strict';
/**
 * Auto Rack Allocation Service
 *
 * Automatically assigns a product's boxes to the most-suitable rack in a
 * warehouse, respecting rack capacity limits.  Falls back to subsequent
 * racks when the preferred rack is full.
 *
 * Algorithm:
 *   1. Fetch all active racks in `warehouseId` ordered by available_boxes DESC
 *      (most free space first) so we fill gradually.
 *   2. Try to place `boxesNeeded` into the first rack that has capacity.
 *   3. If no single rack can hold all boxes, split across multiple racks
 *      (optional behaviour, controlled by `allowSplit`).
 *   4. Return the allocation plan (list of { rackId, rackName, boxes }).
 */
const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * Find the best available rack(s) for placing `boxesNeeded` boxes.
 *
 * @param {string} tenantId
 * @param {string} warehouseId
 * @param {number} boxesNeeded
 * @param {boolean} [allowSplit=false]  If true, spread across racks when one isn't enough
 * @returns {Array<{ rackId: string, rackName: string, availableBoxes: number, allocate: number }>}
 */
const findAvailableRacks = async (tenantId, warehouseId, boxesNeeded, allowSplit = false) => {
  if (!tenantId || !warehouseId) throw new AppError('tenantId and warehouseId are required', 400, 'VALIDATION_ERROR');
  if (!boxesNeeded || boxesNeeded <= 0) throw new AppError('boxesNeeded must be greater than 0', 400, 'VALIDATION_ERROR');

  // Fetch active racks with their live capacity usage
  const racks = await query(
    `SELECT r.id, r.name,
            r.capacity_boxes,
            COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0) AS occupied_boxes,
            (r.capacity_boxes - COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0)) AS available_boxes
     FROM racks r
     LEFT JOIN product_racks pr ON r.id = pr.rack_id
     LEFT JOIN products p ON pr.product_id = p.id
     WHERE r.tenant_id = ? AND r.warehouse_id = ? AND r.is_active = 1
     GROUP BY r.id
     HAVING available_boxes > 0
     ORDER BY available_boxes DESC`,
    [tenantId, warehouseId]
  );

  if (racks.length === 0) {
    throw new AppError('No racks with available capacity found in this warehouse', 400, 'NO_AVAILABLE_RACK');
  }

  let remaining = boxesNeeded;
  const plan = [];

  for (const rack of racks) {
    if (remaining <= 0) break;
    const avail = parseFloat(rack.available_boxes) || 0;
    if (avail <= 0) continue;

    // If first rack fits all — perfect, no split needed
    if (avail >= remaining) {
      plan.push({ rackId: rack.id, rackName: rack.name, availableBoxes: avail, allocate: remaining });
      remaining = 0;
      break;
    }

    // Only split if allowed
    if (allowSplit) {
      plan.push({ rackId: rack.id, rackName: rack.name, availableBoxes: avail, allocate: avail });
      remaining -= avail;
    } else {
      // No split — skip to next rack
      continue;
    }
  }

  if (remaining > 0) {
    if (allowSplit) {
      throw new AppError(`Insufficient total rack capacity. Still need ${remaining} more boxes.`, 400, 'INSUFFICIENT_CAPACITY');
    } else {
      throw new AppError(`No single rack has capacity for ${boxesNeeded} boxes. Try enabling split allocation.`, 400, 'INSUFFICIENT_SINGLE_RACK');
    }
  }

  return plan;
};

/**
 * Execute the auto-allocation: actually calls assignProductToRack for each rack in the plan.
 *
 * @param {string} tenantId
 * @param {string} productId
 * @param {string} warehouseId
 * @param {number} boxesNeeded
 * @param {boolean} [allowSplit=false]
 */
const autoAllocate = async (tenantId, productId, warehouseId, boxesNeeded, allowSplit = false) => {
  const rackService = require('../racks/rack.service');
  const plan = await findAvailableRacks(tenantId, warehouseId, boxesNeeded, allowSplit);

  const allocations = [];
  for (const slot of plan) {
    await rackService.assignProductToRack(tenantId, {
      product_id: productId,
      rack_id: slot.rackId,
      boxes_stored: slot.allocate,
    });
    allocations.push({ rackId: slot.rackId, rackName: slot.rackName, boxes: slot.allocate });
  }

  return { productId, warehouseId, totalBoxes: boxesNeeded, allocations };
};

module.exports = { findAvailableRacks, autoAllocate };
