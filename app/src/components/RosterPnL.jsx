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
