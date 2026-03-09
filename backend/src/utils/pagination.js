'use strict';

/**
 * Parse and validate pagination params from query string.
 * Returns { page, limit, offset, sortBy, sortOrder, search }
 */
const parsePagination = (query, allowedSortFields = ['created_at']) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const offset = (page - 1) * limit;

  const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : (allowedSortFields[0] || 'created_at');
  const search = query.search?.trim() || '';

  return { page, limit, offset, sortBy, sortOrder, search };
};

/**
 * Build a SQL WHERE clause fragment for a search term across given columns.
 * Returns { clause: string, params: any[] }
 */
const buildSearchClause = (search, columns) => {
  if (!search || !columns.length) return { clause: '', params: [] };
  const clause = columns.map((col) => `${col} LIKE ?`).join(' OR ');
  const params = columns.map(() => `%${search}%`);
  return { clause: `(${clause})`, params };
};

/**
 * Build filter WHERE fragments from a filter map.
 * filterMap = { dbColumn: queryValue }
 * Ignores undefined/null/empty values.
 */
const buildFilterClauses = (filterMap) => {
  const clauses = [];
  const params = [];
  for (const [col, val] of Object.entries(filterMap)) {
    if (val !== undefined && val !== null && val !== '') {
      clauses.push(`${col} = ?`);
      params.push(val);
    }
  }
  return { clauses, params };
};

module.exports = { parsePagination, buildSearchClause, buildFilterClauses };
