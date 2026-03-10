-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: Remove stale product_racks entries for inactive/deleted products
-- Run this once to fix existing data inconsistencies (e.g. A-5 showing -40)
-- ─────────────────────────────────────────────────────────────────────────────

DELETE pr
FROM product_racks pr
JOIN products p ON pr.product_id = p.id
WHERE p.is_active = FALSE;

-- Also remove orphaned rows where the product no longer exists at all
DELETE pr
FROM product_racks pr
LEFT JOIN products p ON pr.product_id = p.id
WHERE p.id IS NULL;
