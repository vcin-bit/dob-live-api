// lib/resolvePayRate.js
// Resolves the pay_rate for a new shift from officer_rates.
// Never trusts a rate supplied by the client — always derives from the DB.
//
// Priority:
//  1. Active officer_rates row matching officer_id + site_id, effective at shiftStart
//  2. Active officer_rates row for officer_id with site_id IS NULL (general rate)
//  3. patternPayRate — the pay_rate on the shift pattern, if the shift came from one
//  4. null — caller must surface a warning; never persist a zero

const supabase = require('./supabase');

/**
 * @param {object} opts
 * @param {string}      opts.companyId
 * @param {string}      opts.officerId
 * @param {string}      opts.siteId
 * @param {string|Date} opts.shiftStart   ISO timestamp of the shift start_time
 * @param {number|null} [opts.patternPayRate]  pay_rate from the originating shift_pattern, if any
 * @returns {Promise<{ rate: number|null, source: string, warning: string|null }>}
 */
async function resolvePayRate({ companyId, officerId, siteId, shiftStart, patternPayRate = null }) {
  const start = new Date(shiftStart).toISOString();

  // Fetch all active rates for this officer in this company that are effective at shiftStart.
  // The or() filter covers: effective_to IS NULL (open-ended) or effective_to > shiftStart.
  const { data: rates, error } = await supabase
    .from('officer_rates')
    .select('id, site_id, hourly_rate')
    .eq('company_id', companyId)
    .eq('officer_id', officerId)
    .eq('active', true)
    .lte('effective_from', start)
    .or(`effective_to.is.null,effective_to.gt.${start}`);

  if (error) throw error;

  // 1. Site-specific rate
  const siteRate = (rates || []).find(r => r.site_id === siteId);
  if (siteRate) return { rate: Number(siteRate.hourly_rate), source: 'officer_rates:site', warning: null };

  // 2. General rate (no site restriction)
  const generalRate = (rates || []).find(r => r.site_id === null);
  if (generalRate) return { rate: Number(generalRate.hourly_rate), source: 'officer_rates:general', warning: null };

  // 3. Pattern pay rate
  if (patternPayRate != null) return { rate: Number(patternPayRate), source: 'shift_pattern', warning: null };

  // 4. No rate found — return null so the caller can warn rather than silently persist £0
  return {
    rate: null,
    source: 'none',
    warning: `No pay rate found for this officer at this site. Add a rate in officer_rates so the shift can be paid correctly.`,
  };
}

module.exports = { resolvePayRate };
