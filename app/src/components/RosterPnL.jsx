import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import RosterCalendar from './RosterCalendar';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function ShiftRoster({ user }) {
  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Shift Roster</div>
      </div>
      <div className="page-content">
        <RosterCalendar user={user} />
      </div>
    </div>
  );
}

// ── P&L DASHBOARD (FD / COMPANY / SUPER_ADMIN only) ──────────────────────────
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); r.setHours(0,0,0,0); return r; }
function calcHours(s) { return s.start_time && s.end_time ? Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 3600000) : 0; }
const fmt = n => `£${n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function ProfitLoss({ user }) {
  const isFD = ['FD','COMPANY','SUPER_ADMIN'].includes(user?.role);
  const [sites, setSites] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [savingSite, setSavingSite] = useState(null);

  function getRange() {
    const d = new Date(anchor); d.setHours(0,0,0,0);
    if (period === 'week') { const f = startOfWeek(d); return { from: f, to: addDays(f, 7) }; }
    return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  }
  const { from, to } = getRange();

  function load() {
    setLoading(true);
    Promise.all([
      api.sites.list(),
      api.shifts.list({ from: from.toISOString(), to: to.toISOString(), limit: 1000 }),
      api.rates.list(),
    ]).then(([sr, shr, rr]) => { setSites(sr.data || []); setShifts(shr.data || []); setRates(rr.data || []); })
      .catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [anchor, period]);

  // Look up pay rate: shift.pay_rate first, then officer_rates for that site, then default officer rate
  function getPayRate(s) {
    if (s.pay_rate) return parseFloat(s.pay_rate);
    const siteRate = rates.find(r => r.officer_id === s.officer_id && r.site_id === s.site_id);
    if (siteRate) return parseFloat(siteRate.hourly_rate || 0);
    const defaultRate = rates.find(r => r.officer_id === s.officer_id && !r.site_id);
    if (defaultRate) return parseFloat(defaultRate.hourly_rate || 0);
    return 0;
  }

  async function saveSiteRate(siteId, field, value) {
    setSavingSite(siteId);
    try {
      await api.sites.update(siteId, { [field]: value ? parseFloat(value) : null });
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, [field]: value ? parseFloat(value) : null } : s));
    } catch (e) { alert(e.message); }
    finally { setSavingSite(null); }
  }

  function nav(dir) {
    const d = new Date(anchor);
    if (period === 'week') d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  }

  const rangeLabel = () => {
    const fmt2 = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    const fmtF = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    return period === 'week' ? `${fmt2(from)} – ${fmtF(addDays(to, -1))}` : anchor.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
  };

  const periodDays = Math.round((to - from) / 86400000);
  const periodWeeks = periodDays / 7;

  // Group shifts by site, then by officer
  const siteMap = {};
  sites.forEach(s => { siteMap[s.id] = s; });
  const bySite = {};
  shifts.forEach(s => {
    const sid = s.site_id;
    if (!bySite[sid]) bySite[sid] = [];
    bySite[sid].push(s);
  });

  let grandHours = 0, grandPay = 0, grandCharge = 0, grandContracted = 0;

  const siteRows = sites.map(site => {
    const ss = bySite[site.id] || [];
    const chargeRate = parseFloat(site.charge_rate) || 0;
    const contractedWeekly = parseFloat(site.contracted_hours_weekly) || 0;
    const contractedPeriod = contractedWeekly * periodWeeks;
    const byOfficer = {};
    ss.forEach(s => {
      const name = s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned';
      if (!byOfficer[name]) byOfficer[name] = { hours: 0, pay: 0, shifts: 0 };
      const h = calcHours(s);
      byOfficer[name].hours += h;
      byOfficer[name].pay += h * getPayRate(s);
      byOfficer[name].shifts += 1;
    });
    const totalHours = Object.values(byOfficer).reduce((t, o) => t + o.hours, 0);
    const totalPay = Object.values(byOfficer).reduce((t, o) => t + o.pay, 0);
    const totalCharge = totalHours * chargeRate;
    const margin = totalCharge - totalPay;
    grandHours += totalHours; grandPay += totalPay; grandCharge += totalCharge; grandContracted += contractedPeriod;
    return { site, byOfficer, totalHours, totalPay, totalCharge, margin, chargeRate, contractedWeekly, contractedPeriod, shiftCount: ss.length };
  }).filter(r => r.shiftCount > 0 || r.contractedWeekly > 0);

  const grandMargin = grandCharge - grandPay;
  const marginPct = grandCharge > 0 ? (grandMargin / grandCharge * 100).toFixed(1) : '0.0';

  if (!isFD) return <div className="page-content"><div className="alert alert-danger">Access restricted to Field Directors</div></div>;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">P&L Dashboard</div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>←</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(new Date())}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => nav(1)}>→</button>
          <span style={{fontSize:'0.875rem',fontWeight:600,marginLeft:'0.5rem'}}>{rangeLabel()}</span>
          <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px',marginLeft:'0.5rem'}}>
            {[['week','Week'],['month','Month']].map(([k,l]) => (
              <button key={k} onClick={() => setPeriod(k)}
                style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                  background: period===k ? 'var(--blue)' : 'transparent', color: period===k ? '#fff' : 'var(--text-2)'}}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="page-content">
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <>
            {/* Grand totals */}
            <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
              <div className="stat-card"><div className="stat-value">{grandHours.toFixed(1)}h</div><div className="stat-label">Total Hours</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#f59e0b'}}>{fmt(grandPay)}</div><div className="stat-label">Total Pay Cost</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#10b981'}}>{fmt(grandCharge)}</div><div className="stat-label">Charge Revenue</div></div>
              <div className="stat-card"><div className="stat-value" style={{color: grandMargin >= 0 ? '#10b981' : '#ef4444'}}>{fmt(grandMargin)}</div><div className="stat-label">Gross Margin ({marginPct}%)</div></div>
            </div>

            {/* Contracted hours check */}
            {grandContracted > 0 && (
              <div className="card" style={{marginBottom:'1.25rem',padding:'1rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Contracted vs Actual Hours</div>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'0.5rem'}}>
                  <div style={{flex:1,background:'var(--surface-2)',borderRadius:'4px',height:'10px',overflow:'hidden'}}>
                    <div style={{width:`${Math.min(100, (grandHours / grandContracted) * 100)}%`,height:'100%',background: grandHours >= grandContracted ? '#10b981' : '#f59e0b',borderRadius:'4px'}} />
                  </div>
                  <span style={{fontSize:'0.875rem',fontWeight:700,whiteSpace:'nowrap'}}>{grandHours.toFixed(1)} / {grandContracted.toFixed(1)} hrs</span>
                </div>
                <div style={{fontSize:'0.8125rem',fontWeight:600,color: grandHours >= grandContracted ? '#10b981' : '#ef4444'}}>
                  {grandHours >= grandContracted
                    ? `${(grandHours - grandContracted).toFixed(1)} hrs over contract (+${((grandHours / grandContracted - 1) * 100).toFixed(1)}%)`
                    : `${(grandContracted - grandHours).toFixed(1)} hrs under contract (${((1 - grandHours / grandContracted) * 100).toFixed(1)}% short)`}
                </div>
              </div>
            )}

            {/* Per site breakdown */}
            {siteRows.map(({ site, byOfficer, totalHours, totalPay, totalCharge, margin, chargeRate, contractedWeekly, contractedPeriod }) => (
              <div key={site.id} className="card" style={{marginBottom:'1rem',padding:'1rem'}}>
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                    <div style={{fontSize:'1rem',fontWeight:700}}>{site.name}</div>
                    {contractedWeekly > 0 && (
                      <div style={{fontSize:'0.8125rem',fontWeight:600,color: totalHours >= contractedPeriod ? '#10b981' : '#ef4444'}}>
                        {totalHours.toFixed(1)} / {contractedPeriod.toFixed(1)} hrs
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:'0.75rem',alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.8125rem'}}>
                      <span style={{color:'var(--text-3)'}}>Charge £/hr:</span>
                      <input type="number" step="0.01" min="0" value={site.charge_rate || ''} style={{width:'80px',padding:'0.25rem 0.5rem',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'0.8125rem',color:'var(--text)'}}
                        onChange={e => setSites(prev => prev.map(s => s.id === site.id ? {...s, charge_rate: e.target.value} : s))}
                        onBlur={e => saveSiteRate(site.id, 'charge_rate', e.target.value)} />
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.8125rem'}}>
                      <span style={{color:'var(--text-3)'}}>Contract hrs/wk:</span>
                      <input type="number" step="0.5" min="0" value={site.contracted_hours_weekly || ''} style={{width:'70px',padding:'0.25rem 0.5rem',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'0.8125rem',color:'var(--text)'}}
                        onChange={e => setSites(prev => prev.map(s => s.id === site.id ? {...s, contracted_hours_weekly: e.target.value} : s))}
                        onBlur={e => saveSiteRate(site.id, 'contracted_hours_weekly', e.target.value)} />
                    </div>
                    {savingSite === site.id && <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Saving...</span>}
                  </div>
                </div>

                <table className="table" style={{marginBottom:'0.75rem'}}>
                  <thead><tr><th>Officer</th><th style={{textAlign:'right'}}>Shifts</th><th style={{textAlign:'right'}}>Hours</th><th style={{textAlign:'right'}}>Avg Rate</th><th style={{textAlign:'right'}}>Total Pay</th></tr></thead>
                  <tbody>
                    {Object.values(byOfficer).sort((a,b) => b.hours - a.hours).map(o => (
                      <tr key={o.name}>
                        <td style={{fontWeight:500}}>{o.name}</td>
                        <td style={{textAlign:'right',color:'var(--text-2)'}}>{o.shifts}</td>
                        <td style={{textAlign:'right'}}>{o.hours.toFixed(1)}</td>
                        <td style={{textAlign:'right',color:'var(--text-2)'}}>{o.hours > 0 ? `£${(o.pay / o.hours).toFixed(2)}` : '—'}</td>
                        <td style={{textAlign:'right',color:'#f59e0b',fontWeight:600}}>{fmt(o.pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                      <td colSpan={2}>Site Total</td>
                      <td style={{textAlign:'right'}}>{totalHours.toFixed(1)}</td>
                      <td></td>
                      <td style={{textAlign:'right',color:'#f59e0b'}}>{fmt(totalPay)}</td>
                    </tr>
                  </tfoot>
                </table>

                {chargeRate > 0 && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.5rem',padding:'0.75rem',background:'var(--surface-2)',borderRadius:'8px',fontSize:'0.8125rem'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Revenue</div>
                      <div style={{fontWeight:700,color:'#10b981'}}>{fmt(totalCharge)}</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Cost</div>
                      <div style={{fontWeight:700,color:'#f59e0b'}}>{fmt(totalPay)}</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Margin</div>
                      <div style={{fontWeight:700,color: margin >= 0 ? '#10b981' : '#ef4444'}}>{fmt(margin)}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {siteRows.length === 0 && <div className="empty-state"><p>No shifts for this period</p></div>}

            {shifts.length > 0 && grandCharge === 0 && (
              <div className="alert alert-warning" style={{marginTop:'1rem'}}>
                No charge rates set on sites. Set charge rates in Site Detail to see revenue and margin figures.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ── DOCUMENTS ─────────────────────────────────────────────────────────────────

export { ShiftRoster };
export { ProfitLoss };
