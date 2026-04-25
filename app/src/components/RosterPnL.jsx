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
function calcHours(s) { return s.start_time && s.end_time ? Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 3600000) : 0; }
const fmt = n => `£${n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

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
      if (editProduct) {
        await api.products.update(editProduct.id, productForm);
      } else {
        await api.products.create({ ...productForm, site_id: addProductSite });
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

  // ALL shifts = the roster (total planned). COMPLETED+ACTIVE = what's been worked so far.
  const bySite = {};
  shifts.forEach(s => { if (!bySite[s.site_id]) bySite[s.site_id] = []; bySite[s.site_id].push(s); });

  let grandRosterHrs = 0, grandRosterPay = 0, grandActualHrs = 0, grandActualPay = 0, grandCharge = 0, grandProductCost = 0, grandProductCharge = 0;

  const siteRows = sites.map(site => {
    const ss = bySite[site.id] || [];
    const chargeRate = parseFloat(site.charge_rate) || 0;

    // Per officer breakdown from ALL shifts (the full roster)
    const byOfficer = {};
    ss.forEach(s => {
      const name = s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned';
      if (!byOfficer[name]) byOfficer[name] = { rosterHrs: 0, rosterPay: 0, actualHrs: 0, actualPay: 0 };
      const h = calcHours(s);
      const rate = getPayRate(s);
      // Every shift counts towards roster totals
      byOfficer[name].rosterHrs += h;
      byOfficer[name].rosterPay += h * rate;
      // Only COMPLETED/ACTIVE count as actually worked
      if (s.status === 'COMPLETED' || s.status === 'ACTIVE') {
        byOfficer[name].actualHrs += h;
        byOfficer[name].actualPay += h * rate;
      }
    });

    const rosterHrs = Object.values(byOfficer).reduce((t, o) => t + o.rosterHrs, 0);
    const rosterPay = Object.values(byOfficer).reduce((t, o) => t + o.rosterPay, 0);
    const actualHrs = Object.values(byOfficer).reduce((t, o) => t + o.actualHrs, 0);
    const actualPay = Object.values(byOfficer).reduce((t, o) => t + o.actualPay, 0);
    const chargeRevenue = rosterHrs * chargeRate;
    const margin = chargeRevenue - rosterPay;

    const siteProducts = products.filter(p => p.site_id === site.id);
    let productCost = 0, productCharge = 0;
    siteProducts.forEach(p => { const m = productMonthly(p, periodDays); productCost += m.cost; productCharge += m.charge; });

    grandRosterHrs += rosterHrs; grandRosterPay += rosterPay;
    grandActualHrs += actualHrs; grandActualPay += actualPay;
    grandCharge += chargeRevenue + productCharge;
    grandProductCost += productCost; grandProductCharge += productCharge;
    return { site, byOfficer, rosterHrs, rosterPay, actualHrs, actualPay, chargeRevenue, chargeRate, siteProducts, productCost, productCharge, shiftCount: ss.length };
  }).filter(r => r.shiftCount > 0 || products.some(p => p.site_id === r.site.id));

  const grandTotalCost = grandRosterPay + grandProductCost;
  const grandTotalRevenue = grandCharge;
  const grandMargin = grandTotalRevenue - grandTotalCost;
  const marginPct = grandTotalRevenue > 0 ? (grandMargin / grandTotalRevenue * 100).toFixed(1) : '0.0';

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
              <div className="stat-card"><div className="stat-value">{grandRosterHrs.toFixed(1)}h</div><div className="stat-label">Roster Hours</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#f59e0b'}}>{fmt(grandTotalCost)}</div><div className="stat-label">Total Cost</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#10b981'}}>{fmt(grandTotalRevenue)}</div><div className="stat-label">Total Revenue</div></div>
              <div className="stat-card"><div className="stat-value" style={{color: grandMargin >= 0 ? '#10b981' : '#ef4444'}}>{fmt(grandMargin)}</div><div className="stat-label">Margin ({marginPct}%)</div></div>
            </div>

            {/* Actual worked progress */}
            {grandRosterHrs > 0 && (
              <div className="card" style={{marginBottom:'1.25rem',padding:'1rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Hours Worked vs Roster</div>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'0.5rem'}}>
                  <div style={{flex:1,background:'var(--surface-2)',borderRadius:'4px',height:'10px',overflow:'hidden'}}>
                    <div style={{width:`${Math.min(100, (grandActualHrs / grandRosterHrs) * 100)}%`,height:'100%',background:'#3b82f6',borderRadius:'4px'}} />
                  </div>
                  <span style={{fontSize:'0.875rem',fontWeight:700,whiteSpace:'nowrap'}}>{grandActualHrs.toFixed(1)} / {grandRosterHrs.toFixed(1)} hrs</span>
                </div>
                <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>
                  {grandActualHrs.toFixed(1)} hrs completed · {(grandRosterHrs - grandActualHrs).toFixed(1)} hrs remaining
                </div>
              </div>
            )}

            {/* Per site breakdown */}
            {siteRows.map(({ site, byOfficer, rosterHrs, rosterPay, actualHrs, actualPay, chargeRevenue, margin, chargeRate }) => (
              <div key={site.id} className="card" style={{marginBottom:'1rem',padding:'1rem'}}>
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                    <div style={{fontSize:'1rem',fontWeight:700}}>{site.name}</div>
                    <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>
                      {rosterHrs.toFixed(1)}h roster · {actualHrs.toFixed(1)}h worked
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'0.75rem',alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.8125rem'}}>
                      <span style={{color:'var(--text-3)'}}>Charge £/hr:</span>
                      <input type="number" step="0.01" min="0" value={site.charge_rate || ''} style={{width:'80px',padding:'0.25rem 0.5rem',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'4px',fontSize:'0.8125rem',color:'var(--text)'}}
                        onChange={e => setSites(prev => prev.map(s => s.id === site.id ? {...s, charge_rate: e.target.value} : s))}
                        onBlur={e => saveSiteRate(site.id, 'charge_rate', e.target.value)} />
                    </div>
                    {savingSite === site.id && <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Saving...</span>}
                  </div>
                </div>

                <table className="table" style={{marginBottom:'0.75rem'}}>
                  <thead><tr><th>Officer</th><th style={{textAlign:'right'}}>Roster Hrs</th><th style={{textAlign:'right'}}>Worked</th><th style={{textAlign:'right'}}>Pay Rate</th><th style={{textAlign:'right'}}>Total Pay</th></tr></thead>
                  <tbody>
                    {Object.entries(byOfficer).sort((a,b) => b[1].rosterHrs - a[1].rosterHrs).map(([name, o]) => (
                      <tr key={name}>
                        <td style={{fontWeight:500}}>{name}</td>
                        <td style={{textAlign:'right'}}>{o.rosterHrs.toFixed(1)}</td>
                        <td style={{textAlign:'right',color:'var(--text-2)'}}>{o.actualHrs.toFixed(1)}</td>
                        <td style={{textAlign:'right',color:'var(--text-2)'}}>{o.rosterHrs > 0 ? `£${(o.rosterPay / o.rosterHrs).toFixed(2)}` : '—'}</td>
                        <td style={{textAlign:'right',color:'#f59e0b',fontWeight:600}}>{fmt(o.rosterPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                      <td>Site Total</td>
                      <td style={{textAlign:'right'}}>{rosterHrs.toFixed(1)}</td>
                      <td style={{textAlign:'right',color:'var(--text-2)'}}>{actualHrs.toFixed(1)}</td>
                      <td></td>
                      <td style={{textAlign:'right',color:'#f59e0b'}}>{fmt(rosterPay)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Products & Services */}
                <div style={{marginBottom:'0.75rem'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                    <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Products & Services</div>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:'0.75rem'}} onClick={() => { setAddProductSite(site.id); setEditProduct(null); setProductForm({ name:'', cost:'', charge:'', frequency:'monthly' }); }}>+ Add</button>
                  </div>
                  {siteProducts.length > 0 ? (
                    <table className="table" style={{marginBottom:'0.5rem'}}>
                      <thead><tr><th>Product</th><th style={{textAlign:'right'}}>Cost</th><th style={{textAlign:'right'}}>Charge</th><th style={{textAlign:'center'}}>Freq</th><th style={{textAlign:'right'}}>Profit</th><th></th></tr></thead>
                      <tbody>
                        {siteProducts.map(p => {
                          const m = productMonthly(p, periodDays);
                          return (
                            <tr key={p.id}>
                              <td style={{fontWeight:500}}>{p.name}</td>
                              <td style={{textAlign:'right',color:'#f59e0b'}}>{fmt(m.cost)}</td>
                              <td style={{textAlign:'right',color:'#10b981'}}>{fmt(m.charge)}</td>
                              <td style={{textAlign:'center',color:'var(--text-3)',fontSize:'0.75rem'}}>{p.frequency}</td>
                              <td style={{textAlign:'right',fontWeight:600,color: m.charge - m.cost >= 0 ? '#10b981' : '#ef4444'}}>{fmt(m.charge - m.cost)}</td>
                              <td style={{textAlign:'right'}}>
                                <button className="btn btn-ghost btn-sm" style={{padding:'0.125rem 0.375rem',fontSize:'0.6875rem'}} onClick={() => { setEditProduct(p); setAddProductSite(site.id); setProductForm({ name: p.name, cost: p.cost||'', charge: p.charge||'', frequency: p.frequency }); }}>Edit</button>
                                <button className="btn btn-ghost btn-sm" style={{padding:'0.125rem 0.375rem',fontSize:'0.6875rem',color:'var(--danger)'}} onClick={() => deleteProduct(p.id)}>Del</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                          <td>Products Total</td>
                          <td style={{textAlign:'right',color:'#f59e0b'}}>{fmt(productCost)}</td>
                          <td style={{textAlign:'right',color:'#10b981'}}>{fmt(productCharge)}</td>
                          <td></td>
                          <td style={{textAlign:'right',color: productCharge - productCost >= 0 ? '#10b981' : '#ef4444'}}>{fmt(productCharge - productCost)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div style={{fontSize:'0.8125rem',color:'var(--text-3)',padding:'0.25rem 0'}}>No products — click + Add</div>
                  )}
                </div>

                {/* Site P&L summary */}
                {(chargeRate > 0 || productCharge > 0) && (() => {
                  const totalRev = chargeRevenue + productCharge;
                  const totalCost = rosterPay + productCost;
                  const siteMargin = totalRev - totalCost;
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.5rem',padding:'0.75rem',background:'var(--surface-2)',borderRadius:'8px',fontSize:'0.8125rem'}}>
                      <div style={{textAlign:'center'}}>
                        <div style={{color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Revenue</div>
                        <div style={{fontWeight:700,color:'#10b981'}}>{fmt(totalRev)}</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Total Cost</div>
                        <div style={{fontWeight:700,color:'#f59e0b'}}>{fmt(totalCost)}</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Margin</div>
                        <div style={{fontWeight:700,color: siteMargin >= 0 ? '#10b981' : '#ef4444'}}>{fmt(siteMargin)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}

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

            {shifts.length > 0 && grandCharge === 0 && (
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
