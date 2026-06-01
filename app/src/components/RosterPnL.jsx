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
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');

  useEffect(() => {
    api.sites.list().then(r => setSites(r.data || [])).catch(() => {});
  }, []);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Shift Roster</div>
        <select className="input" style={{width:'220px'}} value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
          <option value="">Select a site...</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="page-content">
        {selectedSite ? (
          <RosterCalendar siteId={selectedSite} user={user} />
        ) : (
          <div style={{textAlign:'center',padding:'3rem',color:'var(--text-3)',fontSize:'0.875rem'}}>Select a site above to view its roster</div>
        )}
      </div>
    </div>
  );
}

// ── P&L DASHBOARD (FD / COMPANY / SUPER_ADMIN only) ──────────────────────────
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); r.setHours(0,0,0,0); return r; }
function calcScheduledHours(s) { return s.start_time && s.end_time ? Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 3600000) : 0; }
const fmt = n => `£${n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// UK bank holidays — midnight-based (BH runs 00:00–23:59 on these dates)
const UK_BANK_HOLIDAYS = new Set([
  // 2025
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  // 2026
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  // 2027
  '2027-01-01','2027-03-26','2027-03-29','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28',
]);

// Calculate how many hours of a shift fall on a UK bank holiday.
// Splits at midnight UK time. A shift 18:00–06:00 crossing into a BH gets 6h BH.
function ukDateStr(date) {
  // Get YYYY-MM-DD in Europe/London timezone
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}
function ukMidnight(dateStr) {
  // Return a Date representing 00:00 UK time for a given YYYY-MM-DD
  // Try GMT first (+00:00), check if the UK date matches; if not, it's BST (-1hr)
  const gmt = new Date(dateStr + 'T00:00:00+00:00');
  if (ukDateStr(gmt) === dateStr) return gmt;
  return new Date(dateStr + 'T00:00:00+01:00');
}
function calcBhHours(s) {
  if (!s.start_time || !s.end_time) return 0;
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  if (end <= start) return 0;
  let bhMs = 0;
  // Get the UK calendar dates this shift spans
  const startDate = ukDateStr(start);
  const endDate = ukDateStr(new Date(end.getTime() - 1)); // -1ms so exact midnight doesn't spill
  // Walk each UK calendar day
  let d = startDate;
  while (d <= endDate) {
    if (UK_BANK_HOLIDAYS.has(d)) {
      const dayStart = ukMidnight(d);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const overlapStart = start > dayStart ? start : dayStart;
      const overlapEnd = end < dayEnd ? end : dayEnd;
      if (overlapEnd > overlapStart) bhMs += overlapEnd - overlapStart;
    }
    // Next day
    const next = new Date(ukMidnight(d).getTime() + 86400000);
    d = ukDateStr(next);
  }
  return bhMs / 3600000;
}

function ProfitLoss({ user }) {
  const isFD = ['FD','COMPANY','SUPER_ADMIN'].includes(user?.role);
  const [sites, setSites] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [rates, setRates] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [savingSite, setSavingSite] = useState(null);
  const [addProductSite, setAddProductSite] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name:'', cost:'', charge:'', frequency:'monthly' });
  const [expandedSite, setExpandedSite] = useState(null);
  const [siteSearch, setSiteSearch] = useState('');

  function getRange() {
    const d = new Date(anchor); d.setHours(0,0,0,0);
    if (period === 'week') { const f = startOfWeek(d); return { from: f, to: addDays(f, 7) }; }
    return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  }
  const { from, to } = getRange();

  useEffect(() => {
    setLoading(true);
    const { from: f, to: t } = getRange();
    Promise.all([
      api.sites.list(),
      api.shifts.list({ from: f.toISOString(), to: t.toISOString(), limit: 1000 }),
      api.rates.list(),
      api.products.list(),
    ]).then(([sr, shr, rr, pr]) => {
      setSites(sr.data || []);
      setShifts(shr.data || []);
      setRates(rr.data || []);
      setProducts(pr.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [anchor, period]);

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

  // Product helpers
  function productMonthly(p, periodDays) {
    const cost = parseFloat(p.cost) || 0;
    const charge = parseFloat(p.charge) || 0;
    const mult = p.frequency === 'daily' ? periodDays : p.frequency === 'weekly' ? periodDays / 7 : p.frequency === 'one-off' ? 1 : 1; // monthly = 1
    return { cost: cost * mult, charge: charge * mult };
  }

  async function saveProduct() {
    if (!productForm.name.trim()) return;
    try {
      const payload = { name: productForm.name, cost: parseFloat(productForm.cost) || 0, charge: parseFloat(productForm.charge) || 0, frequency: productForm.frequency };
      if (editProduct) {
        await api.products.update(editProduct.id, payload);
      } else {
        await api.products.create({ ...payload, site_id: addProductSite });
      }
      const res = await api.products.list();
      setProducts(res.data || []);
      setAddProductSite(null); setEditProduct(null);
      setProductForm({ name:'', cost:'', charge:'', frequency:'monthly' });
    } catch (e) { alert(e.message); }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
      await api.products.delete(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert(e.message); }
  }

  // All calculations use scheduled hours only.
  // Bank holiday premium is a separate £ cost — not extra hours.
  // Overnight shifts are split at midnight: only hours falling on a BH date get premium.
  const bySite = {};
  shifts.forEach(s => { if (!bySite[s.site_id]) bySite[s.site_id] = []; bySite[s.site_id].push(s); });

  let grandHrs = 0, grandBasePay = 0, grandBhPremiumPay = 0, grandBaseCharge = 0, grandBhPremiumCharge = 0, grandProductCost = 0, grandProductCharge = 0;

  const siteRows = sites.map(site => {
    const ss = bySite[site.id] || [];
    const siteChargeRate = parseFloat(site.charge_rate) || 0;

    const byOfficer = {};
    ss.forEach(s => {
      const name = s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned';
      if (!byOfficer[name]) byOfficer[name] = { hours: 0, basePay: 0, bhPremiumPay: 0, baseCharge: 0, bhPremiumCharge: 0 };
      const rate = getPayRate(s);
      const cr = parseFloat(s.charge_rate) || siteChargeRate;
      const h = calcScheduledHours(s);
      const bhH = calcBhHours(s);
      byOfficer[name].hours += h;
      byOfficer[name].basePay += h * rate;
      byOfficer[name].baseCharge += h * cr;
      if (bhH > 0) {
        byOfficer[name].bhPremiumPay += bhH * rate;
        byOfficer[name].bhPremiumCharge += bhH * cr;
      }
    });

    const hours = Object.values(byOfficer).reduce((t, o) => t + o.hours, 0);
    const basePay = Object.values(byOfficer).reduce((t, o) => t + o.basePay, 0);
    const bhPremiumPay = Object.values(byOfficer).reduce((t, o) => t + o.bhPremiumPay, 0);
    const baseCharge = Object.values(byOfficer).reduce((t, o) => t + o.baseCharge, 0);
    const bhPremiumCharge = Object.values(byOfficer).reduce((t, o) => t + o.bhPremiumCharge, 0);

    const siteProducts = products.filter(p => p.site_id === site.id);
    let productCost = 0, productCharge = 0;
    siteProducts.forEach(p => { const m = productMonthly(p, periodDays); productCost += m.cost; productCharge += m.charge; });

    grandHrs += hours;
    grandBasePay += basePay; grandBhPremiumPay += bhPremiumPay;
    grandBaseCharge += baseCharge; grandBhPremiumCharge += bhPremiumCharge;
    grandProductCost += productCost; grandProductCharge += productCharge;
    return { site, byOfficer, hours, basePay, bhPremiumPay, baseCharge, bhPremiumCharge, siteProducts, productCost, productCharge, shiftCount: ss.length };
  }).filter(r => r.shiftCount > 0 || products.some(p => p.site_id === r.site.id));

  const grandTotalPay = grandBasePay + grandBhPremiumPay;
  const grandTotalCharge = grandBaseCharge + grandBhPremiumCharge + grandProductCharge;
  const grandTotalCost = grandTotalPay + grandProductCost;
  const grandMargin = grandTotalCharge - grandTotalCost;
  const marginPct = grandTotalCharge > 0 ? (grandMargin / grandTotalCharge * 100).toFixed(1) : '0.0';

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
            {/* Grand Totals — always visible at top */}
            <div className="card" style={{padding:'1rem',borderLeft:'3px solid #10b981',background:'rgba(16,185,129,0.03)'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'1.25rem',fontSize:'0.9375rem'}}>
                <div>
                  <div style={{color:'var(--text-3)',fontSize:'0.6875rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.25rem'}}>Hours</div>
                  <div style={{fontWeight:700,fontSize:'1.25rem',color:'#3b82f6'}}>{grandHrs.toFixed(1)}h</div>
                </div>
                <div>
                  <div style={{color:'var(--text-3)',fontSize:'0.6875rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.25rem'}}>Total Pay</div>
                  <div style={{fontWeight:700,fontSize:'1.25rem',color:'#f59e0b'}}>{fmt(grandTotalPay)}</div>
                  {grandBhPremiumPay > 0 && <div style={{fontSize:'0.6875rem',color:'#dc2626',fontWeight:600,marginTop:'2px'}}>incl. {fmt(grandBhPremiumPay)} BH premium</div>}
                </div>
                <div>
                  <div style={{color:'var(--text-3)',fontSize:'0.6875rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.25rem'}}>Revenue</div>
                  <div style={{fontWeight:700,fontSize:'1.25rem',color:'#10b981'}}>{fmt(grandTotalCharge)}</div>
                  {grandBhPremiumCharge > 0 && <div style={{fontSize:'0.6875rem',color:'#dc2626',fontWeight:600,marginTop:'2px'}}>incl. {fmt(grandBhPremiumCharge)} BH surcharge</div>}
                </div>
                <div>
                  <div style={{color:'var(--text-3)',fontSize:'0.6875rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.25rem'}}>Gross Profit</div>
                  <div style={{fontWeight:700,fontSize:'1.25rem',color: grandMargin >= 0 ? '#10b981' : '#ef4444'}}>{fmt(grandMargin)} <span style={{fontSize:'0.8125rem',fontWeight:600}}>({marginPct}%)</span></div>
                </div>
              </div>
            </div>

            {/* Site search */}
            <div style={{marginTop:'1.25rem',marginBottom:'0.75rem'}}>
              <input value={siteSearch} onChange={e => setSiteSearch(e.target.value)} placeholder="Search sites..."
                style={{width:'100%',maxWidth:'300px',padding:'0.5rem 0.75rem',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'0.8125rem',color:'var(--text)',outline:'none',boxSizing:'border-box'}} />
            </div>

            {/* Site summary table */}
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <table className="table" style={{margin:0}}>
                <thead>
                  <tr>
                    <th style={{padding:'0.75rem 1rem'}}>Site</th>
                    <th style={{textAlign:'right',padding:'0.75rem 0.5rem'}}>Hours</th>
                    <th style={{textAlign:'right',padding:'0.75rem 0.5rem'}}>Pay</th>
                    <th style={{textAlign:'right',padding:'0.75rem 0.5rem'}}>Revenue</th>
                    <th style={{textAlign:'right',padding:'0.75rem 0.5rem'}}>Profit</th>
                    <th style={{textAlign:'right',padding:'0.75rem 1rem'}}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {siteRows.filter(r => !siteSearch || r.site.name.toLowerCase().includes(siteSearch.toLowerCase())).map(({ site, byOfficer, hours, basePay, bhPremiumPay, baseCharge, bhPremiumCharge, siteProducts, productCost, productCharge }) => {
                    const totalPay = basePay + bhPremiumPay;
                    const totalCharge = baseCharge + bhPremiumCharge + productCharge;
                    const totalCost = totalPay + productCost;
                    const profit = totalCharge - totalCost;
                    const margin = totalCharge > 0 ? (profit / totalCharge * 100).toFixed(1) : '0.0';
                    const isExpanded = expandedSite === site.id;
                    return (
                      <React.Fragment key={site.id}>
                        <tr onClick={() => setExpandedSite(isExpanded ? null : site.id)} style={{cursor:'pointer',background: isExpanded ? 'rgba(139,92,246,0.04)' : 'transparent'}}>
                          <td style={{padding:'0.625rem 1rem',fontWeight:600}}>
                            <span style={{color: isExpanded ? '#8b5cf6' : 'var(--text)',marginRight:'0.375rem'}}>{isExpanded ? '▾' : '▸'}</span>
                            {site.name}
                            {bhPremiumPay > 0 && <span style={{fontSize:'0.6875rem',color:'#dc2626',fontWeight:700,marginLeft:'0.5rem'}}>BH</span>}
                          </td>
                          <td style={{textAlign:'right',padding:'0.625rem 0.5rem'}}>{hours.toFixed(1)}</td>
                          <td style={{textAlign:'right',padding:'0.625rem 0.5rem',color:'#f59e0b'}}>{fmt(totalPay)}{bhPremiumPay > 0 && <div style={{fontSize:'0.625rem',color:'#dc2626',fontWeight:600}}>+{fmt(bhPremiumPay)} BH</div>}</td>
                          <td style={{textAlign:'right',padding:'0.625rem 0.5rem',color:'#10b981'}}>{fmt(totalCharge)}{bhPremiumCharge > 0 && <div style={{fontSize:'0.625rem',color:'#dc2626',fontWeight:600}}>+{fmt(bhPremiumCharge)} BH</div>}</td>
                          <td style={{textAlign:'right',padding:'0.625rem 0.5rem',fontWeight:700,color: profit >= 0 ? '#10b981' : '#ef4444'}}>{fmt(profit)}</td>
                          <td style={{textAlign:'right',padding:'0.625rem 1rem',fontWeight:600,color: profit >= 0 ? '#10b981' : '#ef4444'}}>{margin}%</td>
                        </tr>
                        {isExpanded && (
                          <tr><td colSpan={6} style={{padding:0,background:'rgba(139,92,246,0.02)'}}>
                            <div style={{padding:'1rem 1.5rem',borderTop:'1px solid var(--border)'}}>
                              {/* Officer breakdown */}
                              <table className="table" style={{marginBottom:'0.75rem',fontSize:'0.8125rem'}}>
                                <thead><tr><th>Officer</th><th style={{textAlign:'right'}}>Hours</th><th style={{textAlign:'right'}}>Base Pay</th><th style={{textAlign:'right'}}>BH Premium</th><th style={{textAlign:'right'}}>Total Pay</th><th style={{textAlign:'right'}}>Profit</th></tr></thead>
                                <tbody>
                                  {Object.entries(byOfficer).sort((a,b) => b[1].hours - a[1].hours).map(([name, o]) => {
                                    const totalOfficerPay = o.basePay + o.bhPremiumPay;
                                    const totalOfficerCharge = o.baseCharge + o.bhPremiumCharge;
                                    const gp = totalOfficerCharge - totalOfficerPay;
                                    return (
                                      <tr key={name}>
                                        <td style={{fontWeight:500}}>{name}</td>
                                        <td style={{textAlign:'right'}}>{o.hours.toFixed(1)}</td>
                                        <td style={{textAlign:'right',color:'#f59e0b'}}>{fmt(o.basePay)}</td>
                                        <td style={{textAlign:'right',color: o.bhPremiumPay > 0 ? '#dc2626' : 'var(--text-3)',fontWeight: o.bhPremiumPay > 0 ? 600 : 400}}>{o.bhPremiumPay > 0 ? fmt(o.bhPremiumPay) : '—'}</td>
                                        <td style={{textAlign:'right',fontWeight:600}}>{fmt(totalOfficerPay)}</td>
                                        <td style={{textAlign:'right',fontWeight:700,color: gp >= 0 ? '#10b981' : '#ef4444'}}>{fmt(gp)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {/* Products */}
                              {siteProducts.length > 0 && (
                                <div style={{marginBottom:'0.5rem'}}>
                                  <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#a78bfa',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.375rem'}}>Products & Services</div>
                                  {siteProducts.map(p => { const m = productMonthly(p, periodDays); return (
                                    <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:'0.8125rem',padding:'0.25rem 0'}}>
                                      <span>{p.name} <span style={{color:'var(--text-3)',fontSize:'0.75rem'}}>({p.frequency})</span></span>
                                      <span style={{fontWeight:600,color: m.charge - m.cost >= 0 ? '#10b981' : '#ef4444'}}>{fmt(m.charge - m.cost)}</span>
                                    </div>
                                  ); })}
                                </div>
                              )}
                              <button type="button" style={{padding:'0.375rem 0.625rem',fontSize:'0.75rem',background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.3)',borderRadius:'4px',color:'#a78bfa',cursor:'pointer',fontWeight:600}} onClick={() => { setAddProductSite(site.id); setEditProduct(null); setProductForm({ name:'', cost:'', charge:'', frequency:'monthly' }); }}>+ Add Product</button>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {siteRows.filter(r => !siteSearch || r.site.name.toLowerCase().includes(siteSearch.toLowerCase())).length === 0 && (
                <div style={{padding:'1.5rem',textAlign:'center',color:'var(--text-3)',fontSize:'0.875rem'}}>No sites match your search.</div>
              )}
            </div>

            {/* Add/Edit Product Modal */}
            {addProductSite && (
              <div className="modal-overlay" onClick={() => { setAddProductSite(null); setEditProduct(null); }}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'440px'}}>
                  <div className="modal-header">
                    <div className="modal-title">{editProduct ? 'Edit Product' : 'Add Product'}</div>
                    <button className="modal-close" onClick={() => { setAddProductSite(null); setEditProduct(null); }}>×</button>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                    <div className="field"><label className="label">Product Name</label><input className="input" value={productForm.name} onChange={e => setProductForm(p=>({...p, name:e.target.value}))} placeholder="e.g. CCTV Tower Rental" /></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                      <div className="field"><label className="label">Your Cost (£)</label><input type="number" step="0.01" min="0" className="input" value={productForm.cost} onChange={e => setProductForm(p=>({...p, cost:e.target.value}))} placeholder="0.00" /></div>
                      <div className="field"><label className="label">Client Charge (£)</label><input type="number" step="0.01" min="0" className="input" value={productForm.charge} onChange={e => setProductForm(p=>({...p, charge:e.target.value}))} placeholder="0.00" /></div>
                    </div>
                    <div className="field"><label className="label">Frequency</label><select className="input" value={productForm.frequency} onChange={e => setProductForm(p=>({...p, frequency:e.target.value}))}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="one-off">One-off</option>
                    </select></div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => { setAddProductSite(null); setEditProduct(null); }}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveProduct} disabled={!productForm.name.trim()}>{editProduct ? 'Update' : 'Add Product'}</button>
                  </div>
                </div>
              </div>
            )}

            {siteRows.length === 0 && <div className="empty-state"><p>No shifts for this period</p></div>}

            {shifts.length > 0 && grandTotalCharge === 0 && (
              <div className="alert alert-warning" style={{marginTop:'1rem'}}>
                No charge rates set. Enter charge rates above to see revenue and margin.
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
