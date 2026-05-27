'use strict';

/**
 * Supplementary seed — adds data for pages NOT covered by the main seed:
 *   Pick Lists, Delivery Challans, Stock Transfers, Stock Adjustments,
 *   Damage Entries, Sales Returns, Purchase Returns, Stock Counts, Alerts.
 *
 * Run: node seed-extra.js
 * Safe to re-run: skips if data already exists for each section.
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { query, beginTransaction, testConnection } = require('./src/config/db');

const uuid = () => uuidv4();
const today = () => new Date().toISOString().slice(0, 10);
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

async function main() {
  await testConnection();
  console.log('[ExtraSeed] Connected to DB.');

  // ── Fetch existing context ──────────────────────────────────────────────────
  const tenants = await query("SELECT id FROM tenants WHERE is_dummy = 1 LIMIT 2");
  if (!tenants.length) {
    console.error('[ExtraSeed] No dummy tenants found. Run npm run seed first.');
    process.exit(1);
  }

  for (const tenant of tenants) {
    const tenantId = tenant.id;
    console.log(`\n[ExtraSeed] Processing tenant ${tenantId.slice(0, 8)}...`);

    const [warehouses, products, users, soRows, soItemRows, grnRows, grnItemRows, vendorRows, poRows, rackRows, batchRows] = await Promise.all([
      query("SELECT id FROM warehouses WHERE tenant_id = ? AND is_active = 1 LIMIT 4", [tenantId]),
      query("SELECT id FROM products   WHERE tenant_id = ? AND is_active = 1 LIMIT 20", [tenantId]),
      query("SELECT id FROM users      WHERE tenant_id = ? AND is_active = 1 LIMIT 5", [tenantId]),
      query("SELECT id, customer_id, warehouse_id FROM sales_orders WHERE tenant_id = ? LIMIT 4", [tenantId]),
      query("SELECT id, sales_order_id, product_id, shade_id, ordered_boxes, unit_price FROM sales_order_items WHERE tenant_id = ? LIMIT 10", [tenantId]),
      query("SELECT id, vendor_id FROM grn WHERE tenant_id = ? LIMIT 2", [tenantId]),
      query("SELECT id, grn_id, product_id, shade_id, batch_id, received_boxes, unit_price FROM grn_items WHERE tenant_id = ? LIMIT 6", [tenantId]),
      query("SELECT id FROM vendors WHERE tenant_id = ? LIMIT 5", [tenantId]),
      query("SELECT id, vendor_id FROM purchase_orders WHERE tenant_id = ? LIMIT 3", [tenantId]),
      query("SELECT id FROM racks WHERE tenant_id = ? LIMIT 8", [tenantId]),
      query("SELECT id, product_id FROM batches WHERE tenant_id = ? LIMIT 20", [tenantId]),
    ]);

    if (!warehouses.length || !products.length || !users.length) {
      console.log('[ExtraSeed] Skipping tenant — missing base data.');
      continue;
    }

    const adminId  = users[0].id;
    const wh1      = warehouses[0].id;
    const wh2      = warehouses[1]?.id ?? wh1;
    const yr       = new Date().getFullYear();

    // helper to pick by index mod length
    const pick = (arr, i) => arr[i % arr.length];
    const prodId  = (i) => pick(products, i).id;
    const rackId  = (i) => rackRows[i % rackRows.length]?.id ?? null;
    const batchId = (i) => batchRows[i % batchRows.length]?.id ?? null;

    const trx = await beginTransaction();
    try {

      // ── 1. Pick Lists ─────────────────────────────────────────────────────
      const existingPL = await trx.query("SELECT id FROM pick_lists WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingPL.length && soRows.length) {
        const plData = [
          { so: soRows[0], status: 'completed', daysAgo: 8 },
          { so: soRows[1] ?? soRows[0], status: 'in_progress', daysAgo: 3 },
          { so: soRows[2] ?? soRows[0], status: 'pending', daysAgo: 1 },
        ];
        for (let i = 0; i < plData.length; i++) {
          const { so, status, daysAgo } = plData[i];
          const plId = uuid();
          const pickNum = `PICK-${yr}-${String(i + 1).padStart(4, '0')}`;
          const whId = so.warehouse_id || wh1;
          await trx.query(
            `INSERT INTO pick_lists (id, tenant_id, sales_order_id, pick_number, warehouse_id, status, assigned_to, started_at, completed_at, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [plId, tenantId, so.id, pickNum, whId, status,
              adminId,
              status !== 'pending' ? addDays(today(), -(daysAgo - 1)) : null,
              status === 'completed' ? addDays(today(), -daysAgo + 1) : null,
              adminId]
          );
          // items — map from sales_order_items for this SO
          const soItems = soItemRows.filter(r => r.sales_order_id === so.id);
          for (const item of soItems) {
            await trx.query(
              `INSERT INTO pick_list_items (id, tenant_id, pick_list_id, sales_order_item_id, product_id, shade_id, batch_id, rack_id, requested_boxes, picked_boxes, picked_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuid(), tenantId, plId, item.id, item.product_id, item.shade_id, batchId(0),
               rackId(0), item.ordered_boxes,
               status === 'completed' ? item.ordered_boxes : status === 'in_progress' ? Number(item.ordered_boxes) * 0.5 : 0,
               status !== 'pending' ? addDays(today(), -(daysAgo - 1)) : null,
               status === 'completed' ? 'picked' : 'pending']
            );
          }
        }
        console.log('[ExtraSeed] Pick lists: 3');
      } else {
        console.log('[ExtraSeed] Pick lists: already seeded, skip.');
      }

      // ── 2. Delivery Challans ──────────────────────────────────────────────
      const existingDC = await trx.query("SELECT id FROM delivery_challans WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingDC.length && soRows.length) {
        const dcData = [
          { so: soRows[0], status: 'delivered', daysAgo: 7, vehicle: 'MH-12-AB-1234' },
          { so: soRows[1] ?? soRows[0], status: 'dispatched', daysAgo: 2, vehicle: 'UP-14-CD-5678' },
          { so: soRows[2] ?? soRows[0], status: 'draft', daysAgo: 0, vehicle: null },
        ];
        for (let i = 0; i < dcData.length; i++) {
          const { so, status, daysAgo, vehicle } = dcData[i];
          const dcId = uuid();
          const dcNum = `DC-${yr}-${String(i + 1).padStart(4, '0')}`;
          await trx.query(
            `INSERT INTO delivery_challans (id, tenant_id, dc_number, sales_order_id, customer_id, warehouse_id, dispatch_date, vehicle_number, transporter_name, status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [dcId, tenantId, dcNum, so.id, so.customer_id, so.warehouse_id || wh1,
             addDays(today(), -daysAgo), vehicle, vehicle ? 'Fast Logistics' : null, status, adminId]
          );
          const soItems = soItemRows.filter(r => r.sales_order_id === so.id);
          for (const item of soItems) {
            const sqft = (Number(item.ordered_boxes) * 13.38).toFixed(4);
            await trx.query(
              `INSERT INTO delivery_challan_items (id, tenant_id, delivery_challan_id, product_id, shade_id, dispatched_boxes, dispatched_pieces, dispatched_sqft, unit_price)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
              [uuid(), tenantId, dcId, item.product_id, item.shade_id, item.ordered_boxes, sqft, item.unit_price]
            );
          }
        }
        console.log('[ExtraSeed] Delivery challans: 3');
      } else {
        console.log('[ExtraSeed] Delivery challans: already seeded, skip.');
      }

      // ── 3. Stock Transfers ────────────────────────────────────────────────
      const existingST = await trx.query("SELECT id FROM stock_transfers WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingST.length) {
        const stData = [
          { status: 'received',   daysAgo: 10, fromWh: wh1, toWh: wh2 },
          { status: 'in_transit', daysAgo: 3,  fromWh: wh1, toWh: wh2 },
          { status: 'draft',      daysAgo: 1,  fromWh: wh2, toWh: wh1 },
        ];
        for (let i = 0; i < stData.length; i++) {
          const { status, daysAgo, fromWh, toWh } = stData[i];
          const stId = uuid();
          const trNum = `TR-${yr}-${String(i + 1).padStart(4, '0')}`;
          await trx.query(
            `INSERT INTO stock_transfers (id, tenant_id, transfer_number, from_warehouse_id, to_warehouse_id, status, transfer_date, received_date, vehicle_number, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [stId, tenantId, trNum, fromWh, toWh, status,
             addDays(today(), -daysAgo),
             status === 'received' ? addDays(today(), -daysAgo + 2) : null,
             `GJ-01-ZZ-${1000 + i}`, adminId]
          );
          // 2 items per transfer
          for (let j = 0; j < 2; j++) {
            const pId = prodId(i * 2 + j);
            await trx.query(
              `INSERT INTO stock_transfer_items (id, tenant_id, transfer_id, product_id, shade_id, batch_id, from_rack_id, to_rack_id, transferred_boxes, transferred_pieces, received_boxes, discrepancy_boxes)
               VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, 0)`,
              [uuid(), tenantId, stId, pId, batchId(j), rackId(j), rackId(j + 1),
               10 + j * 5,
               status === 'received' ? 10 + j * 5 : 0]
            );
          }
        }
        console.log('[ExtraSeed] Stock transfers: 3');
      } else {
        console.log('[ExtraSeed] Stock transfers: already seeded, skip.');
      }

      // ── 4. Stock Adjustments ──────────────────────────────────────────────
      const existingSA = await trx.query("SELECT id FROM stock_adjustments WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingSA.length) {
        const saData = [
          { type: 'add',    boxes: 10, reason: 'Found during cycle count', status: 'approved', daysAgo: 12 },
          { type: 'deduct', boxes: 5,  reason: 'Damaged tiles written off', status: 'approved', daysAgo: 6 },
          { type: 'add',    boxes: 8,  reason: 'Returns from site — good condition', status: 'pending', daysAgo: 1 },
          { type: 'deduct', boxes: 3,  reason: 'Stolen from site', status: 'pending', daysAgo: 0 },
        ];
        for (let i = 0; i < saData.length; i++) {
          const { type, boxes, reason, status, daysAgo } = saData[i];
          await trx.query(
            `INSERT INTO stock_adjustments (id, tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id, adjustment_type, boxes, pieces, reason, status, approved_by, approved_at, created_by, created_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NOW())`,
            [uuid(), tenantId, wh1, prodId(i), batchId(i), rackId(i), type, boxes, reason,
             status,
             status === 'approved' ? adminId : null,
             status === 'approved' ? addDays(today(), -daysAgo + 1) : null,
             adminId]
          );
        }
        console.log('[ExtraSeed] Stock adjustments: 4');
      } else {
        console.log('[ExtraSeed] Stock adjustments: already seeded, skip.');
      }

      // ── 5. Damage Entries ─────────────────────────────────────────────────
      const existingDE = await trx.query("SELECT id FROM damage_entries WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingDE.length) {
        const deData = [
          { boxes: 3, reason: 'Breakage during unloading', loss: 2100, daysAgo: 9 },
          { boxes: 2, reason: 'Water damage in storage',   loss: 1400, daysAgo: 5 },
          { boxes: 5, reason: 'Transit damage',            loss: 3500, daysAgo: 2 },
          { boxes: 1, reason: 'Incorrect stacking',        loss: 700,  daysAgo: 0 },
        ];
        for (let i = 0; i < deData.length; i++) {
          const { boxes, reason, loss, daysAgo } = deData[i];
          await trx.query(
            `INSERT INTO damage_entries (id, tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id, damage_date, damaged_boxes, damaged_pieces, damage_reason, estimated_loss, approved_by, created_by, created_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW())`,
            [uuid(), tenantId, wh1, prodId(i), batchId(i), rackId(i),
             addDays(today(), -daysAgo), boxes, reason, loss, adminId, adminId]
          );
        }
        console.log('[ExtraSeed] Damage entries: 4');
      } else {
        console.log('[ExtraSeed] Damage entries: already seeded, skip.');
      }

      // ── 6. Sales Returns ──────────────────────────────────────────────────
      const existingSR = await trx.query("SELECT id FROM sales_returns WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingSR.length && soRows.length) {
        const srData = [
          { so: soRows[0], status: 'completed', reason: 'Shade mismatch — wrong colour delivered', daysAgo: 6, boxes: 3 },
          { so: soRows[1] ?? soRows[0], status: 'received',   reason: 'Tiles cracked on arrival', daysAgo: 2, boxes: 2 },
          { so: soRows[2] ?? soRows[0], status: 'draft',      reason: 'Customer changed mind', daysAgo: 0, boxes: 4 },
        ];
        for (let i = 0; i < srData.length; i++) {
          const { so, status, reason, daysAgo, boxes } = srData[i];
          const srId = uuid();
          const srNum = `SR-${yr}-${String(i + 1).padStart(4, '0')}`;
          await trx.query(
            `INSERT INTO sales_returns (id, tenant_id, return_number, sales_order_id, customer_id, warehouse_id, return_date, return_reason, status, total_boxes, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [srId, tenantId, srNum, so.id, so.customer_id, so.warehouse_id || wh1,
             addDays(today(), -daysAgo), reason, status, boxes, adminId]
          );
          const soItems = soItemRows.filter(r => r.sales_order_id === so.id).slice(0, 1);
          for (const item of soItems) {
            await trx.query(
              `INSERT INTO sales_return_items (id, tenant_id, sales_return_id, sales_order_item_id, product_id, shade_id, returned_boxes, returned_pieces, inspection_result, good_boxes, damaged_boxes, unit_price, line_total)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'good', ?, 0, ?, ?)`,
              [uuid(), tenantId, srId, item.id, item.product_id, item.shade_id, boxes, boxes, item.unit_price, boxes * Number(item.unit_price)]
            );
          }
        }
        console.log('[ExtraSeed] Sales returns: 3');
      } else {
        console.log('[ExtraSeed] Sales returns: already seeded, skip.');
      }

      // ── 7. Purchase Returns ───────────────────────────────────────────────
      const existingPR = await trx.query("SELECT id FROM purchase_returns WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingPR.length && grnRows.length) {
        const prData = [
          { grn: grnRows[0], status: 'dispatched', reason: 'Defective batch — grade B supplied as A', daysAgo: 5, boxes: 4 },
          { grn: grnRows[1] ?? grnRows[0], status: 'acknowledged', reason: 'Over-supply — excess returned', daysAgo: 2, boxes: 6 },
        ];
        for (let i = 0; i < prData.length; i++) {
          const { grn, status, reason, daysAgo, boxes } = prData[i];
          const prId = uuid();
          const prNum = `PR-${yr}-${String(i + 1).padStart(4, '0')}`;
          const vid = grn.vendor_id || (vendorRows[i]?.id ?? vendorRows[0].id);
          await trx.query(
            `INSERT INTO purchase_returns (id, tenant_id, return_number, grn_id, vendor_id, warehouse_id, return_date, reason, status, total_boxes, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [prId, tenantId, prNum, grn.id, vid, wh1,
             addDays(today(), -daysAgo), reason, status, boxes, adminId]
          );
          const gItems = grnItemRows.filter(r => r.grn_id === grn.id).slice(0, 1);
          for (const item of gItems) {
            await trx.query(
              `INSERT INTO purchase_return_items (id, tenant_id, purchase_return_id, grn_item_id, product_id, shade_id, batch_id, returned_boxes, returned_pieces, unit_price, return_reason, line_total)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
              [uuid(), tenantId, prId, item.id, item.product_id, item.shade_id, item.batch_id,
               boxes, item.unit_price, reason, boxes * Number(item.unit_price)]
            );
          }
        }
        console.log('[ExtraSeed] Purchase returns: 2');
      } else {
        console.log('[ExtraSeed] Purchase returns: already seeded, skip.');
      }

      // ── 8. Stock Counts ───────────────────────────────────────────────────
      const existingSC = await trx.query("SELECT id FROM stock_counts WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingSC.length) {
        const scData = [
          { type: 'full',  status: 'completed', daysAgo: 14, wh: wh1 },
          { type: 'cycle', status: 'in_progress', daysAgo: 3, wh: wh1 },
          { type: 'spot',  status: 'draft', daysAgo: 0, wh: wh2 },
        ];
        for (let i = 0; i < scData.length; i++) {
          const { type, status, daysAgo, wh } = scData[i];
          const scId = uuid();
          const scNum = `CNT-${yr}-${String(i + 1).padStart(4, '0')}`;
          await trx.query(
            `INSERT INTO stock_counts (id, tenant_id, count_number, warehouse_id, count_type, status, count_date, started_at, completed_at, assigned_to, variance_boxes, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [scId, tenantId, scNum, wh, type, status,
             addDays(today(), -daysAgo),
             status !== 'draft' ? addDays(today(), -daysAgo) : null,
             status === 'completed' ? addDays(today(), -daysAgo + 1) : null,
             adminId, status === 'completed' ? -2 : 0, adminId]
          );
          // Add 5 count items per count
          const countProds = products.slice(i * 3, i * 3 + 5);
          for (let j = 0; j < countProds.length; j++) {
            const systemBoxes = 20 + j * 5;
            const countedBoxes = status === 'completed' ? systemBoxes - (j === 2 ? 2 : 0) : null;
            const variance = countedBoxes !== null ? countedBoxes - systemBoxes : 0;
            await trx.query(
              `INSERT INTO stock_count_items (id, tenant_id, stock_count_id, product_id, shade_id, batch_id, rack_id, system_boxes, counted_boxes, variance_boxes, status, counted_at)
               VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
              [uuid(), tenantId, scId, countProds[j].id, batchId(j), rackId(j),
               systemBoxes, countedBoxes, variance,
               status === 'completed' ? 'counted' : 'pending',
               status === 'completed' ? addDays(today(), -daysAgo + 1) : null]
            );
          }
        }
        console.log('[ExtraSeed] Stock counts: 3');
      } else {
        console.log('[ExtraSeed] Stock counts: already seeded, skip.');
      }

      // ── 9. Low Stock Alerts ───────────────────────────────────────────────
      const existingLA = await trx.query("SELECT id FROM low_stock_alerts WHERE tenant_id = ? LIMIT 1", [tenantId]);
      if (!existingLA.length) {
        const alertData = [
          { prodIdx: 0, stock: 6,  reorder: 10, status: 'open' },
          { prodIdx: 1, stock: 3,  reorder: 10, status: 'acknowledged' },
          { prodIdx: 2, stock: 8,  reorder: 10, status: 'open' },
          { prodIdx: 3, stock: 2,  reorder: 10, status: 'open' },
          { prodIdx: 4, stock: 9,  reorder: 10, status: 'resolved' },
        ];
        for (const a of alertData) {
          await trx.query(
            `INSERT INTO low_stock_alerts (id, tenant_id, warehouse_id, product_id, current_stock_boxes, reorder_level_boxes, status, alerted_at, resolved_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
            [uuid(), tenantId, wh1, prodId(a.prodIdx), a.stock, a.reorder, a.status,
             a.status === 'resolved' ? addDays(today(), -1) : null]
          );
        }
        console.log('[ExtraSeed] Low stock alerts: 5');
      } else {
        console.log('[ExtraSeed] Low stock alerts: already seeded, skip.');
      }

      await trx.commit();
      trx.release();
      console.log(`[ExtraSeed] Tenant ${tenantId.slice(0, 8)} done.`);

    } catch (err) {
      await trx.rollback();
      trx.release();
      console.error(`[ExtraSeed] Error for tenant ${tenantId.slice(0, 8)}:`, err.message);
      throw err;
    }
  }

  console.log('\n[ExtraSeed] All done!');
  console.log('  Pages now populated: Pick Lists, Delivery Challans, Stock Transfers,');
  console.log('  Stock Adjustments, Damage Entries, Sales Returns, Purchase Returns,');
  console.log('  Stock Counts, Low Stock Alerts.');
  process.exit(0);
}

main().catch(err => {
  console.error('[ExtraSeed] Fatal:', err.message);
  process.exit(1);
});
