// lib/redact.js
// Strips financial fields from API responses for callers whose role is not
// SUPER_ADMIN or FD. Applied at the response boundary only — select clauses and
// internal logic are unchanged.
//
// Note: SELECT grants on shift_pay_lines, overheads and overhead_weekly_cost
// have been revoked from the anon and authenticated Postgres roles at the
// database level. This module provides the equivalent protection at the API
// response layer for fields that live on the base tables (shifts, sites,
// shift_patterns).

const FINANCIAL_FIELDS = new Set([
  'pay_rate',
  'charge_rate',
  'bh_pay_rate',
  'bh_charge_rate',
  'approval_status',
  'adjusted_hours',
  'approved_by',
  'approved_at',
  'query_reason',
]);

const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN', 'FD']);

/**
 * Remove financial fields from payload unless the caller holds a privileged role.
 * Handles plain objects, arrays, and nested embedded objects recursively.
 *
 * @param {*} payload  The data value returned from Supabase (object, array, or scalar)
 * @param {string} role  The caller's role from req.user.role
 * @returns The payload with financial fields removed for non-privileged roles
 */
function stripFinancialFields(payload, role) {
  if (PRIVILEGED_ROLES.has(role)) return payload;
  return redact(payload);
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FINANCIAL_FIELDS.has(k)) continue;
      out[k] = redact(v);
    }
    return out;
  }
  return value;
}

module.exports = { stripFinancialFields };
