'use strict';
/**
 * CSV Product Import Service
 * Parses a CSV file and bulk-imports products with full validation.
 * Expected CSV columns (case-insensitive):
 *   name, code, category, size_label, size_length_mm, size_width_mm,
 *   pieces_per_box, sqft_per_box, gst_rate, mrp, reorder_level_boxes,
 *   brand, hsn_code, description, is_active
 */
const { query } = require('../../config/db');
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * Parse a CSV string into an array of row objects (header-keyed).
 */
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new AppError('CSV must have a header row and at least one data row', 400, 'INVALID_CSV');

  // Normalise header keys → lower_snake_case
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));

  return lines.slice(1).map((line, idx) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim().replace(/^"(.*)"$/, '$1'); // strip surrounding quotes
    });
    row.__rowNumber = idx + 2; // 1-based, header = row 1
    return row;
  });
}

/**
 * Resolve a category name to its ID (or null if not found).
 */
async function resolveCategoryId(name, tenantId) {
  if (!name) return null;
  const rows = await query(
    `SELECT id FROM product_categories WHERE LOWER(name) = LOWER(?) AND tenant_id = ? LIMIT 1`,
    [name.trim(), tenantId]
  );
  return rows[0]?.id ?? null;
}

/**
 * Main import function.
 * Returns { imported, skipped, errors }
 */
const importFromCsv = async (tenantId, csvText) => {
  const rows = parseCsv(csvText);
  const results = { imported: 0, skipped: 0, errors: [] };

  // Cache category lookups to avoid N+1
  const categoryCache = {};

  for (const row of rows) {
    const rowNum = row.__rowNumber;
    try {
      // ── Validate required fields ────────────────────────────────────────────
      const missingFields = [];
      if (!row.name)               missingFields.push('name');
      if (!row.code)               missingFields.push('code');
      if (!row.size_label)         missingFields.push('size_label');
      if (!row.size_length_mm)     missingFields.push('size_length_mm');
      if (!row.size_width_mm)      missingFields.push('size_width_mm');
      if (!row.pieces_per_box)     missingFields.push('pieces_per_box');
      if (!row.sqft_per_box)       missingFields.push('sqft_per_box');

      if (missingFields.length > 0) {
        results.errors.push({ row: rowNum, code: row.code || '(unknown)', error: `Missing required fields: ${missingFields.join(', ')}` });
        results.skipped++;
        continue;
      }

      // ── Duplicate SKU check ─────────────────────────────────────────────────
      const existing = await repo.findByCode(row.code, tenantId);
      if (existing) {
        results.errors.push({ row: rowNum, code: row.code, error: `SKU '${row.code}' already exists — skipped` });
        results.skipped++;
        continue;
      }

      // ── Resolve category ────────────────────────────────────────────────────
      let categoryId = null;
      if (row.category) {
        if (categoryCache[row.category] !== undefined) {
          categoryId = categoryCache[row.category];
        } else {
          categoryId = await resolveCategoryId(row.category, tenantId);
          categoryCache[row.category] = categoryId;
        }
        if (!categoryId) {
          results.errors.push({ row: rowNum, code: row.code, error: `Category '${row.category}' not found — product imported without category` });
        }
      }

      // ── Numeric coercions ───────────────────────────────────────────────────
      const sizeLengthMm  = parseFloat(row.size_length_mm)  || 0;
      const sizeWidthMm   = parseFloat(row.size_width_mm)   || 0;
      const piecesPerBox  = parseFloat(row.pieces_per_box)  || 0;
      const sqftPerBox    = parseFloat(row.sqft_per_box)    || 0;
      const gstRate       = parseFloat(row.gst_rate)        || 18;
      const mrp           = row.mrp ? parseFloat(row.mrp)  : null;
      const reorderLevel  = parseInt(row.reorder_level_boxes) || 0;
      const isActive      = !row.is_active || ['true', '1', 'yes', 'active'].includes(row.is_active.toLowerCase());

      // ── Create product ──────────────────────────────────────────────────────
      await repo.create({
        tenantId,
        categoryId,
        name: row.name,
        code: row.code,
        description: row.description || null,
        sizeLengthMm,
        sizeWidthMm,
        sizeThicknessMm: null,
        sizeLabel: row.size_label,
        piecesPerBox,
        sqftPerBox,
        sqmtPerBox: null,
        weightPerBoxKg: null,
        finish: row.finish || null,
        material: row.material || null,
        brand: row.brand || null,
        hsnCode: row.hsn_code || null,
        gstRate,
        mrp,
        reorderLevelBoxes: reorderLevel,
        barcode: row.barcode || null,
        imageUrl: null,
        isActive,
      });

      results.imported++;
    } catch (err) {
      results.errors.push({ row: rowNum, code: row.code || '(unknown)', error: err.message });
      results.skipped++;
    }
  }

  return results;
};

module.exports = { importFromCsv };
