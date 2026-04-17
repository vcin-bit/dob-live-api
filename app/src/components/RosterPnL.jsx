import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function ShiftRoster({ user }) {
  const [shifts, setShifts] = useState([]);
  const [sites, setSites] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  async function load() {
    try {
      const [shiftsRes, sitesRes, usersRes] = await Promise.all([
        api.shifts.list({ limit: 200 }),
        api.sites.list(),
        api.users.list(),
      ]);
      setShifts(shiftsRes.data || []);
      setSites(sitesRes.data || []);
      setOfficers((usersRes.data || []).filter(u => u.role === 'OFFICER'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Build week days
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + weekOffset * 7);
  weekStart.setHours(0,0,0,0);
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayLabel = d => d.toLocaleDateString('en-GB', {weekday:'short',day:'2-digit',month:'short'});
  const isoDate  = d => d.toISOString().split('T')[0];

  const shiftsForDay = d => shifts.filter(s => {
    const sd = new Date(s.start_time);
    return sd.toISOString().split('T')[0] === isoDate(d);
  });

  const statusColor = s => {
    if (s.status === 'completed') return 'var(--success)';
    if (s.status === 'no_show') return 'var(--danger)';
    return 'var(--blue)';
  };

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <div className="topbar-title">Shift Roster</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w-1)}>← Prev</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>This Week</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w+1)}>Next →</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Shift
        </button>
      </div>
      <div className="page-content" style={{overflowX:'auto'}}>
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <table className="table" style={{minWidth:'900px'}}>
            <thead>
              <tr>
                {days.map(d => (
                  <th key={isoDate(d)} style={{
                    background: isoDate(d) === isoDate(new Date()) ? 'var(--blue-light)' : 'var(--surface-2)',
                    color: isoDate(d) === isoDate(new Date()) ? 'var(--blue)' : 'var(--text-2)',
                  }}>
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map(d => {
                  const dayShifts = shiftsForDay(d);
                  return (
                    <td key={isoDate(d)} style={{verticalAlign:'top',padding:'0.5rem',minHeight:'80px'}}>
                      {dayShifts.length === 0 ? (
                        <div style={{color:'var(--text-3)',fontSize:'0.75rem',textAlign:'center',padding:'0.5rem'}}>—</div>
                      ) : (
                        dayShifts.map(s => (
                          <div key={s.id} style={{
                            padding:'0.375rem 0.5rem',
                            borderRadius:'4px',
                            marginBottom:'0.375rem',
                            background:'var(--surface-2)',
                            borderLeft:`3px solid ${statusColor(s)}`,
                            fontSize:'0.75rem',
                          }}>
                            <div style={{fontWeight:600,color:'var(--text)'}}>
                              {s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned'}
                            </div>
                            <div style={{color:'var(--text-2)'}}>
                              {s.site?.name || '—'}
                            </div>
                            <div style={{color:'var(--text-3)'}}>
                              {new Date(s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                              {s.end_time ? ' – '+new Date(s.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}
                            </div>
                          </div>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        )}

        {/* Shift list below calendar */}
        {shifts.length > 0 && (
          <div style={{marginTop:'1.5rem'}}>
            <div className="section-title" style={{marginBottom:'0.75rem'}}>All Shifts This Week</div>
            <table className="table">
              <thead>
                <tr><th>Officer</th><th>Site</th><th>Date</th><th>Start</th><th>End</th><th>Hours</th><th>Charge Rate</th><th>Revenue</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shifts
                  .filter(s => {
                    const sd = new Date(s.start_time);
                    return sd >= days[0] && sd <= days[6];
                  })
                  .map(s => {
                    const hours = s.end_time
                      ? ((new Date(s.end_time)-new Date(s.start_time))/3600000).toFixed(1)
                      : null;
                    const revenue = hours && s.charge_rate ? (hours * s.charge_rate).toFixed(2) : null;
                    return (
                      <tr key={s.id}>
                        <td style={{fontWeight:500}}>
                          {s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : '—'}
                        </td>
                        <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{s.site?.name || '—'}</td>
                        <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>
                          {new Date(s.start_time).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{fontSize:'0.8125rem'}}>
                          {new Date(s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td style={{fontSize:'0.8125rem'}}>
                          {s.end_time ? new Date(s.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '—'}
                        </td>
                        <td style={{fontSize:'0.8125rem'}}>{hours ? `${hours}h` : '—'}</td>
                        <td style={{fontSize:'0.8125rem'}}>{s.charge_rate ? `£${s.charge_rate}/h` : '—'}</td>
                        <td style={{fontSize:'0.8125rem',fontWeight:500}}>{revenue ? `£${revenue}` : '—'}</td>
                        <td>
                          <span className={`badge ${s.status==='completed'?'badge-success':s.status==='no_show'?'badge-danger':'badge-neutral'}`}>
                            {s.status || 'Scheduled'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showForm && (
        <ShiftFormModal
          officers={officers}
          sites={sites}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function ShiftFormModal({ officers, sites, onClose, onSaved }) {
  const [form, setForm] = useState({ site_id:'', officer_id:'', date:'', start_time:'07:00', end_time:'19:00', pay_rate:'', charge_rate:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.site_id || !form.officer_id || !form.date) { setError('Site, officer and date are required'); return; }
    try {
      setSaving(true);
      const startDt = new Date(`${form.date}T${form.start_time}:00`).toISOString();
      const endDt   = form.end_time ? new Date(`${form.date}T${form.end_time}:00`).toISOString() : null;
      await api.shifts.create({
        site_id:     form.site_id,
        officer_id:  form.officer_id,
        start_time:  startDt,
        end_time:    endDt,
        pay_rate:    form.pay_rate    ? parseFloat(form.pay_rate)    : null,
        charge_rate: form.charge_rate ? parseFloat(form.charge_rate) : null,
        notes:       form.notes || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Shift</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label">Officer</label>
            <select className="input" value={form.officer_id} onChange={e => setForm(f=>({...f,officer_id:e.target.value}))}>
              <option value="">Select officer</option>
              {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e => setForm(f=>({...f,site_id:e.target.value}))}>
              <option value="">Select site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Start Time</label>
            <input type="time" className="input" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label">End Time</label>
            <input type="time" className="input" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))} />
          </div>
          <div className="field">
            <label className="label">Pay Rate (£/hr)</label>
            <input type="number" step="0.01" className="input" value={form.pay_rate} onChange={e => setForm(f=>({...f,pay_rate:e.target.value}))} placeholder="e.g. 13.50" />
          </div>
          <div className="field">
            <label className="label">Charge Rate (£/hr)</label>
            <input type="number" step="0.01" className="input" value={form.charge_rate} onChange={e => setForm(f=>({...f,charge_rate:e.target.value}))} placeholder="e.g. 19.23" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Shift'}</button>
        </div>
      </div>
    </div>
  );
}

// ── P&L DASHBOARD ─────────────────────────────────────────────────────────────
function ProfitLoss({ user }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.shifts.list({ limit: 500 });
        setShifts(res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const now = new Date();
  const filtered = shifts.filter(s => {
    const d = new Date(s.start_time);
    if (period === 'week') {
      const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()+1); weekStart.setHours(0,0,0,0);
      return d >= weekStart;
    }
    if (period === 'month') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth()/3);
      return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.getFullYear();
    }
    return d.getFullYear()===now.getFullYear();
  });

  const calcHours = s => s.end_time ? (new Date(s.end_time)-new Date(s.start_time))/3600000 : 0;
  const totalRevenue = filtered.reduce((sum,s) => sum + (calcHours(s)*(s.charge_rate||0)), 0);
  const totalCost    = filtered.reduce((sum,s) => sum + (calcHours(s)*(s.pay_rate||0)), 0);
  const totalHours   = filtered.reduce((sum,s) => sum + calcHours(s), 0);
  const grossProfit  = totalRevenue - totalCost;
  const margin       = totalRevenue > 0 ? (grossProfit/totalRevenue*100).toFixed(1) : 0;

  // By site
  const bySite = filtered.reduce((acc, s) => {
    const name = s.site?.name || 'Unknown';
    if (!acc[name]) acc[name] = { revenue:0, cost:0, hours:0, shifts:0 };
    const h = calcHours(s);
    acc[name].revenue += h*(s.charge_rate||0);
    acc[name].cost    += h*(s.pay_rate||0);
    acc[name].hours   += h;
    acc[name].shifts  += 1;
    return acc;
  }, {});
  const siteRows = Object.entries(bySite).sort((a,b) => b[1].revenue - a[1].revenue);

  // By officer
  const byOfficer = filtered.reduce((acc, s) => {
    const name = s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned';
    if (!acc[name]) acc[name] = { cost:0, hours:0, shifts:0 };
    const h = calcHours(s);
    acc[name].cost   += h*(s.pay_rate||0);
    acc[name].hours  += h;
    acc[name].shifts += 1;
    return acc;
  }, {});
  const officerRows = Object.entries(byOfficer).sort((a,b) => b[1].hours - a[1].hours);

  const fmt = n => `£${n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">P&L Dashboard</div>
        <select className="input" style={{width:'140px'}} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>
      <div className="page-content">
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
              <div className="stat-card">
                <div className="stat-value" style={{color:'var(--blue)'}}>{fmt(totalRevenue)}</div>
                <div className="stat-label">Revenue</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{color:'var(--danger)'}}>{fmt(totalCost)}</div>
                <div className="stat-label">Labour Cost</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{color: grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'}}>{fmt(grossProfit)}</div>
                <div className="stat-label">Gross Profit</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{color: parseFloat(margin) >= 20 ? 'var(--success)' : 'var(--warning)'}}>{margin}%</div>
                <div className="stat-label">Margin</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalHours.toFixed(1)}h</div>
                <div className="stat-label">Total Hours</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{filtered.length}</div>
                <div className="stat-label">Shifts</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
              {/* By Site */}
              <div className="card">
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Revenue by Site</div>
                {siteRows.length === 0 ? <div className="empty-state"><p>No data</p></div> : (
                  <table className="table">
                    <thead><tr><th>Site</th><th>Hours</th><th>Revenue</th><th>Cost</th><th>GP</th></tr></thead>
                    <tbody>
                      {siteRows.map(([name, d]) => (
                        <tr key={name}>
                          <td style={{fontWeight:500,fontSize:'0.8125rem'}}>{name}</td>
                          <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.hours.toFixed(1)}h</td>
                          <td style={{fontSize:'0.8125rem'}}>{fmt(d.revenue)}</td>
                          <td style={{fontSize:'0.8125rem',color:'var(--danger)'}}>{fmt(d.cost)}</td>
                          <td style={{fontSize:'0.8125rem',fontWeight:600,color:(d.revenue-d.cost)>=0?'var(--success)':'var(--danger)'}}>
                            {fmt(d.revenue-d.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* By Officer */}
              <div className="card">
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Labour by Officer</div>
                {officerRows.length === 0 ? <div className="empty-state"><p>No data</p></div> : (
                  <table className="table">
                    <thead><tr><th>Officer</th><th>Shifts</th><th>Hours</th><th>Cost</th></tr></thead>
                    <tbody>
                      {officerRows.map(([name, d]) => (
                        <tr key={name}>
                          <td style={{fontWeight:500,fontSize:'0.8125rem'}}>{name}</td>
                          <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.shifts}</td>
                          <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.hours.toFixed(1)}h</td>
                          <td style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--danger)'}}>{fmt(d.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Note if no pay/charge rates */}
            {filtered.length > 0 && totalRevenue === 0 && (
              <div className="alert alert-warning" style={{marginTop:'1rem'}}>
                No pay or charge rates are set on these shifts. Add rates when creating shifts to see P&L figures.
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
