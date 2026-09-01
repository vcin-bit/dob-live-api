// lib/redact.js
// Strips financial fields from API responses at the response boundary.
// Applied on every route that returns shift, site, or pattern data.
//
// Note: SELECT grants on shift_pay_lines, overheads and overhead_weekly_cost
// have been revoked from the anon and authenticated Postgres roles at the
// database level. This module provides the equivalent protection at the API
// response layer for fields that live on the base tables (shifts, sites,
// shift_patterns).

// Always stripped for every non-privileged caller, including OFFICERs on their own records.
const ALWAYS_STRIP = new Set([
  'charge_rate',
  'bh_charge_rate',
  'approval_status',
  'adjusted_hours',
  'approved_by',
  'approved_at',
  'query_reason',
]);

// Visible to an OFFICER only on records where officer_id matches their own id.
// Stripped for all other roles and for OFFICERs viewing other officers' records.
const OWN_ONLY = new Set([
  'pay_rate',
  'bh_pay_rate',
  'bh_hours',
]);

const ALL_FINANCIAL = new Set([...ALWAYS_STRIP, ...OWN_ONLY]);

const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN', 'FD']);

/**
 * Remove financial fields from payload based on the requesting user's role and identity.
 *
 * - SUPER_ADMIN / FD: payload returned as-is.
 * - OFFICER: own records (officer_id === user.id) expose pay_rate, bh_pay_rate, bh_hours.
 *   All other records have those stripped. charge_rate, bh_charge_rate, and admin fields
 *   are always stripped, including on the officer's own records.
 * - All other roles: all financial fields stripped.
 * - Missing user, missing id, or absent role: fail-closed — strip everything.
 *
 * Ownership is determined from officer_id on the record itself, never from the request.
 * When recursing into nested objects or arrays, the ownership decision from the record
 * holding officer_id is carried down rather than re-evaluated at each level.
 *
 * @param {*}      payload  The data value returned from Supabase (object, array, or scalar)
 * @param {object} user     req.user — must have .id and .role
 * @returns The payload with financial fields removed according to the rules above
 */
function stripFinancialFields(payload, user) {
  if (!user || !user.id || !user.role) return redactAll(payload);
  if (PRIVILEGED_ROLES.has(user.role)) return payload;
  if (user.role === 'OFFICER') return redactOfficer(payload, user.id, undefined);
  return redactAll(payload);
}

// Strip all financial fields — used for non-privileged, non-officer roles.
function redactAll(value) {
  if (Array.isArray(value)) return value.map(redactAll);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (ALL_FINANCIAL.has(k)) continue;
      out[k] = redactAll(v);
    }
    return out;
  }
  return value;
}

// Strip financial fields for an OFFICER, allowing OWN_ONLY fields on records they own.
// isOwn: ownership inherited from the nearest ancestor record that carries officer_id.
//        undefined means no officer_id has been encountered yet — treat as not-own (safe default).
function redactOfficer(value, userId, isOwn) {
  if (Array.isArray(value)) return value.map(item => redactOfficer(item, userId, isOwn));
  if (value !== null && typeof value === 'object') {
    // Re-evaluate ownership only when this object itself carries officer_id.
    // Nested objects without officer_id (e.g. embedded site or officer name) inherit isOwn.
    const own = 'officer_id' in value ? value.officer_id === userId : isOwn;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (ALWAYS_STRIP.has(k)) continue;
      if (OWN_ONLY.has(k) && !own) continue;
      out[k] = redactOfficer(v, userId, own);
    }
    return out;
  }
  return value;
}

module.exports = { stripFinancialFields };
