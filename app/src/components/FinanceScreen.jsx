import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const NAVY = '#14233F';
const RED  = '#C8102E';

function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const s = `£${abs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${s}` : s;
}

function fmtPct(margin, charge) {
  if (!charge) return '—';
  return ((margin / charge) * 100).toFixed(1) + '%';
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function monthRange(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to:   `${year}-${pad(month + 1)}-${pad(lastDay)}T23:59:59`,
  };
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function PanelHeader({ title, badge }) {
  return (
    <div style={{ background: NAVY, color: '#fff', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '3px', height: '1rem', background: RED, borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{title}</span>
      {badge != null && badge > 0 && (
        <span style={{ background: RED, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>{badge}</span>
      )}
    </div>
  );
}

function Panel({ title, children, attention }) {
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: attention ? `2px solid ${RED}` : '1px solid #e5e7eb' }}>
      <PanelHeader title={title} />
      <div style={{ background: '#fff' }}>{children}</div>
    </div>
  );
}

function PanelLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
      <div className="spinner" />
    </div>
  );
}

function PanelError({ message }) {
  return (
    <div style={{ padding: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
      Failed to load: {message}
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{ padding: '0.5rem 0.875rem', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: align, background: '#f8fafc', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', mono = false, negative = false, muted = false }) {
  return (
    <td style={{ padding: '0.5625rem 0.875rem', fontSize: '0.875rem', textAlign: align, fontFamily: mono ? "'Courier New', Courier, monospace" : undefined, color: negative ? RED : muted ? '#9ca3af' : '#111827', borderBottom: '1px solid #f1f5f9' }}>
      {children}
    </td>
  );
}

// ── Panel 1 & 2: Period totals + site margin (both from summary endpoint) ─────

function SummaryPanel({ data, loading, error }) {
  return (
    <Panel title="Period Totals">
      {loading && <PanelLoading />}
      {error   && <PanelError message={error} />}
      {!loading && !error && data && (() => {
        const charge  = data.total_charge_amount  || 0;
        const pay     = data.total_pay_amount     || 0;
        const margin  = data.total_margin_amount  || 0;
        const hours   = data.total_payable_hours  || 0;
        const negM    = margin < 0;
        const marginPct = charge ? (margin / charge * 100).toFixed(1) + '%' : '—';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {[
              { label: 'Charged',       value: fmtMoney(charge),  sub: null,                      neg: false },
              { label: 'Paid',          value: fmtMoney(pay),     sub: null,                      neg: false },
              { label: 'Gross Margin',  value: fmtMoney(margin),  sub: null,                      neg: negM  },
              { label: 'Margin %',      value: marginPct,          sub: `${hours.toFixed(1)}h payable`, neg: negM },
            ].map(({ label, value, sub, neg }, i, arr) => (
              <div key={label} style={{ flex: '1 1 140px', padding: '1.25rem 1.25rem 1rem', borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{label}</div>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: neg ? RED : NAVY, fontFamily: "'Courier New', Courier, monospace" }}>{value}</div>
                {sub && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>{sub}</div>}
              </div>
            ))}
          </div>
        );
      })()}
    </Panel>
  );
}

function SiteMarginPanel({ data, loading, error }) {
  return (
    <Panel title="Margin by Site">
      {loading && <PanelLoading />}
      {error   && <PanelError message={error} />}
      {!loading && !error && data && (() => {
        const sites = [...(data.by_site || [])].sort((a, b) => (b.margin_amount || 0) - (a.margin_amount || 0));
        if (!sites.length) return (
          <div style={{ padding: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>No data for this period.</div>
        );
        return (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Site</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">Charged</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Margin</Th>
                  <Th align="right">Margin %</Th>
                </tr>
              </thead>
              <tbody>
                {sites.map(s => {
                  const neg = (s.margin_amount || 0) < 0;
                  return (
                    <tr key={s.site_id}>
                      <Td>{s.site_name || '—'}</Td>
                      <Td align="right" mono>{s.payable_hours != null ? Number(s.payable_hours).toFixed(2) : '—'}</Td>
                      <Td align="right" mono>{fmtMoney(s.charge_amount)}</Td>
                      <Td align="right" mono>{fmtMoney(s.pay_amount)}</Td>
                      <Td align="right" mono negative={neg}>{fmtMoney(s.margin_amount)}</Td>
                      <Td align="right" mono negative={neg}>{fmtPct(s.margin_amount, s.charge_amount)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </Panel>
  );
}

// ── Panel 3: Officer hours (aggregated client-side from pay-lines) ─────────────

function OfficerHoursPanel({ data, loading, error }) {
  return (
    <Panel title="Officer Hours">
      {loading && <PanelLoading />}
      {error   && <PanelError message={error} />}
      {!loading && !error && data && (() => {
        const byOfficer = {};
        for (const line of data) {
          const key  = line.officer_id || 'unknown';
          const name = line.officer ? `${line.officer.first_name} ${line.officer.last_name}` : 'Unknown';
          if (!byOfficer[key]) byOfficer[key] = { name, shifts: 0, hours: 0, pay: 0 };
          byOfficer[key].shifts++;
          byOfficer[key].hours += Number(line.payable_hours) || 0;
          byOfficer[key].pay   += Number(line.pay_amount)   || 0;
        }
        const rows = Object.values(byOfficer).sort((a, b) => b.pay - a.pay);
        if (!rows.length) return (
          <div style={{ padding: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>No pay line data for this period.</div>
        );
        return (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Officer</Th>
                  <Th align="right">Shifts</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">Eff. Rate</Th>
                  <Th align="right">Pay</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const effRate = r.hours > 0 ? r.pay / r.hours : null;
                  return (
                    <tr key={i}>
                      <Td>{r.name}</Td>
                      <Td align="right" mono>{r.shifts}</Td>
                      <Td align="right" mono>{r.hours.toFixed(2)}</Td>
                      <Td align="right" mono muted={!effRate}>{effRate ? `£${effRate.toFixed(2)}/h` : '—'}</Td>
                      <Td align="right" mono>{fmtMoney(r.pay)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </Panel>
  );
}

// ── Panel 4: Needs attention (variances) ──────────────────────────────────────

function VariancesPanel({ data, loading, error }) {
  const count = data?.length ?? 0;
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: count > 0 ? `2px solid ${RED}` : '1px solid #e5e7eb' }}>
      <div style={{ background: NAVY, color: '#fff', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '3px', height: '1rem', background: RED, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Needs Attention</span>
        {!loading && count > 0 && (
          <span style={{ background: RED, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>{count}</span>
        )}
      </div>
      <div style={{ background: '#fff' }}>
        {loading && <PanelLoading />}
        {error   && <PanelError message={error} />}
        {!loading && !error && data && (() => {
          if (!count) {
            return (
              <div style={{ padding: '1.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9l4 4 6-6" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#15803d', fontSize: '0.9375rem' }}>No exceptions</div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>All shifts are within tolerance for this period.</div>
                </div>
              </div>
            );
          }
          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Site</Th>
                    <Th>Officer</Th>
                    <Th>Date</Th>
                    <Th align="right">Rostered</Th>
                    <Th align="right">Actual</Th>
                    <Th align="right">Variance</Th>
                    <Th>Issue</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(r => {
                    const isMissing = r.checked_in_at === null || r.checked_out_at === null;
                    const varH = r.variance_hours != null ? Number(r.variance_hours) : null;
                    const negVar = varH !== null && varH < 0;
                    return (
                      <tr key={r.id}>
                        <Td>{r.site?.name || '—'}</Td>
                        <Td>{r.officer ? `${r.officer.first_name} ${r.officer.last_name}` : '—'}</Td>
                        <Td>{new Date(r.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Td>
                        <Td align="right" mono>{r.rostered_hours != null ? Number(r.rostered_hours).toFixed(2) : '—'}</Td>
                        <Td align="right" mono muted={isMissing}>
                          {isMissing ? 'missing' : r.actual_hours != null ? Number(r.actual_hours).toFixed(2) : '—'}
                        </Td>
                        <Td align="right" mono negative={negVar}>
                          {varH !== null ? (varH >= 0 ? '+' : '') + varH.toFixed(2) : '—'}
                        </Td>
                        <Td>
                          {isMissing
                            ? <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '0.1875rem 0.5rem', borderRadius: '4px' }}>Missing clockings</span>
                            : <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '0.1875rem 0.5rem', borderRadius: '4px' }}>Variance &gt;15 min</span>
                          }
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function FinanceScreen({ user }) {
  if (!['SUPER_ADMIN', 'FD'].includes(user?.role)) return null;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const { from, to } = monthRange(year, month);

  const [summary,          setSummary]          = useState(null);
  const [summaryLoading,   setSummaryLoading]   = useState(true);
  const [summaryError,     setSummaryError]     = useState(null);

  const [payLines,         setPayLines]         = useState(null);
  const [payLinesLoading,  setPayLinesLoading]  = useState(true);
  const [payLinesError,    setPayLinesError]    = useState(null);

  const [variances,        setVariances]        = useState(null);
  const [variancesLoading, setVariancesLoading] = useState(true);
  const [variancesError,   setVariancesError]   = useState(null);

  useEffect(() => {
    setSummary(null);   setSummaryLoading(true);   setSummaryError(null);
    api.finance.summary({ from, to })
      .then(r => setSummary(r.data))
      .catch(e => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));

    setPayLines(null);  setPayLinesLoading(true);  setPayLinesError(null);
    api.finance.payLines({ from, to })
      .then(r => setPayLines(r.data))
      .catch(e => setPayLinesError(e.message))
      .finally(() => setPayLinesLoading(false));

    setVariances(null); setVariancesLoading(true); setVariancesError(null);
    api.finance.variances({ from, to })
      .then(r => setVariances(r.data))
      .catch(e => setVariancesError(e.message))
      .finally(() => setVariancesLoading(false));
  }, [from, to]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Finance</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <button onClick={prevMonth} className="btn btn-ghost btn-sm" style={{ fontSize: '1.125rem', padding: '0.125rem 0.625rem', lineHeight: 1 }}>‹</button>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', minWidth: '140px', textAlign: 'center' }}>{monthLabel(year, month)}</span>
          <button onClick={nextMonth} className="btn btn-ghost btn-sm" disabled={isCurrentMonth} style={{ fontSize: '1.125rem', padding: '0.125rem 0.625rem', lineHeight: 1, opacity: isCurrentMonth ? 0.3 : 1 }}>›</button>
        </div>
      </div>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SummaryPanel   data={summary}   loading={summaryLoading}   error={summaryError} />
        <SiteMarginPanel data={summary}  loading={summaryLoading}   error={summaryError} />
        <OfficerHoursPanel data={payLines} loading={payLinesLoading} error={payLinesError} />
        <VariancesPanel data={variances} loading={variancesLoading} error={variancesError} />
      </div>
    </div>
  );
}
