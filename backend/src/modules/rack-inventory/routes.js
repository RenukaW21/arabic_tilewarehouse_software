'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { query } = require('../../config/db');
const { success, paginated } = require('../../utils/response');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');

router.use(authenticate);

router.get('/', async (req, res, next) => {
    try {
        const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(req.query, ['product_name', 'rack_name']);

        let baseSql = `
      SELECT pr.id, pr.product_id, pr.rack_id, pr.boxes_stored, 
             p.name as product_name, p.code as product_code, p.category_id,
             r.name as rack_name, w.name as warehouse_name
      FROM product_racks pr
      JOIN products p ON pr.product_id = p.id
      JOIN racks r ON pr.rack_id = r.id
      JOIN warehouses w ON r.warehouse_id = w.id
      WHERE pr.tenant_id = ? AND p.is_active = TRUE
    `;
        const params = [req.tenantId];

        if (search) {
            baseSql += ` AND (p.name LIKE ? OR p.code LIKE ? OR r.name LIKE ?)`;
            const searchStr = `%${search}%`;
            params.push(searchStr, searchStr, searchStr);
        }

        // sorting
        const sortField = sortBy === 'product_name' ? 'p.name' : sortBy === 'rack_name' ? 'r.name' : 'pr.updated_at';

        const countSql = `SELECT COUNT(*) as total FROM (${baseSql}) as sub`;
        const paginatedSql = `${baseSql} ORDER BY ${sortField} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`;

        const [rows, countRes] = await Promise.all([
            query(paginatedSql, params),
            query(countSql, params)
        ]);

        return paginated(res, rows, { page, limit, total: countRes[0].total }, 'Rack inventory fetched successfully');
    } catch (error) {
        next(error);
    }
});

router.delete('/:productId/:rackId', async (req, res, next) => {
    try {
        const { productId, rackId } = req.params;
        await query(
            'DELETE FROM product_racks WHERE product_id = ? AND rack_id = ? AND tenant_id = ?',
            [productId, rackId, req.tenantId]
        );

        const rackService = require('../racks/rack.service');
        await rackService.syncRackOccupancy(rackId, req.tenantId);

        return success(res, null, 'Rack assignment removed successfully');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
