import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import SitePlaybook from './SitePlaybook';
import RosterCalendar from './RosterCalendar';
import { PortalSettingsModal } from './Portal';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function ManagerDashboard({ user }) {
  const [data, setData] = useState({ shifts:[], incidents:[], recentLogs:[], pendingTasks:0, totalOfficers:0 });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  async function load() {
    try {
      const [shiftsRes, logsRes, tasksRes, usersRes] = await Promise.all([
        api.shifts.list({ status: 'ACTIVE', limit: 50 }),
        api.logs.list({ limit: 20 }),
        api.tasks.list({ status: 'PENDING' }),
        api.users.list({ role: 'OFFICER' }),
      ]);
      const logs = logsRes.data || [];
      const incidents = logs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type));
      setData({
        shifts: shiftsRes.data || [],
        incidents,
        recentLogs: logs.slice(0, 8),
        pendingTasks: tasksRes.data?.length || 0,
        totalOfficers: usersRes.data?.length || 0,
      });
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // auto-refresh every minute
    return () => clearInterval(t);
  }, []);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',padding:'3rem'}}><div className="spinner" /></div>;

  // Compliance alerts — things wrong right now
  const alerts = [];
  data.shifts.forEach(s => {
    const hrs = (Date.now() - new Date(s.checked_in_at||s.start_time).getTime()) / 3600000;
    if (hrs > 3) alerts.push({ level:'warn', msg:`${s.officer?.first_name} ${s.officer?.last_name} — no patrol logged in ${Math.round(hrs)}h`, site: s.site?.name });
  });
  if (data.incidents.length > 0) {
    const unacked = data.incidents.filter(i => !i.client_reportable);
    if (unacked.length) alerts.push({ level:'info', msg:`${unacked.length} incident${unacked.length>1?'s':''} recorded tonight — review required`, site: null });
  }

  const shiftDuration = (s) => {
    const mins = Math.floor((Date.now() - new Date(s.checked_in_at||s.start_time).getTime()) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Operations Command</div>
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          {lastRefresh && <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Updated {lastRefresh.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button onClick={load} className="btn btn-secondary btn-sm">Refresh</button>
        </div>
      </div>
      <div className="page-content">

        {/* Compliance alerts — red/amber banners */}
        {alerts.length > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'1.25rem'}}>
            {alerts.map((a, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',background:a.level==='warn'?'rgba(220,38,38,0.08)':'rgba(251,191,36,0.08)',border:`1px solid ${a.level==='warn'?'rgba(220,38,38,0.25)':'rgba(251,191,36,0.25)'}`,borderRadius:'8px'}}>
                <span style={{fontSize:'1rem'}}>{a.level==='warn'?'⚠':'ℹ'}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'0.875rem',fontWeight:600,color:a.level==='warn'?'var(--danger)':'var(--warning)'}}>{a.msg}</div>
                  {a.site && <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'1px'}}>{a.site}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live site status — one card per active shift */}
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <div style={{fontSize:'0.6875rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
              Live — {data.shifts.length} officer{data.shifts.length!==1?'s':''} on duty
            </div>
            <Link to="/on-duty" style={{fontSize:'0.8125rem',color:'var(--blue)',textDecoration:'none',fontWeight:500}}>Full view →</Link>
          </div>
          {data.shifts.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:'1.5rem',color:'var(--text-3)'}}>No officers currently on duty</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
              {data.shifts.map(s => {
                const hrs = (Date.now() - new Date(s.checked_in_at||s.start_time).getTime()) / 3600000;
                const overdue = hrs > 3;
                return (
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.875rem 1rem',background:overdue?'rgba(220,38,38,0.05)':'rgba(74,222,128,0.05)',border:`1px solid ${overdue?'rgba(220,38,38,0.2)':'rgba(74,222,128,0.15)'}`,borderRadius:'10px'}}>
                    <div style={{width:'10px',height:'10px',borderRadius:'50%',background:overdue?'#ef4444':'#4ade80',flexShrink:0,boxShadow:`0 0 6px ${overdue?'#ef4444':'#4ade80'}`}} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'0.9375rem',fontWeight:700}}>{s.officer?`${s.officer.first_name} ${s.officer.last_name}`:'Unknown'}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginTop:'1px'}}>
                        {s.site?.name||'—'} · {shiftDuration(s)} on duty
                        {overdue && <span style={{color:'var(--danger)',fontWeight:600,marginLeft:'6px'}}>· PATROL OVERDUE</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'0.5rem',flexShrink:0}}>
                      <Link to={`/sites/${s.site_id}`} className="btn btn-secondary btn-sm">Site</Link>
                      <button onClick={async()=>{if(!window.confirm(`Force end shift for ${s.officer?.first_name}?`))return;await api.shifts.update(s.id,{status:'COMPLETED',checked_out_at:new Date().toISOString()});load();}} className="btn btn-sm" style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',color:'var(--danger)'}}>End</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incidents tonight — always prominent */}
        {data.incidents.length > 0 && (
          <div className="card" style={{marginBottom:'1.25rem',borderColor:'rgba(220,38,38,0.2)',background:'rgba(220,38,38,0.03)'}}>
            <div className="section-header" style={{marginBottom:'0.75rem'}}>
              <div className="section-title" style={{color:'var(--danger)'}}>⚠ Incidents — {data.incidents.length} recorded</div>
              <Link to="/logs" style={{fontSize:'0.8125rem',color:'var(--blue)',textDecoration:'none'}}>All logs →</Link>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {data.incidents.slice(0,5).map(l => (
                <div key={l.id} style={{padding:'0.625rem 0.75rem',background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.15)',borderRadius:'6px'}}>
                  <div style={{display:'flex',gap:'0.5rem',alignItems:'flex-start',justifyContent:'space-between'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'0.875rem',fontWeight:600,color:'var(--danger)'}}>{l.title||l.log_type}</div>
                      {l.description && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.description}</div>}
                      <div style={{fontSize:'0.6875rem',color:'var(--text-3)',marginTop:'2px'}}>
                        {l.officer?`${l.officer.first_name} ${l.officer.last_name} · `:''}{l.site?.name||''} · {new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                    {l.client_reportable && <span className="badge badge-warning" style={{flexShrink:0}}>Client</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="stats-grid" style={{marginBottom:'1.25rem'}}>
          <div className="stat-card"><div className="stat-value">{data.shifts.length}</div><div className="stat-label">On Duty</div></div>
          <div className="stat-card"><div className="stat-value" style={{color:data.incidents.length>0?'var(--danger)':'var(--text)'}}>{data.incidents.length}</div><div className="stat-label">Incidents</div></div>
          <div className="stat-card"><div className="stat-value" style={{color:data.pendingTasks>0?'var(--warning)':'var(--text)'}}>{data.pendingTasks}</div><div className="stat-label">Tasks Due</div></div>
          <div className="stat-card"><div className="stat-value">{data.totalOfficers}</div><div className="stat-label">Officers</div></div>
        </div>

        {/* Recent activity + quick actions */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
          <div className="card">
            <div className="section-header" style={{marginBottom:'0.75rem'}}>
              <div className="section-title">Recent Activity</div>
              <Link to="/logs" style={{fontSize:'0.8125rem',color:'var(--blue)',textDecoration:'none'}}>All →</Link>
            </div>
            {data.recentLogs.length === 0 ? <div className="empty-state"><p>No logs yet</p></div> : (
              <div>{data.recentLogs.map(log => <ManagerLogPreview key={log.id} log={log} />)}</div>
            )}
          </div>
          <div className="card">
            <div className="section-title" style={{marginBottom:'0.75rem'}}>Quick Actions</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              <Link to="/tasks" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}><PlusIcon style={{width:'1rem',height:'1rem'}} /> Assign Task</Link>
              <Link to="/logs" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}><EyeIcon style={{width:'1rem',height:'1rem'}} /> Review Logs</Link>
              <Link to="/on-duty" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}><UsersIcon style={{width:'1rem',height:'1rem'}} /> Officers On Duty</Link>
              <Link to="/sites" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}><BuildingOfficeIcon style={{width:'1rem',height:'1rem'}} /> Sites & Playbooks</Link>
              <Link to="/reports" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}><ChartBarIcon style={{width:'1rem',height:'1rem'}} /> Reports</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function StatCard({ title, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{title}</div>
    </div>
  );
}


function ManagerLogPreview({ log }) {
  const typeColors = {
    INCIDENT:'badge-danger', ALARM:'badge-warning', PATROL:'badge-blue', GENERAL:'badge-neutral',
  };
  return (
    <div style={{display:'flex',gap:'0.75rem',alignItems:'flex-start',padding:'0.5rem 0',borderBottom:'1px solid var(--border)'}}>
      <span className={`badge ${typeColors[log.log_type]||'badge-neutral'}`} style={{flexShrink:0,marginTop:'2px'}}>{log.log_type}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:'0.875rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.title || 'Log Entry'}</div>
        <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>
          {log.officer ? `${log.officer.first_name} ${log.officer.last_name}` : ''}{log.site ? ` · ${log.site.name}` : ''}
          {' · '}{new Date(log.occurred_at).toLocaleDateString('en-GB')}
        </div>
      </div>
    </div>
  );
}


function ManagerActionButton({ to, icon, title, subtitle }) {
  return (
    <Link to={to} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem',border:'1px solid var(--border)',borderRadius:'var(--radius)',textDecoration:'none',color:'var(--text)',background:'var(--surface)',transition:'background 0.15s'}}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
      onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}
    >
      <span style={{color:'var(--blue)'}}>{icon}</span>
      <div>
        <div style={{fontSize:'0.875rem',fontWeight:500}}>{title}</div>
        {subtitle && <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{subtitle}</div>}
      </div>
    </Link>
  );
}


function SiteManagement({ user }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [portalSite, setPortalSite] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  async function load() {
    try {
      const res = await api.sites.list();
      setSites(res.data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Sites</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditSite(null); setShowForm(true); }}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Site
        </button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : sites.length === 0 ? (
          <div className="empty-state"><p>No sites yet. Add your first site.</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Address</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr key={site.id}>
                  <td style={{fontWeight:500}}><Link to={`/sites/${site.id}`} style={{color:'var(--text)',textDecoration:'none',fontWeight:600}}>{site.name}</Link></td>
                  <td style={{color:'var(--text-2)'}}>{site.address || '—'}</td>
                  <td>
                    <span className={`badge ${site.active !== false ? 'badge-success' : 'badge-neutral'}`}>
                      {site.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                    <Link to={`/sites/${site.id}`} className="btn btn-ghost btn-sm" style={{color:"var(--blue)"}}>Configure</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditSite(site); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPortalSite(site)}>Portal</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => {
                      if (!window.confirm(`Delete "${site.name}"? This cannot be undone.`)) return;
                      try { await api.sites.delete(site.id); load(); } catch(e) { alert(e.message); }
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <SiteFormModal
          site={editSite}
          onClose={() => setShowForm(false)}
          onSaved={(msg) => { setShowForm(false); load(); if (msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 5000); } }}
        />
      )}
      {portalSite && (
        <PortalSettingsModal
          site={portalSite}
          onClose={() => setPortalSite(null)}
          onSaved={() => { setPortalSite(null); load(); }}
        />
      )}
    </div>
  );
}

function SiteFormModal({ site, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:                    site?.name || '',
    address:                 site?.address || '',
    city:                    site?.city || '',
    postcode:                site?.postcode || '',
    contact_name:            site?.contact_name || '',
    contact_phone:           site?.contact_phone || '',
    contact_email:           site?.contact_email || '',
    escalation_contact_1_name:   site?.escalation_contact_1_name || '',
    escalation_contact_1_mobile: site?.escalation_contact_1_mobile || '',
    escalation_contact_2_name:   site?.escalation_contact_2_name || '',
    escalation_contact_2_mobile: site?.escalation_contact_2_mobile || '',
    geofence_lat:            site?.geofence_lat || '',
    geofence_lng:            site?.geofence_lng || '',
    geofence_radius:         site?.geofence_radius || 500,
    notes:                   site?.notes || '',
    active:                  site?.active !== false,
    contract_start_date:     site?.contract_start_date || '',
    client_company_address:  site?.client_company_address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k, v) => setForm(p => ({...p, [k]: v}));

  async function save() {
    if (!form.name.trim()) { setError('Site name is required'); return; }
    try {
      setSaving(true);
      const payload = {
        ...form,
        geofence_lat: form.geofence_lat ? parseFloat(form.geofence_lat) : null,
        geofence_lng: form.geofence_lng ? parseFloat(form.geofence_lng) : null,
        geofence_radius: parseInt(form.geofence_radius) || 500,
      };
      if (site) await api.sites.update(site.id, payload);
      else await api.sites.create(payload);
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'640px'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{site ? 'Edit Site' : 'Add Site'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Site Name *</label>
            <input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Brindleyplace" />
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e=>f('address',e.target.value)} placeholder="Street address" />
          </div>
          <div className="field">
            <label className="label">City</label>
            <input className="input" value={form.city} onChange={e=>f('city',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Postcode</label>
            <input className="input" value={form.postcode} onChange={e=>f('postcode',e.target.value)} />
          </div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
            <div className="section-title" style={{marginBottom:'0.5rem'}}>Site Contact</div>
          </div>
          <div className="field">
            <label className="label">Contact Name</label>
            <input className="input" value={form.contact_name} onChange={e=>f('contact_name',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Contact Phone</label>
            <input className="input" value={form.contact_phone} onChange={e=>f('contact_phone',e.target.value)} />
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Contact Email</label>
            <input type="email" className="input" value={form.contact_email} onChange={e=>f('contact_email',e.target.value)} />
          </div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
            <div className="section-title" style={{marginBottom:'0.5rem'}}>Escalation Contacts</div>
          </div>
          <div className="field">
            <label className="label">Escalation 1 Name</label>
            <input className="input" value={form.escalation_contact_1_name} onChange={e=>f('escalation_contact_1_name',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Escalation 1 Mobile</label>
            <input className="input" value={form.escalation_contact_1_mobile} onChange={e=>f('escalation_contact_1_mobile',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Escalation 2 Name</label>
            <input className="input" value={form.escalation_contact_2_name} onChange={e=>f('escalation_contact_2_name',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Escalation 2 Mobile</label>
            <input className="input" value={form.escalation_contact_2_mobile} onChange={e=>f('escalation_contact_2_mobile',e.target.value)} />
          </div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
            <div className="section-title" style={{marginBottom:'0.5rem'}}>Client</div>
          </div>
          <div className="field">
            <label className="label">Contract Start Date</label>
            <input type="date" className="input" value={form.contract_start_date} onChange={e=>f('contract_start_date',e.target.value)} />
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Client Company Address</label>
            <input className="input" value={form.client_company_address} onChange={e=>f('client_company_address',e.target.value)} placeholder="Client's registered address" />
          </div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
            <div className="section-title" style={{marginBottom:'0.5rem'}}>Geofence</div>
          </div>
          <div className="field">
            <label className="label">Latitude</label>
            <input type="number" step="any" className="input" value={form.geofence_lat} onChange={e=>f('geofence_lat',e.target.value)} placeholder="e.g. 52.4862" />
          </div>
          <div className="field">
            <label className="label">Longitude</label>
            <input type="number" step="any" className="input" value={form.geofence_lng} onChange={e=>f('geofence_lng',e.target.value)} placeholder="e.g. -1.8904" />
          </div>
          <div className="field">
            <label className="label">Radius (metres)</label>
            <input type="number" className="input" value={form.geofence_radius} onChange={e=>f('geofence_radius',e.target.value)} placeholder="500" />
          </div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={e=>f('notes',e.target.value)} />
          </div>
          <div className="field">
            <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer'}}>
              <input type="checkbox" checked={form.active} onChange={e=>f('active',e.target.checked)} style={{width:'1rem',height:'1rem',accentColor:'var(--blue)'}} />
              <span className="label" style={{margin:0}}>Active site</span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  );
}



function LogReview({ user }) {
  const [logs, setLogs] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [logsRes, sitesRes] = await Promise.all([
          api.logs.list({ limit: 500 }),
          api.sites.list(),
        ]);
        setLogs(logsRes.data || []);
        setSites(sitesRes.data || []);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const logTypes = ['PATROL','INCIDENT','ALARM','ACCESS','VISITOR','HANDOVER','MAINTENANCE','VEHICLE','GENERAL'];

  const filtered = logs.filter(l => {
    if (typeFilter && l.log_type !== typeFilter) return false;
    if (siteFilter && l.site_id !== siteFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (l.title || '').toLowerCase().includes(q) ||
             (l.description || '').toLowerCase().includes(q) ||
             (l.officer?.first_name || '').toLowerCase().includes(q) ||
             (l.officer?.last_name || '').toLowerCase().includes(q) ||
             (l.site?.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const typeColors = {
    INCIDENT: 'badge-danger', ALARM: 'badge-warning',
    PATROL: 'badge-blue', GENERAL: 'badge-neutral',
    ACCESS: 'badge-navy', VISITOR: 'badge-navy',
    HANDOVER: 'badge-success', MAINTENANCE: 'badge-neutral',
    VEHICLE: 'badge-neutral', WELFARE: 'badge-blue', KEYHOLDING: 'badge-navy',
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Log Review</div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <input
            className="input"
            style={{width:'160px'}}
            placeholder="Search..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select className="input" style={{width:'140px'}} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" style={{width:'130px'}} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {logTypes.map(t => <option key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No logs found</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Type</th>
                <th>Title</th>
                <th>Officer</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td style={{color:'var(--text-2)',whiteSpace:'nowrap',fontSize:'0.8125rem'}}>
                    {new Date(log.occurred_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'2-digit'})}
                    {' '}
                    {new Date(log.occurred_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}
                  </td>
                  <td><span className={`badge ${typeColors[log.log_type] || 'badge-neutral'}`}>{log.log_type}</span></td>
                  <td style={{fontWeight:500,maxWidth:'240px'}}>
                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.title || '—'}</div>
                    {log.description && <div style={{fontSize:'0.75rem',color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.description}</div>}
                  </td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>
                    {log.officer ? `${log.officer.first_name} ${log.officer.last_name}` : '—'}
                  </td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{log.site?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


function ManagerLogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const typeMap = {
    PATROL:'PAT',INCIDENT:'INC',ALARM:'ALM',ACCESS:'ACC',VISITOR:'VIS',
    HANDOVER:'HND',MAINTENANCE:'MNT',VEHICLE:'VEH',KEYHOLDING:'KEY',GENERAL:'GEN',
  };
  const code = typeMap[log.log_type] || (log.log_type?.slice(0,3) || 'LOG');
  const typeColors = { INCIDENT:'badge-danger', ALARM:'badge-warning', PATROL:'badge-blue', GENERAL:'badge-neutral' };

  return (
    <div style={{padding:'0.75rem',border:'1px solid var(--border)',borderRadius:'var(--radius)',marginBottom:'0.5rem'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem'}}>
        <div style={{width:'2.25rem',height:'2.25rem',background:'var(--navy)',color:'#fff',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.5625rem',fontWeight:700,letterSpacing:'0.03em',flexShrink:0}}>{code}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.25rem'}}>
            <span style={{fontWeight:600,fontSize:'0.875rem'}}>{log.title || 'Log Entry'}</span>
            <span className={`badge ${typeColors[log.log_type]||'badge-neutral'}`}>{log.log_type}</span>
            <span style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{log.occurred_at ? new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}</span>
          </div>
          <div style={{display:'flex',gap:'1rem',fontSize:'0.8125rem',color:'var(--text-2)',marginBottom:log.description?'0.375rem':0}}>
            {log.site && <span>{log.site.name}</span>}
            {log.officer && <span>{log.officer.first_name} {log.officer.last_name}</span>}
          </div>
          {log.description && (
            <p style={{fontSize:'0.875rem',color:'var(--text-2)',lineHeight:1.5}}>
              {expanded ? log.description : (log.description.length > 200 ? log.description.substring(0,200)+'...' : log.description)}
            </p>
          )}
          {log.description?.length > 200 && (
            <button onClick={() => setExpanded(!expanded)} style={{fontSize:'0.8125rem',color:'var(--blue)',background:'none',border:'none',cursor:'pointer',padding:'0.25rem 0',fontWeight:500}}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Task Assignment Screen
function TaskAssignment({ user }) {
  const [tasks, setTasks] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('PENDING');

  async function load() {
    try {
      const [tasksRes, officersRes, sitesRes] = await Promise.all([
        api.tasks.list(),
        api.users.list(),
        api.sites.list(),
      ]);
      setTasks(tasksRes.data || []);
      setOfficers(officersRes.data?.filter(u => u.role === 'OFFICER') || []);
      setSites(sitesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = tasks.filter(t => tab === 'ALL' || t.status === tab || (!t.status && tab === 'PENDING'));
  const counts = {
    PENDING: tasks.filter(t => !t.status || t.status === 'PENDING').length,
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    COMPLETE: tasks.filter(t => t.status === 'COMPLETE').length,
  };

  async function updateStatus(taskId, status) {
    await api.tasks.update(taskId, { status });
    load();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Tasks</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Assign Task
        </button>
      </div>
      <div className="page-content">
        <div className="tabs">
          {[['PENDING','Pending'],['IN_PROGRESS','In Progress'],['COMPLETE','Complete'],['ALL','All']].map(([val,label]) => (
            <button key={val} className={`tab${tab===val?' active':''}`} onClick={() => setTab(val)}>
              {label} {val !== 'ALL' && <span style={{fontSize:'0.75rem',color:'inherit',opacity:0.7}}>({counts[val]||0})</span>}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No tasks</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Task</th><th>Assigned To</th><th>Site</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id}>
                  <td>
                    <div style={{fontWeight:500}}>{task.title}</div>
                    {task.description && <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{task.description}</div>}
                  </td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>
                    {task.assigned_to_user ? `${task.assigned_to_user.first_name} ${task.assigned_to_user.last_name}` : '—'}
                  </td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{task.site?.name || '—'}</td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${task.status==='COMPLETE'?'badge-success':task.status==='IN_PROGRESS'?'badge-blue':'badge-neutral'}`}>
                      {task.status || 'Pending'}
                    </span>
                  </td>
                  <td style={{textAlign:'right'}}>
                    {task.status !== 'COMPLETE' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(task.id, task.status === 'IN_PROGRESS' ? 'COMPLETE' : 'IN_PROGRESS')}>
                        {task.status === 'IN_PROGRESS' ? 'Complete' : 'Start'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <TaskCreateForm
          officers={officers}
          sites={sites}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}


function TaskCreateForm({ officers, sites, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', site_id: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    try {
      setSaving(true);
      await api.tasks.create({
        title: form.title,
        description: form.description || null,
        assigned_to: form.assigned_to || null,
        site_id: form.site_id || null,
        due_date: form.due_date || null,
      });
      onSuccess();
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
          <div className="modal-title">Assign Task</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field">
          <label className="label">Task Title</label>
          <input className="input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="What needs to be done?" />
        </div>
        <div className="field">
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Additional details..." />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">Assign To</label>
            <select className="input" value={form.assigned_to} onChange={e => setForm(f=>({...f,assigned_to:e.target.value}))}>
              <option value="">Unassigned</option>
              {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e => setForm(f=>({...f,site_id:e.target.value}))}>
              <option value="">No site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label">Due Date</label>
          <input type="date" className="input" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Assign Task'}</button>
        </div>
      </div>
    </div>
  );
}



function SiteDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [assignedOfficers, setAssignedOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!id) return;
    async function fetchSite() {
      try {
        setLoading(true);
        const [siteRes, logsRes, shiftsRes, usersRes] = await Promise.all([
          api.sites.get(id),
          api.logs.list({ site_id: id, limit: 10 }),
          api.shifts.list({ site_id: id, limit: 50 }),
          api.users.list(),
        ]);
        setSite(siteRes.data);
        setRecentLogs(logsRes.data || []);
        setShifts(shiftsRes.data || []);
        // Load site assignments for each officer to find who's assigned here
        const officers = (usersRes.data || []).filter(u => u.role === 'OFFICER');
        const withSites = await Promise.all(officers.map(async o => {
          try {
            const res = await api.officerSites.list(o.id);
            const siteIds = (res.data || []).map(s => s.id);
            return siteIds.includes(id) ? o : null;
          } catch { return null; }
        }));
        setAssignedOfficers(withSites.filter(Boolean));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSite();
  }, [id]);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'16rem'}}>
      <div className="spinner" />
    </div>
  );

  if (error || !site) return (
    <div className="page-content">
      <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error || 'Site not found'}</div>
      <button onClick={() => navigate('/sites')} className="btn btn-secondary">← Back to Sites</button>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <button onClick={() => navigate('/sites')} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',padding:0,fontSize:'1.125rem'}}>←</button>
          <div>
            <div className="topbar-title">{site.name}</div>
            {site.client && <div className="topbar-sub">{site.client.client_company_name}</div>}
          </div>
        </div>
        <span className={`badge ${site.active !== false ? 'badge-success' : 'badge-neutral'}`}>
          {site.active !== false ? 'Active' : 'Inactive'}
        </span>
      </div>
      {/* Tab bar */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',padding:'0 1.5rem',background:'var(--surface)'}}>
        {[{key:'info',label:'Site Info'},{key:'logs',label:'Recent Logs'},{key:'roster',label:'Roster'},{key:'officers',label:'Officers'},{key:'codes',label:'Codes'},{key:'playbook',label:'Virtual Supervisor'}].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{padding:'0.75rem 1rem',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.key?'var(--blue)':'transparent'}`,color:activeTab===t.key?'var(--blue)':'var(--text-2)',fontSize:'0.875rem',fontWeight:600,cursor:'pointer',marginBottom:'-1px',whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="page-content">
        {activeTab === 'playbook' && <SitePlaybook siteId={id} />}
        {activeTab === 'logs' && (
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
              <div className="section-title">Recent Logs</div>
              <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Last 10</span>
            </div>
            {recentLogs.length === 0 ? (
              <div className="empty-state"><p>No logs recorded for this site</p></div>
            ) : (
              recentLogs.map(log => <ManagerLogCard key={log.id} log={log} />)
            )}
          </div>
        )}
        {activeTab === 'roster' && (
          <RosterCalendar siteId={id} user={user} />
        )}
        {activeTab === 'officers' && (
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
              <div className="section-title">Assigned Officers</div>
              <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{assignedOfficers.length} officer{assignedOfficers.length!==1?'s':''}</span>
            </div>
            {assignedOfficers.length === 0 ? (
              <div className="empty-state"><p>No officers assigned to this site</p></div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>SIA Licence</th><th>SIA Expiry</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {assignedOfficers.map(o => {
                    const expiry = o.sia_expiry_date ? new Date(o.sia_expiry_date) : null;
                    const now = new Date();
                    const daysLeft = expiry ? (expiry - now) / 86400000 : null;
                    const siaColor = !expiry ? 'var(--text-3)' : daysLeft < 0 ? '#ef4444' : daysLeft < 90 ? '#f59e0b' : '#22c55e';
                    const siaLabel = !expiry ? '—' : daysLeft < 0 ? 'Expired' : daysLeft < 90 ? 'Expiring' : 'Valid';
                    return (
                      <tr key={o.id}>
                        <td style={{fontWeight:500}}>{o.first_name} {o.last_name}</td>
                        <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{o.sia_licence_number||'—'}</td>
                        <td style={{fontSize:'0.8125rem'}}>
                          {expiry ? new Date(o.sia_expiry_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td>
                          <span style={{display:'inline-flex',alignItems:'center',gap:'0.375rem',fontSize:'0.8125rem',color:siaColor,fontWeight:600}}>
                            <span style={{width:8,height:8,borderRadius:'50%',background:siaColor,display:'inline-block'}} />
                            {siaLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
        {activeTab === 'codes' && <SiteCodesTab siteId={id} />}
        {activeTab === 'info' && <div>
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="section-title" style={{marginBottom:'0.875rem'}}>Site Details</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <InfoField label="Name" value={site.name} />
            <InfoField label="Status" value={site.active !== false ? 'Active' : 'Inactive'} />
            <InfoField label="Address" value={site.address} span />
            <InfoField label="City" value={site.city} />
            <InfoField label="Postcode" value={site.postcode} />
            <InfoField label="Notes" value={site.notes} span />
          </div>
        </div>
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="section-title" style={{marginBottom:'0.875rem'}}>Site Contact</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <InfoField label="Contact Name" value={site.contact_name} />
            <InfoField label="Phone" value={site.contact_phone} />
            <InfoField label="Email" value={site.contact_email} span />
          </div>
        </div>
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="section-title" style={{marginBottom:'0.875rem'}}>Escalation Contacts</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <InfoField label="Escalation 1 Name" value={site.escalation_contact_1_name} />
            <InfoField label="Escalation 1 Mobile" value={site.escalation_contact_1_mobile} />
            <InfoField label="Escalation 2 Name" value={site.escalation_contact_2_name} />
            <InfoField label="Escalation 2 Mobile" value={site.escalation_contact_2_mobile} />
          </div>
        </div>
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="section-title" style={{marginBottom:'0.875rem'}}>Client</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <InfoField label="Client Name" value={site.client_name} />
            <InfoField label="Contract Start Date" value={site.contract_start_date ? new Date(site.contract_start_date).toLocaleDateString('en-GB') : null} />
            <InfoField label="Client Company Address" value={site.client_company_address} span />
            <InfoField label="Contact Name" value={site.client_contact_name} />
            <InfoField label="Contact Email" value={site.client_contact_email} />
            <InfoField label="Contact Phone" value={site.client_contact_phone} />
          </div>
        </div>
        <div className="card">
          <div className="section-title" style={{marginBottom:'0.875rem'}}>Geofence</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem'}}>
            <InfoField label="Latitude" value={site.geofence_lat} />
            <InfoField label="Longitude" value={site.geofence_lng} />
            <InfoField label="Radius (m)" value={site.geofence_radius} />
          </div>
        </div>
        </div>}
      </div>
    </div>
  );
}

// ── TEAM MANAGEMENT ────────────────────────────────────────────────────────────
function SiteAssignModal({ officer, onClose }) {
  const [sites, setSites] = useState([]);
  const [assigned, setAssigned] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [allSites, officerSites] = await Promise.all([
          api.sites.list(),
          api.officerSites.list(officer.id),
        ]);
        setSites(allSites.data || []);
        setAssigned(new Set((officerSites.data || []).map(s => s.id)));
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();
  }, [officer.id]);

  function toggle(siteId) {
    setAssigned(prev => {
      const next = new Set(prev);
      next.has(siteId) ? next.delete(siteId) : next.add(siteId);
      return next;
    });
  }

  async function save() {
    try {
      setSaving(true);
      await api.officerSites.update(officer.id, [...assigned]);
      onClose();
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
          <div className="modal-title">Assign Sites — {officer.first_name} {officer.last_name}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>
        ) : sites.length === 0 ? (
          <div className="empty-state"><p>No sites available</p></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:'320px',overflowY:'auto'}}>
            {sites.map(site => (
              <label key={site.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem',border:'1px solid var(--border)',borderRadius:'var(--radius)',cursor:'pointer',background:assigned.has(site.id)?'var(--blue-light)':'var(--surface)'}}>
                <input
                  type="checkbox"
                  checked={assigned.has(site.id)}
                  onChange={() => toggle(site.id)}
                  style={{width:'1rem',height:'1rem',accentColor:'var(--blue)'}}
                />
                <div>
                  <div style={{fontSize:'0.875rem',fontWeight:500}}>{site.name}</div>
                  {site.address && <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{site.address}</div>}
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||loading}>
            {saving ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}


function TeamManagement({ user }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [siteAssignOfficer, setSiteAssignOfficer] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  async function load() {
    try {
      const res = await api.users.list();
      setOfficers(res.data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const roleLabels = { OFFICER:'Officer', OPS_MANAGER:'Ops Manager', FD:'Field Director', COMPANY:'Admin', SUPER_ADMIN:'Super Admin' };
  const roleBadge  = { OFFICER:'badge-neutral', OPS_MANAGER:'badge-blue', FD:'badge-navy', COMPANY:'badge-navy', SUPER_ADMIN:'badge-danger' };
  const isSiaExpired      = d => d && new Date(d) < new Date();
  const isSiaExpiringSoon = d => { if (!d) return false; const days=(new Date(d)-new Date())/86400000; return days>0&&days<90; };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Team</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditUser(null); setShowForm(true); }}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Officer
        </button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {successMsg && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{successMsg}</div>}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>SIA Licence</th><th>SIA Expiry</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {officers.map(o => (
                <tr key={o.id}>
                  <td style={{fontWeight:500}}>{o.first_name} {o.last_name}</td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{o.email}</td>
                  <td><span className={`badge ${roleBadge[o.role]||'badge-neutral'}`}>{roleLabels[o.role]||o.role}</span></td>
                  <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{o.sia_licence_number||'—'}</td>
                  <td style={{fontSize:'0.8125rem'}}>
                    {o.sia_expiry_date ? (
                      <span style={{color:isSiaExpired(o.sia_expiry_date)?'var(--danger)':isSiaExpiringSoon(o.sia_expiry_date)?'var(--warning)':'var(--text-2)'}}>
                        {new Date(o.sia_expiry_date).toLocaleDateString('en-GB')}
                        {isSiaExpired(o.sia_expiry_date)&&' (Expired)'}
                        {isSiaExpiringSoon(o.sia_expiry_date)&&' (Soon)'}
                      </span>
                    ):'—'}
                  </td>
                  <td><span className={`badge ${o.active!==false?'badge-success':'badge-neutral'}`}>{o.active!==false?'Active':'Inactive'}</span></td>
                  <td style={{textAlign:'right',display:'flex',gap:'0.375rem',justifyContent:'flex-end',flexWrap:'wrap'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSiteAssignOfficer(o)}>Sites</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditUser(o); setShowForm(true); }}>Edit</button>
                    {!o.clerk_id && (
                      <button className="btn btn-ghost btn-sm" disabled={resendingId===o.id} onClick={async () => {
                        setResendingId(o.id);
                        try {
                          const r = await api.invite.resend(o.id);
                          setSuccessMsg(r.message || `Invite resent to ${o.email}`);
                          setTimeout(() => setSuccessMsg(null), 8000);
                        } catch(err) {
                          alert('Could not resend: ' + err.message);
                        } finally {
                          setResendingId(null);
                        }
                      }}>{resendingId===o.id ? '...' : 'Resend'}</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => {
                      if (!window.confirm(`Delete ${o.first_name} ${o.last_name}? This cannot be undone.`)) return;
                      try { await api.users.delete(o.id); load(); }
                      catch(e) { alert('Could not delete: ' + e.message); }
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <UserFormModal
          user={editUser}
          onClose={() => setShowForm(false)}
          onSaved={(msg) => { setShowForm(false); load(); if (msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 5000); } }}
        />
      )}
      {siteAssignOfficer && (
        <SiteAssignModal
          officer={siteAssignOfficer}
          onClose={() => setSiteAssignOfficer(null)}
        />
      )}
    </div>
  );
}

function UserFormModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    phone:      user?.phone      || '',
    role:            user?.role       || 'OFFICER',
    sia_licence_number: user?.sia_licence_number || '',
    sia_licence_type:   user?.sia_licence_type  || '',
    sia_expiry_date:    user?.sia_expiry_date ? user.sia_expiry_date.split('T')[0] : '',
    is_route_planner:  user?.is_route_planner || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.first_name.trim() || !form.email.trim()) { setError('Name and email are required'); return; }
    try {
      setSaving(true);
      const payload = {
        first_name: form.first_name,
        last_name:  form.last_name,
        email:      form.email.toLowerCase().trim(),
        phone:      form.phone || null,
        role:       form.role,
        sia_licence_number: form.sia_licence_number || null,
        sia_licence_type:   form.sia_licence_type   || null,
        sia_expiry_date:    form.sia_expiry_date || null,
      };
      if (user) {
        await api.users.update(user.id, payload);
        onSaved();
      } else {
        const res = await api.invite.send(payload);
        onSaved(res.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const f = (k, v) => setForm(p => ({...p, [k]: v}));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{user ? 'Edit Team Member' : 'Invite Team Member'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">First Name</label>
            <input className="input" value={form.first_name} onChange={e=>f('first_name',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Last Name</label>
            <input className="input" value={form.last_name} onChange={e=>f('last_name',e.target.value)} />
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e=>f('email',e.target.value)} disabled={!!user} />
            {!user && <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginTop:'0.25rem'}}>An invitation email will be sent to this address</div>}
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e=>f('phone',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e=>f('role',e.target.value)}>
              <option value="OFFICER">Officer</option>
              <option value="OPS_MANAGER">Ops Manager</option>
              <option value="FD">Field Director</option>
              <option value="COMPANY">Admin</option>
            </select>
          </div>
          <div className="field">
            <label className="label">SIA Licence No.</label>
            <input className="input" value={form.sia_licence_number} onChange={e=>f('sia_licence_number',e.target.value)} placeholder="16-digit number" />
          </div>
          <div className="field">
            <label className="label">SIA Licence Type</label>
            <select className="input" value={form.sia_licence_type||''} onChange={e=>f('sia_licence_type',e.target.value)}>
              <option value="">Select...</option>
              <option value="DS">Door Supervisor (DS)</option>
              <option value="SG">Security Guard (SG)</option>
              <option value="CCTV">CCTV Operator</option>
              <option value="CV">Close Protection (CV)</option>
              <option value="CG">Cash &amp; Valuables (CG)</option>
              <option value="KH">Key Holding (KH)</option>
              <option value="VR">Vehicle Immobiliser (VR)</option>
            </select>
          </div>
          <div className="field">
            <label className="label">SIA Expiry</label>
            <input type="date" className="input" value={form.sia_expiry_date} onChange={e=>f('sia_expiry_date',e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer'}}>
            <input type="checkbox" checked={form.is_route_planner||false} onChange={e=>setForm(f=>({...f,is_route_planner:e.target.checked}))} style={{width:'1rem',height:'1rem',accentColor:'var(--blue)'}} />
            <span className="label" style={{margin:0}}>Route Planner — can create &amp; edit patrol routes</span>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? (user ? 'Saving...' : 'Sending invite...') : (user ? 'Save' : 'Send Invite')}</button>
        </div>
      </div>
    </div>
  );
}


function Reporting({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    async function load() {
      try {
        const from = new Date();
        from.setDate(from.getDate() - parseInt(dateRange));
        const res = await api.logs.list({ from: from.toISOString(), limit: 500 });
        setLogs(res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [dateRange]);

  const byType = logs.reduce((acc, l) => { acc[l.log_type] = (acc[l.log_type]||0)+1; return acc; }, {});
  const bySite = logs.reduce((acc, l) => { const n = l.site?.name||'Unknown'; acc[n]=(acc[n]||0)+1; return acc; }, {});
  const topTypes = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  const topSites = Object.entries(bySite).sort((a,b)=>b[1]-a[1]);
  const maxCount = Math.max(...Object.values(byType), 1);

  const typeColors = {
    PATROL:'#1a52a8', INCIDENT:'#dc2626', ALARM:'#d97706',
    ACCESS:'#7c3aed', VISITOR:'#0891b2', HANDOVER:'#15803d',
    MAINTENANCE:'#ea580c', VEHICLE:'#64748b', GENERAL:'#94a3b8',
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Reports</div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={logs.length === 0}
            onClick={async () => {
              const token = await window.Clerk?.session?.getToken();
              if (!token) return;
              const from = new Date();
              from.setDate(from.getDate() - parseInt(dateRange));
              const url = import.meta.env.VITE_API_URL + '/api/logs/export?from=' + from.toISOString();
              const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
              const blob = await res.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'doblive-logs.csv';
              a.click();
            }}
          >
            Export CSV
          </button>
          <select className="input" style={{width:'140px'}} value={dateRange} onChange={e => setDateRange(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>
      <div className="page-content">
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <>
            <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
              <div className="stat-card"><div className="stat-value">{logs.length}</div><div className="stat-label">Total Logs</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'var(--danger)'}}>{byType.INCIDENT||0}</div><div className="stat-label">Incidents</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#d97706'}}>{byType.ALARM||0}</div><div className="stat-label">Alarms</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'var(--blue)'}}>{byType.PATROL||0}</div><div className="stat-label">Patrols</div></div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
              <div className="card">
                <div className="section-title" style={{marginBottom:'1rem'}}>Logs by Type</div>
                {topTypes.length === 0 ? <div className="empty-state"><p>No data</p></div> : (
                  <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
                    {topTypes.map(([type, count]) => (
                      <div key={type} style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                        <span style={{fontSize:'0.75rem',fontWeight:500,color:'var(--text-2)',width:'5rem',textAlign:'right',flexShrink:0}}>
                          {type.charAt(0)+type.slice(1).toLowerCase()}
                        </span>
                        <div style={{flex:1,background:'var(--surface-2)',borderRadius:'2px',height:'8px',overflow:'hidden'}}>
                          <div style={{width:((count/maxCount)*100)+'%',height:'100%',background:typeColors[type]||'#94a3b8',borderRadius:'2px'}} />
                        </div>
                        <span style={{fontSize:'0.75rem',fontWeight:600,width:'1.5rem',textAlign:'right'}}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="section-title" style={{marginBottom:'1rem'}}>Logs by Site</div>
                {topSites.length === 0 ? <div className="empty-state"><p>No data</p></div> : (
                  <table className="table">
                    <tbody>
                      {topSites.map(([site, count]) => (
                        <tr key={site}>
                          <td style={{padding:'0.5rem 0'}}>{site}</td>
                          <td style={{padding:'0.5rem 0',textAlign:'right',fontWeight:600}}>{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function OnDutyScreen({ user }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await api.shifts.list({ status: 'ACTIVE', limit: 100 });
      setShifts(res.data || []);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function forceEnd(shift) {
    if (!window.confirm(`Force end shift for ${shift.officer?.first_name} ${shift.officer?.last_name}?`)) return;
    await api.shifts.update(shift.id, { status: 'COMPLETED', checked_out_at: new Date().toISOString() });
    load();
  }

  const onDuration = s => {
    const start = new Date(s.checked_in_at || s.start_time);
    const mins = Math.floor((new Date() - start) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Officers On Duty</div>
        <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>
      <div className="page-content">
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner"/></div>
        ) : shifts.length === 0 ? (
          <div className="empty-state">
            <div style={{fontSize:'2rem',marginBottom:'0.75rem'}}>💤</div>
            <p>No officers currently on duty</p>
          </div>
        ) : (
          <>
            <div style={{marginBottom:'1rem',fontSize:'0.875rem',color:'var(--text-2)'}}>
              <span style={{color:'var(--success)',fontWeight:700}}>{shifts.length}</span> officer{shifts.length!==1?'s':''} on duty
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              {shifts.map(s => (
                <div key={s.id} className="card" style={{borderLeft:'3px solid var(--success)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
                    <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--blue)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.9375rem',flexShrink:0}}>
                      {s.officer?.first_name?.[0]}{s.officer?.last_name?.[0]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:'0.9375rem'}}>
                        {s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unknown'}
                      </div>
                      <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>
                        {s.site?.name || '—'}
                      </div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.125rem'}}>
                        On since {new Date(s.checked_in_at||s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · {onDuration(s)}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'0.375rem',flexShrink:0}}>
                      <span className="badge badge-success">ON DUTY</span>
                      <button
                        onClick={() => forceEnd(s)}
                        style={{padding:'0.375rem 0.75rem',background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',borderRadius:'6px',color:'var(--danger)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}
                      >
                        Force End
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SiteCodesTab({ siteId }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCode, setEditCode] = useState(null);
  const [form, setForm] = useState({ label: '', code: '', code_type: 'keypad', notes: '' });
  const [saving, setSaving] = useState(false);
  const [visibleCodes, setVisibleCodes] = useState(new Set());

  async function load() {
    try {
      const res = await api.sites.codes.list(siteId);
      setCodes(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [siteId]);

  function openForm(c) {
    if (c) {
      setEditCode(c);
      setForm({ label: c.label, code: c.code, code_type: c.code_type, notes: c.notes || '' });
    } else {
      setEditCode(null);
      setForm({ label: '', code: '', code_type: 'keypad', notes: '' });
    }
    setShowForm(true);
  }

  async function save() {
    if (!form.label.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      if (editCode) {
        await api.sites.codes.update(siteId, editCode.id, form);
      } else {
        await api.sites.codes.create(siteId, form);
      }
      setShowForm(false);
      load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function remove(codeId) {
    if (!window.confirm('Delete this code?')) return;
    await api.sites.codes.delete(siteId, codeId);
    load();
  }

  function toggleVisible(id) {
    setVisibleCodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const codeTypeLabels = { keypad: 'Keypad', padlock: 'Padlock', key_safe: 'Key Safe', door: 'Door Code', gate: 'Gate', alarm: 'Alarm', other: 'Other' };

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>;

  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
        <div className="section-title">Site Codes</div>
        <button className="btn btn-primary btn-sm" onClick={() => openForm(null)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Code
        </button>
      </div>
      {codes.length === 0 ? (
        <div className="empty-state"><p>No codes stored for this site. Add keypad, padlock, key safe or door codes.</p></div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Label</th><th>Type</th><th>Code</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {codes.map(c => (
              <tr key={c.id}>
                <td style={{fontWeight:500}}>{c.label}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{codeTypeLabels[c.code_type] || c.code_type}</td>
                <td style={{fontFamily:'monospace',fontSize:'0.875rem'}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:'0.5rem'}}>
                    {visibleCodes.has(c.id) ? c.code : '••••••'}
                    <button onClick={() => toggleVisible(c.id)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'0.8125rem',padding:0}}>
                      {visibleCodes.has(c.id) ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{c.notes || '—'}</td>
                <td style={{textAlign:'right',display:'flex',gap:'0.375rem',justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openForm(c)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => remove(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editCode ? 'Edit Code' : 'Add Code'}</div>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
              <div className="field">
                <label className="label">Label *</label>
                <input className="input" value={form.label} onChange={e => setForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Main entrance keypad" />
              </div>
              <div className="field">
                <label className="label">Type</label>
                <select className="input" value={form.code_type} onChange={e => setForm(f=>({...f,code_type:e.target.value}))}>
                  {Object.entries(codeTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Code *</label>
                <input className="input" value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} placeholder="e.g. 1234#" />
              </div>
              <div className="field">
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.label.trim() || !form.code.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value, span }) {
  return (
    <div style={span ? {gridColumn:'1/-1'} : {}}>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',fontWeight:500,marginBottom:'0.25rem'}}>{label}</div>
      <div style={{fontSize:'0.875rem',color:value ? 'var(--text)' : 'var(--text-3)'}}>{value || 'Not set'}</div>
    </div>
  );
}

export { OnDutyScreen };

export { ManagerDashboard };
export { SiteManagement };
export { LogReview };
export { TaskAssignment };
export { SiteDetail };
export { TeamManagement };
export { Reporting };
