import React, { useState, useEffect, useRef } from 'react';
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
  const [data, setData] = useState({ shifts:[], incidents:[], recentLogs:[], pendingTasks:0, totalOfficers:0, logsToday:0 });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshPulse, setRefreshPulse] = useState(false);
  const [forceEndId, setForceEndId] = useState(null);
  const [incidentAlerts, setIncidentAlerts] = useState([]);
  const [dashPanel, setDashPanel] = useState(null);
  const [tasksDueList, setTasksDueList] = useState([]);
  const [tasksDoneList, setTasksDoneList] = useState([]);
  const seenIncidentIds = React.useRef(new Set());

  async function load() {
    try {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const [shiftsRes, recentLogsRes, todayLogsRes, tasksRes, usersRes] = await Promise.all([
        api.shifts.list({ status: 'ACTIVE', limit: 50 }),
        api.logs.list({ limit: 8 }),
        api.logs.list({ limit: 500, from: todayStart.toISOString() }),
        api.tasks.list({ status: 'PENDING' }),
        api.users.list({ role: 'OFFICER' }),
      ]);
      const todayLogs = todayLogsRes.data || [];
      const incidents = todayLogs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type));
      const doneList = todayLogs.filter(l => l.type_data?.scheduled_task_id);
      const tasksDone = doneList.length;
      setTasksDueList(tasksRes.data || []);
      setTasksDoneList(doneList);
      setData({
        shifts: shiftsRes.data || [],
        incidents,
        recentLogs: recentLogsRes.data || [],
        pendingTasks: tasksRes.data?.length || 0,
        totalOfficers: usersRes.data?.length || 0,
        logsToday: todayLogs.length,
        tasksDone,
      });
      setLastRefresh(new Date());
      setRefreshPulse(true);
      setTimeout(() => setRefreshPulse(false), 1500);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // Incident polling — every 10 seconds
  async function pollIncidents() {
    try {
      const tenMinsAgo = new Date(Date.now() - 600000).toISOString();
      const res = await api.logs.list({ from: tenMinsAgo, limit: 50 });
      const newIncidents = (res.data || []).filter(l =>
        ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type) && !seenIncidentIds.current.has(l.id)
      );
      newIncidents.forEach(l => seenIncidentIds.current.add(l.id));
      if (newIncidents.length > 0) {
        const newAlerts = newIncidents.map(l => ({
          id: l.id,
          msg: `${l.site?.name || 'Unknown site'} — ${new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`,
          title: l.title || l.log_type,
          ts: Date.now(),
        }));
        setIncidentAlerts(prev => [...newAlerts, ...prev]);
        // Auto-dismiss after 30 seconds
        setTimeout(() => {
          const cutoff = Date.now() - 30000;
          setIncidentAlerts(prev => prev.filter(a => a.ts > cutoff || !newAlerts.find(n => n.id === a.id)));
        }, 30000);
      }
    } catch {}
  }

  // Seed seen IDs from initial load
  React.useEffect(() => {
    if (data.incidents.length > 0) {
      data.incidents.forEach(l => seenIncidentIds.current.add(l.id));
    }
  }, [data.incidents]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    const ip = setInterval(pollIncidents, 10000);
    return () => { clearInterval(t); clearInterval(ip); };
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
          {lastRefresh && (
            <span style={{display:'inline-flex',alignItems:'center',gap:'0.375rem',fontSize:'0.75rem',color:'var(--text-3)'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:refreshPulse?'#4ade80':'var(--text-3)',transition:'background 0.3s',boxShadow:refreshPulse?'0 0 6px #4ade80':'none'}} />
              Updated {lastRefresh.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
            </span>
          )}
          <button onClick={load} className="btn btn-secondary btn-sm">Refresh</button>
        </div>
      </div>
      <div className="page-content">

        {/* Real-time incident alerts */}
        {incidentAlerts.length > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'1rem'}}>
            {incidentAlerts.map(a => (
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',background:'rgba(220,38,38,0.12)',border:'2px solid rgba(220,38,38,0.4)',borderRadius:'8px',animation:'pulse 2s infinite'}}>
                <span style={{fontSize:'1.125rem'}}>⚠</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'0.875rem',fontWeight:700,color:'#ef4444'}}>New incident logged</div>
                  <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{a.title} — {a.msg}</div>
                </div>
                <button onClick={() => setIncidentAlerts(prev => prev.filter(x => x.id !== a.id))}
                  style={{background:'none',border:'none',color:'rgba(220,38,38,0.5)',fontSize:'1.125rem',cursor:'pointer',padding:0}}>×</button>
              </div>
            ))}
          </div>
        )}

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
                      {forceEndId === s.id ? (
                        <>
                          <button onClick={async()=>{await api.shifts.update(s.id,{status:'COMPLETED',checked_out_at:new Date().toISOString()});setForceEndId(null);load();}} className="btn btn-sm" style={{background:'var(--danger)',color:'#fff',border:'none'}}>Confirm</button>
                          <button onClick={()=>setForceEndId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                        </>
                      ) : (
                        <button onClick={()=>setForceEndId(s.id)} className="btn btn-sm" style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',color:'var(--danger)'}}>End</button>
                      )}
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
          <Link to="/on-duty" className="stat-card" style={{cursor:'pointer',textDecoration:'none'}}><div className="stat-value">{data.shifts.length}</div><div className="stat-label">On Duty</div></Link>
          <div className="stat-card" style={{cursor:'pointer'}} onClick={() => setDashPanel(dashPanel === 'incidents' ? null : 'incidents')}><div className="stat-value" style={{color:data.incidents.length>0?'var(--danger)':'var(--text)'}}>{data.incidents.length}</div><div className="stat-label">Incidents Today</div></div>
          <div className="stat-card"><div className="stat-value">{data.logsToday||0}</div><div className="stat-label">Logs Today</div></div>
          <div className="stat-card" style={{cursor:'pointer'}} onClick={() => setDashPanel(dashPanel === 'tasksDue' ? null : 'tasksDue')}><div className="stat-value" style={{color:data.pendingTasks>0?'var(--warning)':'var(--text)'}}>{data.pendingTasks}</div><div className="stat-label">Tasks Due</div></div>
          <div className="stat-card" style={{cursor:'pointer'}} onClick={() => setDashPanel(dashPanel === 'tasksDone' ? null : 'tasksDone')}><div className="stat-value" style={{color:data.tasksDone>0?'#10b981':'var(--text)'}}>{data.tasksDone||0}</div><div className="stat-label">Tasks Done</div></div>
          <div className="stat-card"><div className="stat-value">{data.totalOfficers}</div><div className="stat-label">Officers</div></div>
        </div>

        {/* Expandable panels */}
        {dashPanel === 'incidents' && (
          <div className="card" style={{marginBottom:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <div className="section-title">Incidents Today</div>
              <button onClick={() => setDashPanel(null)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'1rem'}}>×</button>
            </div>
            {data.incidents.length === 0 ? <div style={{color:'var(--text-3)',fontSize:'0.875rem'}}>No incidents today</div> : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {data.incidents.map(l => (
                  <div key={l.id} style={{padding:'0.625rem 0.75rem',background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.15)',borderRadius:'8px'}}>
                    <div style={{fontWeight:600,fontSize:'0.875rem',color:'#ef4444'}}>{l.title || l.log_type}</div>
                    <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'2px'}}>{l.description?.slice(0,100)}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'4px'}}>{l.site?.name} · {l.officer?.first_name} {l.officer?.last_name} · {new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dashPanel === 'tasksDue' && (
          <div className="card" style={{marginBottom:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <div className="section-title">Tasks Due</div>
              <button onClick={() => setDashPanel(null)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'1rem'}}>×</button>
            </div>
            {tasksDueList.length === 0 ? <div style={{color:'var(--text-3)',fontSize:'0.875rem'}}>No tasks due</div> : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {tasksDueList.map(t => (
                  <div key={t.id} style={{padding:'0.625rem 0.75rem',background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.15)',borderRadius:'8px'}}>
                    <div style={{fontWeight:600,fontSize:'0.875rem'}}>{t.title}</div>
                    {t.description && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'2px'}}>{t.description?.slice(0,100)}</div>}
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'4px'}}>{t.site?.name} · {t.assigned_to_name || 'Unassigned'} · Due {t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dashPanel === 'tasksDone' && (
          <div className="card" style={{marginBottom:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <div className="section-title">Tasks Completed Today</div>
              <button onClick={() => setDashPanel(null)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'1rem'}}>×</button>
            </div>
            {tasksDoneList.length === 0 ? <div style={{color:'var(--text-3)',fontSize:'0.875rem'}}>No tasks completed today</div> : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {tasksDoneList.map(l => (
                  <div key={l.id} style={{padding:'0.625rem 0.75rem',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.15)',borderRadius:'8px'}}>
                    <div style={{fontWeight:600,fontSize:'0.875rem',color:'#10b981'}}>{l.title}</div>
                    {l.description && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'2px'}}>{l.description?.slice(0,100)}</div>}
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'4px'}}>{l.site?.name} · {l.officer?.first_name} {l.officer?.last_name} · {new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
  const [selectedLog, setSelectedLog] = useState(null);

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
    if (l.type_data?.checkpoint) return false;
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
                <tr key={log.id} onClick={() => setSelectedLog(log)} style={{cursor:'pointer'}}>
                  <td style={{color:'var(--text-2)',whiteSpace:'nowrap',fontSize:'0.8125rem'}}>
                    {new Date(log.occurred_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'2-digit'})}
                    {' '}
                    {new Date(log.occurred_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}
                  </td>
                  <td><span className={`badge ${typeColors[log.log_type] || 'badge-neutral'}`}>{log.log_type}</span></td>
                  <td style={{fontWeight:500,maxWidth:'240px'}}>
                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.title || '—'}</div>
                    {log.description && <div style={{fontSize:'0.75rem',color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.description}</div>}
                    {(log.type_data?.media?.length > 0) && <div style={{fontSize:'0.7rem',color:'var(--blue)'}}>{log.type_data.media.length} photo{log.type_data.media.length>1?'s':''} attached</div>}
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
    {selectedLog && (
      selectedLog.log_type === 'PATROL' && selectedLog.type_data?.patrol_session_id
        ? <PatrolDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
        : <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    )}
    </div>
  );
}


function ManagerLogCard({ log }) {
  const [showPatrolDetail, setShowPatrolDetail] = useState(false);
  const [showLogDetail, setShowLogDetail] = useState(false);

  const typeMap = {
    PATROL:'PAT',INCIDENT:'INC',ALARM:'ALM',ACCESS:'ACC',VISITOR:'VIS',
    HANDOVER:'HND',MAINTENANCE:'MNT',VEHICLE:'VEH',KEYHOLDING:'KEY',GENERAL:'GEN',
  };
  const code = typeMap[log.log_type] || (log.log_type?.slice(0,3) || 'LOG');
  const typeColors = { INCIDENT:'badge-danger', ALARM:'badge-warning', PATROL:'badge-blue', GENERAL:'badge-neutral' };

  const isPatrolLog = log.log_type === 'PATROL' && log.type_data?.patrol_session_id;
  const media = log.type_data?.media || [];

  return (
    <>
    <div onClick={() => isPatrolLog ? setShowPatrolDetail(true) : setShowLogDetail(true)}
      style={{padding:'0.75rem',border:'1px solid var(--border)',borderRadius:'var(--radius)',marginBottom:'0.5rem',cursor:'pointer'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem'}}>
        <div style={{width:'2.25rem',height:'2.25rem',background:'var(--navy)',color:'#fff',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.5625rem',fontWeight:700,letterSpacing:'0.03em',flexShrink:0}}>{code}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.25rem'}}>
            <span style={{fontWeight:600,fontSize:'0.875rem'}}>{log.title || 'Log Entry'}</span>
            <span className={`badge ${typeColors[log.log_type]||'badge-neutral'}`}>{log.log_type}</span>
            <span style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{log.occurred_at ? new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) : ''}</span>
          </div>
          <div style={{display:'flex',gap:'1rem',fontSize:'0.8125rem',color:'var(--text-2)',marginBottom:log.description?'0.375rem':0}}>
            {log.site && <span>{log.site.name}</span>}
            {log.officer && <span>{log.officer.first_name} {log.officer.last_name}</span>}
          </div>
          {log.description && (
            <p style={{fontSize:'0.875rem',color:'var(--text-2)',lineHeight:1.5,margin:'0 0 0.25rem'}}>
              {log.description.length > 120 ? log.description.substring(0,120)+'...' : log.description}
            </p>
          )}
          {media.length > 0 && (
            <div style={{fontSize:'0.75rem',color:'var(--blue)',marginTop:'0.25rem'}}>{media.length} photo{media.length>1?'s':''} attached · Click to view →</div>
          )}
          {isPatrolLog && log.type_data.duration_minutes != null && (
            <div style={{fontSize:'0.75rem',color:'var(--blue)',marginTop:'0.25rem'}}>
              {log.type_data.duration_minutes >= 60 ? `${Math.floor(log.type_data.duration_minutes/60)}h ${log.type_data.duration_minutes%60}m` : `${log.type_data.duration_minutes}m`}
              {' · '}{log.type_data.checkpoints_completed?.length || 0} checkpoints · Click for detail →
            </div>
          )}
          {!isPatrolLog && <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.25rem'}}>Click to view full details →</div>}
        </div>
      </div>
    </div>
    {showPatrolDetail && <PatrolDetailModal log={log} onClose={() => setShowPatrolDetail(false)} />}
    {showLogDetail && <LogDetailModal log={log} onClose={() => setShowLogDetail(false)} />}
    </>
  );
}

// ── Log Detail Modal (non-patrol logs) ───────────────────────────────────────
function LogDetailModal({ log, onClose }) {
  const typeColors = { INCIDENT:'badge-danger', ALARM:'badge-warning', PATROL:'badge-blue', GENERAL:'badge-neutral' };
  const td = log.type_data || {};
  const media = td.media || [];
  const [lightbox, setLightbox] = useState(null);

  const fmtDateTime = t => t ? new Date(t).toLocaleString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' }) : '—';

  // Collect any extra type_data fields worth showing
  const skipKeys = ['media','patrol_session_id','checkpoint','photo_url'];
  const extraFields = Object.entries(td).filter(([k]) => !skipKeys.includes(k) && td[k] != null && td[k] !== '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'600px',maxHeight:'90vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
            <div className="modal-title">{log.title || 'Log Entry'}</div>
            <span className={`badge ${typeColors[log.log_type]||'badge-neutral'}`}>{log.log_type}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Meta */}
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem',padding:'0.75rem',background:'var(--surface-2)',borderRadius:'6px'}}>
          <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Officer</div><div style={{fontWeight:600,fontSize:'0.875rem'}}>{log.officer ? `${log.officer.first_name} ${log.officer.last_name}` : '—'}</div></div>
          <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Site</div><div style={{fontWeight:600,fontSize:'0.875rem'}}>{log.site?.name || '—'}</div></div>
          <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Date &amp; Time</div><div style={{fontSize:'0.875rem'}}>{fmtDateTime(log.occurred_at)}</div></div>
          {log.client_reportable && <div style={{alignSelf:'center'}}><span className="badge badge-blue">Client Reportable</span></div>}
        </div>

        {/* Description */}
        {log.description && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.375rem'}}>Description</div>
            <p style={{fontSize:'0.875rem',lineHeight:1.6,color:'var(--text-1)',whiteSpace:'pre-wrap',margin:0}}>{log.description}</p>
          </div>
        )}

        {/* Actions taken */}
        {td.actions_taken && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.375rem'}}>Actions Taken</div>
            <p style={{fontSize:'0.875rem',lineHeight:1.6,color:'var(--text-1)',whiteSpace:'pre-wrap',margin:0}}>{td.actions_taken}</p>
          </div>
        )}

        {/* Photos */}
        {media.length > 0 && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Photos / Video ({media.length})</div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              {media.map((m, i) => (
                <div key={i} onClick={() => m.type?.startsWith('image') && setLightbox(m.url)}
                  style={{width:80,height:80,borderRadius:'8px',overflow:'hidden',border:'1px solid var(--border)',cursor:m.type?.startsWith('image')?'zoom-in':'default',flexShrink:0}}>
                  {m.type?.startsWith('image')
                    ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt={m.name||'photo'} />
                    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--surface-2)',fontSize:'0.75rem',color:'var(--text-3)'}}>video</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extra type_data fields */}
        {extraFields.length > 0 && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Additional Details</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
              {extraFields.map(([k, v]) => (
                <div key={k} style={{display:'flex',gap:'0.5rem',fontSize:'0.8125rem'}}>
                  <span style={{color:'var(--text-3)',minWidth:'140px',textTransform:'capitalize'}}>{k.replace(/_/g,' ')}</span>
                  <span style={{color:'var(--text-1)',fontWeight:500}}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <img src={lightbox} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:'8px',objectFit:'contain'}} />
          <button onClick={() => setLightbox(null)} style={{position:'absolute',top:'1rem',right:'1rem',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',width:36,height:36,borderRadius:'50%',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
      )}
    </div>
  );
}

// ── Patrol Detail Modal ──────────────────────────────────────────────────────
function PatrolDetailModal({ log, onClose }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!log.type_data?.patrol_session_id) { setLoading(false); return; }
    api.patrols.getSession(log.type_data.patrol_session_id)
      .then(res => { if (res?.data) setSession(res.data); else setSessionError('Session data not found'); })
      .catch(err => setSessionError(err.message || 'Failed to load patrol session'))
      .finally(() => setLoading(false));
  }, []);

  // Render map when session loads
  useEffect(() => {
    if (!session || !mapRef.current || mapInstance.current) return;
    function renderMap() {
      if (!window.L || !mapRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      const allPoints = [];

      // GPS trail
      if (session.gps_trail?.length) {
        const trail = session.gps_trail.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
        if (trail.length > 0) {
          L.polyline(trail, { color: '#3b82f6', weight: 3, opacity: 0.8 }).addTo(map);
          // Start marker (green)
          L.circleMarker(trail[0], { radius: 8, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map).bindPopup('Start');
          // End marker (red)
          L.circleMarker(trail[trail.length - 1], { radius: 8, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map).bindPopup('End');
          allPoints.push(...trail);
        }
      }

      // Checkpoint markers
      if (session.checkpoints_completed?.length) {
        session.checkpoints_completed.forEach((cp, i) => {
          if (!cp.lat || !cp.lng) return;
          const icon = L.divIcon({ html: `<div style="width:22px;height:22px;background:#a78bfa;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0b1222">${i+1}</div>`, iconSize:[22,22], iconAnchor:[11,11] });
          L.marker([cp.lat, cp.lng], { icon }).addTo(map).bindPopup(cp.name || `Checkpoint ${i+1}`);
          allPoints.push([cp.lat, cp.lng]);
        });
      }

      if (allPoints.length > 0) map.fitBounds(allPoints, { padding: [30, 30] });
      else map.setView([52.48, -1.89], 14);
      mapInstance.current = map;
    }

    if (window.L) { renderMap(); }
    else {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
      }
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script'); script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = renderMap; document.head.appendChild(script);
      } else { setTimeout(renderMap, 200); }
    }
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [session]);

  // Calculate distance from GPS trail
  function calcDistance(trail) {
    if (!trail?.length || trail.length < 2) return null;
    let total = 0;
    for (let i = 1; i < trail.length; i++) {
      const R = 6371000;
      const dLat = (trail[i].lat - trail[i-1].lat) * Math.PI / 180;
      const dLng = (trail[i].lng - trail[i-1].lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(trail[i-1].lat*Math.PI/180) * Math.cos(trail[i].lat*Math.PI/180) * Math.sin(dLng/2)**2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return total;
  }

  const td = log.type_data || {};
  const duration = td.duration_minutes;
  const distMetres = session?.gps_trail ? calcDistance(session.gps_trail.filter(p => p.lat && p.lng)) : null;
  const checkpoints = session?.checkpoints_completed || td.checkpoints_completed || [];
  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' }) : '—';
  const fmtDate = t => t ? new Date(t).toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric', timeZone:'Europe/London' }) : '—';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'700px',maxHeight:'90vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Patrol Detail</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Header */}
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem'}}>
          <div>
            <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Officer</div>
            <div style={{fontWeight:600}}>{log.officer ? `${log.officer.first_name} ${log.officer.last_name}` : '—'}</div>
          </div>
          <div>
            <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Site</div>
            <div style={{fontWeight:600}}>{log.site?.name || '—'}</div>
          </div>
          <div>
            <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Date</div>
            <div>{fmtDate(td.started_at || log.occurred_at)}</div>
          </div>
          <div>
            <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Time</div>
            <div>{fmtTime(td.started_at || log.occurred_at)}{td.ended_at ? ` → ${fmtTime(td.ended_at)}` : ''}</div>
          </div>
          {duration != null && (
          <div>
            <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Duration</div>
            <div style={{fontWeight:600}}>{duration >= 60 ? `${Math.floor(duration/60)}h ${duration%60}m` : `${duration}m`}</div>
          </div>
          )}
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem'}}>
          <div style={{flex:1,padding:'0.625rem',background:'var(--surface-2)',borderRadius:'6px',textAlign:'center'}}>
            <div style={{fontSize:'1.25rem',fontWeight:700}}>{checkpoints.length}</div>
            <div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase'}}>Checkpoints</div>
          </div>
          {distMetres != null && (
            <div style={{flex:1,padding:'0.625rem',background:'var(--surface-2)',borderRadius:'6px',textAlign:'center'}}>
              <div style={{fontSize:'1.25rem',fontWeight:700}}>{distMetres >= 1000 ? `${(distMetres/1000).toFixed(1)}km` : `${Math.round(distMetres)}m`}</div>
              <div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase'}}>Distance</div>
            </div>
          )}
          {session?.gps_trail?.length > 0 && (
            <div style={{flex:1,padding:'0.625rem',background:'var(--surface-2)',borderRadius:'6px',textAlign:'center'}}>
              <div style={{fontSize:'1.25rem',fontWeight:700}}>{session.gps_trail.length}</div>
              <div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase'}}>GPS Points</div>
            </div>
          )}
        </div>

        {/* Map */}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>
        ) : sessionError ? (
          <div style={{padding:'1rem',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',color:'#ef4444',fontSize:'0.875rem',marginBottom:'1rem'}}>Could not load patrol map: {sessionError}</div>
        ) : !session ? (
          <div style={{padding:'1rem',background:'var(--surface-2)',borderRadius:'8px',color:'var(--text-3)',fontSize:'0.875rem',marginBottom:'1rem'}}>No session data found for this patrol.</div>
        ) : (
          <div ref={mapRef} style={{width:'100%',height:'350px',borderRadius:'8px',border:'1px solid var(--border)',marginBottom:'1rem'}} />
        )}

        {/* Checkpoints */}
        {checkpoints.length > 0 && (
          <div>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Checkpoints Completed</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
              {checkpoints.map((cp, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.5rem 0.625rem',background:'var(--surface-2)',borderRadius:'6px'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#a78bfa',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#0b1222',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'0.8125rem',fontWeight:500}}>{typeof cp === 'object' ? cp.name || `Checkpoint ${i+1}` : cp}</div>
                  </div>
                  {typeof cp === 'object' && cp.timestamp && (
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)',flexShrink:0}}>{fmtTime(cp.timestamp)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Media from patrol reports/occurrences */}
        {(() => {
          const allMedia = [
            ...(td.media || []),
            ...(td.photo_url ? [{ url: td.photo_url, type: 'image/jpeg', name: 'checkpoint-photo' }] : []),
            ...(session?.checkpoints_completed || []).flatMap(cp => [
              ...(cp.media || []),
              ...(cp.photo_url ? [{ url: cp.photo_url, type: 'image/jpeg', name: cp.name || 'checkpoint-photo' }] : []),
            ]),
          ];
          if (!allMedia.length) return null;
          return (
            <div style={{marginTop:'1rem'}}>
              <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Photos / Video ({allMedia.length})</div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {allMedia.map((m, i) => (
                  <div key={i} style={{width:80,height:80,borderRadius:'8px',overflow:'hidden',border:'1px solid var(--border)',flexShrink:0,cursor:'pointer'}}
                    onClick={() => window.open(m.url, '_blank')}>
                    {m.type?.startsWith('image')
                      ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt={m.name||'photo'} />
                      : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--surface-2)',fontSize:'0.75rem',color:'var(--text-3)'}}>video</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
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
    COMPLETE: tasks.filter(t => t.status === 'COMPLETED').length,
  };

  const [editTask, setEditTask] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  async function updateStatus(taskId, status) {
    await api.tasks.update(taskId, { status });
    load();
  }

  async function deleteTask(id) {
    try { await api.tasks.delete(id); setDeleteConfirmId(null); load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Assignments</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Assign Task
        </button>
      </div>
      <div className="page-content">
        <div className="tabs">
          {[['PENDING','Pending'],['IN_PROGRESS','In Progress'],['COMPLETED','Complete'],['ALL','All']].map(([val,label]) => (
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
              <tr><th>Task</th><th>Urgency</th><th>Assigned To</th><th>Site</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id}>
                  <td>
                    <div style={{fontWeight:500}}>{task.title}</div>
                    {task.description && <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{task.description}</div>}
                  </td>
                  <td><span className="badge" style={{background:task.urgency==='now'?'rgba(239,68,68,0.15)':task.urgency==='today'?'rgba(245,158,11,0.15)':'rgba(59,130,246,0.1)',color:task.urgency==='now'?'#ef4444':task.urgency==='today'?'#f59e0b':'#60a5fa',fontWeight:700,fontSize:'0.6875rem'}}>{task.urgency==='now'?'NOW':task.urgency==='today'?'TODAY':'ROUTINE'}</span></td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>
                    {task.assigned_to_user ? `${task.assigned_to_user.first_name} ${task.assigned_to_user.last_name}` : '—'}
                  </td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{task.site?.name || '—'}</td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${task.status==='COMPLETED'?'badge-success':task.status==='IN_PROGRESS'?'badge-blue':'badge-neutral'}`}>
                      {task.status || 'Pending'}
                    </span>
                  </td>
                  <td style={{textAlign:'right',display:'flex',gap:'0.375rem',justifyContent:'flex-end'}}>
                    {task.status !== 'COMPLETED' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(task.id, task.status === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS')}>
                        {task.status === 'IN_PROGRESS' ? 'Complete' : 'Start'}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditTask(task)}>Edit</button>
                    {deleteConfirmId === task.id ? (
                      <>
                        <button className="btn btn-sm" style={{background:'var(--danger)',color:'#fff',border:'none'}} onClick={() => deleteTask(task.id)}>Yes</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmId(null)}>No</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => setDeleteConfirmId(task.id)}>Delete</button>
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
      {editTask && (
        <TaskEditModal
          task={editTask}
          officers={officers}
          sites={sites}
          onClose={() => setEditTask(null)}
          onSaved={() => { setEditTask(null); load(); }}
        />
      )}
    </div>
  );
}


function TaskEditModal({ task, officers, sites, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: task.title || '', description: task.description || '',
    assigned_to: task.assigned_to || '', site_id: task.site_id || '',
    due_date: task.due_date ? task.due_date.split('T')[0] : '', urgency: task.urgency || 'normal',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      await api.tasks.update(task.id, {
        title: form.title, description: form.description || null,
        assigned_to: form.assigned_to || null, site_id: form.site_id || null,
        due_date: form.due_date || null, urgency: form.urgency || 'normal',
      });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Assignment</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} /></div>
        <div className="field"><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">Assign To</label><select className="input" value={form.assigned_to} onChange={e => setForm(f=>({...f,assigned_to:e.target.value}))}><option value="">Unassigned</option>{officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}</select></div>
          <div className="field"><label className="label">Site</label><select className="input" value={form.site_id} onChange={e => setForm(f=>({...f,site_id:e.target.value}))}><option value="">No site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div className="field">
          <label className="label">Urgency</label>
          <div style={{display:'flex',gap:'6px'}}>
            {[{k:'now',l:'NOW',c:'#ef4444',bg:'rgba(239,68,68,0.12)',b:'rgba(239,68,68,0.4)'},{k:'today',l:'TODAY',c:'#f59e0b',bg:'rgba(245,158,11,0.1)',b:'rgba(245,158,11,0.35)'},{k:'normal',l:'ROUTINE',c:'#60a5fa',bg:'rgba(59,130,246,0.1)',b:'rgba(59,130,246,0.3)'}].map(u => (
              <button key={u.k} type="button" onClick={() => setForm(f=>({...f,urgency:u.k}))}
                style={{flex:1,padding:'10px',background:form.urgency===u.k?u.bg:'transparent',border:`1.5px solid ${form.urgency===u.k?u.b:'var(--border)'}`,borderRadius:'8px',color:form.urgency===u.k?u.c:'var(--text-3)',fontSize:'0.8125rem',fontWeight:700,cursor:'pointer'}}>
                {u.l}
              </button>
            ))}
          </div>
        </div>
        <div className="field"><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function TaskCreateForm({ officers, sites, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', site_id: '', due_date: '', urgency: 'normal' });
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
        urgency: form.urgency || 'normal',
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
          <label className="label">Urgency</label>
          <div style={{display:'flex',gap:'6px'}}>
            {[{k:'now',l:'NOW',c:'#ef4444',bg:'rgba(239,68,68,0.12)',b:'rgba(239,68,68,0.4)'},{k:'today',l:'TODAY',c:'#f59e0b',bg:'rgba(245,158,11,0.1)',b:'rgba(245,158,11,0.35)'},{k:'normal',l:'ROUTINE',c:'#60a5fa',bg:'rgba(59,130,246,0.1)',b:'rgba(59,130,246,0.3)'}].map(u => (
              <button key={u.k} type="button" onClick={() => setForm(f=>({...f,urgency:u.k}))}
                style={{flex:1,padding:'10px',background:form.urgency===u.k?u.bg:'transparent',border:`1.5px solid ${form.urgency===u.k?u.b:'var(--border)'}`,borderRadius:'8px',color:form.urgency===u.k?u.c:'var(--text-3)',fontSize:'0.8125rem',fontWeight:700,cursor:'pointer'}}>
                {u.l}
              </button>
            ))}
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
        {[{key:'info',label:'Site Info'},{key:'logs',label:'Recent Logs'},{key:'roster',label:'Roster'},{key:'officers',label:'Officers'},{key:'visitors',label:'Visitors'},{key:'codes',label:'Codes'},{key:'playbook',label:'Virtual Supervisor'}].map(t => (
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
                    const now = new Date();
                    const exp1 = o.sia_expiry_date ? new Date(o.sia_expiry_date) : null;
                    const exp2 = o.sia_expiry_date_2 ? new Date(o.sia_expiry_date_2) : null;
                    const days1 = exp1 ? (exp1 - now) / 86400000 : null;
                    const days2 = exp2 ? (exp2 - now) / 86400000 : null;
                    const anyExpired = (days1 !== null && days1 < 0) || (days2 !== null && days2 < 0);
                    const anyExpiring = (days1 !== null && days1 >= 0 && days1 < 90) || (days2 !== null && days2 >= 0 && days2 < 90);
                    const siaColor = anyExpired ? '#ef4444' : anyExpiring ? '#f59e0b' : (days1 !== null || days2 !== null) ? '#22c55e' : 'var(--text-3)';
                    const siaLabel = anyExpired ? 'Expired' : anyExpiring ? 'Expiring' : (days1 !== null || days2 !== null) ? 'Valid' : '—';
                    return (
                      <tr key={o.id}>
                        <td style={{fontWeight:500}}>{o.first_name} {o.last_name}</td>
                        <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{o.sia_licence_number||'—'}</td>
                        <td style={{fontSize:'0.8125rem'}}>
                          {exp1 ? new Date(o.sia_expiry_date).toLocaleDateString('en-GB') : '—'}
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
        {activeTab === 'visitors' && <SiteVisitorsTab siteId={id} />}
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  async function load() {
    try {
      const res = await api.users.list();
      const sorted = (res.data || []).sort((a, b) =>
        (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || '')
      );
      setOfficers(sorted);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const roleLabels = { OFFICER:'Officer', OPS_MANAGER:'Ops Manager', FD:'Field Director', COMPANY:'Admin', SUPER_ADMIN:'Super Admin' };
  const roleBadge  = { OFFICER:'badge-neutral', OPS_MANAGER:'badge-blue', FD:'badge-navy', COMPANY:'badge-navy', SUPER_ADMIN:'badge-danger' };
  const isSiaExpired      = d => d && new Date(d) < new Date();
  const isSiaExpiringSoon = d => { if (!d) return false; const days=(new Date(d)-new Date())/86400000; return days>0&&days<90; };

  const filtered = officers.filter(o => {
    if (statusFilter === 'active' && o.active === false) return false;
    if (statusFilter === 'inactive' && o.active !== false) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.first_name || '').toLowerCase().includes(q) ||
             (o.last_name || '').toLowerCase().includes(q) ||
             (o.email || '').toLowerCase().includes(q) ||
             (o.sia_licence_number || '').toLowerCase().includes(q);
    }
    return true;
  });

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

        {/* Search + filter bar */}
        {!loading && (
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1rem',flexWrap:'wrap'}}>
            <input className="input" style={{width:'220px'}} placeholder="Search name, email, SIA..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px'}}>
              {[['all','All'],['active','Active'],['inactive','Inactive']].map(([k,l]) => (
                <button key={k} onClick={() => setStatusFilter(k)}
                  style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                    background: statusFilter===k ? 'var(--blue)' : 'transparent',
                    color: statusFilter===k ? '#fff' : 'var(--text-2)'}}>
                  {l}
                </button>
              ))}
            </div>
            <span style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>{filtered.length} officer{filtered.length!==1?'s':''}</span>
          </div>
        )}

        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>{search || statusFilter !== 'all' ? 'No officers match your search' : 'No team members yet'}</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Role</th><th>SIA Type</th><th>SIA No.</th><th>SIA Expiry</th><th>2nd SIA</th><th>BS7858</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td style={{fontWeight:500}}>{o.first_name} {o.last_name}<div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{o.email}</div></td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{o.phone||'—'}</td>
                  <td><span className={`badge ${roleBadge[o.role]||'badge-neutral'}`}>{roleLabels[o.role]||o.role}</span></td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{o.sia_licence_type||'—'}</td>
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
                  <td style={{fontSize:'0.75rem',color:'var(--text-2)'}}>
                    {o.sia_licence_type_2 ? <div>{o.sia_licence_type_2}<div style={{fontFamily:'monospace',fontSize:'0.6875rem'}}>{o.sia_licence_number_2||''}</div>{o.sia_expiry_date_2 && <div style={{color:isSiaExpired(o.sia_expiry_date_2)?'var(--danger)':isSiaExpiringSoon(o.sia_expiry_date_2)?'var(--warning)':'var(--text-3)'}}>{new Date(o.sia_expiry_date_2).toLocaleDateString('en-GB')}</div>}</div> : '—'}
                  </td>
                  <td style={{fontSize:'0.75rem',color:'var(--text-2)'}}>
                    {o.bs7858_expiry_date ? <span style={{color:isSiaExpired(o.bs7858_expiry_date)?'var(--danger)':isSiaExpiringSoon(o.bs7858_expiry_date)?'var(--warning)':'var(--text-2)'}}>{new Date(o.bs7858_expiry_date).toLocaleDateString('en-GB')}</span> : '—'}
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
  const SIA_TYPES = ['Security Guarding','Door Supervisor','CCTV Operator','Close Protection','Vehicle Immobiliser','Key Holding'];
  const [officerRates, setOfficerRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [allSites, setAllSites] = useState([]);
  const [showAddRate, setShowAddRate] = useState(false);
  const [editRateId, setEditRateId] = useState(null);
  const [rateForm, setRateForm] = useState({ site_id: '', hourly_rate: '', role_label: '' });

  useEffect(() => {
    if (!user) return;
    setRatesLoading(true);
    Promise.all([
      api.rates.list({ officer_id: user.id }),
      api.sites.list(),
    ]).then(([ratesRes, sitesRes]) => {
      setOfficerRates(ratesRes.data || []);
      setAllSites(sitesRes.data || []);
    }).catch(() => {}).finally(() => setRatesLoading(false));
  }, [user?.id]);

  async function saveRate() {
    if (!rateForm.hourly_rate) return;
    try {
      if (editRateId) {
        await api.rates.update(editRateId, { hourly_rate: parseFloat(rateForm.hourly_rate), site_id: rateForm.site_id || null, role_label: rateForm.role_label || null });
      } else {
        await api.rates.create({ officer_id: user.id, site_id: rateForm.site_id || null, hourly_rate: parseFloat(rateForm.hourly_rate), role_label: rateForm.role_label || null });
      }
      const res = await api.rates.list({ officer_id: user.id });
      setOfficerRates(res.data || []);
      setShowAddRate(false); setEditRateId(null); setRateForm({ site_id: '', hourly_rate: '', role_label: '' });
    } catch (err) { alert(err.message); }
  }

  async function deleteRate(id) {
    try {
      await api.rates.delete(id);
      setOfficerRates(prev => prev.filter(r => r.id !== id));
    } catch (err) { alert(err.message); }
  }

  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    phone:      user?.phone      || '',
    role:            user?.role       || 'OFFICER',
    sia_licence_number: user?.sia_licence_number || '',
    sia_licence_type:   user?.sia_licence_type  || '',
    sia_expiry_date:    user?.sia_expiry_date ? user.sia_expiry_date.split('T')[0] : '',
    sia_licence_type_2:   user?.sia_licence_type_2  || '',
    sia_licence_number_2: user?.sia_licence_number_2 || '',
    sia_expiry_date_2:    user?.sia_expiry_date_2 ? user.sia_expiry_date_2.split('T')[0] : '',
    bs7858_clearance_date: user?.bs7858_clearance_date ? user.bs7858_clearance_date.split('T')[0] : '',
    bs7858_expiry_date:    user?.bs7858_expiry_date ? user.bs7858_expiry_date.split('T')[0] : '',
    is_route_planner:  user?.is_route_planner || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.first_name.trim() || !form.email.trim()) { setError('Name and email are required'); return; }
    try {
      setSaving(true);
      const payload = {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email.toLowerCase().trim(), phone: form.phone || null, role: form.role,
        sia_licence_number: form.sia_licence_number || null, sia_licence_type: form.sia_licence_type || null,
        sia_expiry_date: form.sia_expiry_date || null,
        sia_licence_type_2: form.sia_licence_type_2 || null, sia_licence_number_2: form.sia_licence_number_2 || null,
        sia_expiry_date_2: form.sia_expiry_date_2 || null,
        bs7858_clearance_date: form.bs7858_clearance_date || null, bs7858_expiry_date: form.bs7858_expiry_date || null,
      };
      if (user) { await api.users.update(user.id, payload); onSaved(); }
      else { const res = await api.invite.send(payload); onSaved(res.message); }
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const f = (k, v) => setForm(p => ({...p, [k]: v}));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'640px',maxHeight:'90vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{user ? 'Edit Team Member' : 'Invite Team Member'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">First Name</label><input className="input" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div className="field"><label className="label">Last Name</label><input className="input" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e=>f('email',e.target.value)} disabled={!!user} />{!user && <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginTop:'0.25rem'}}>An invitation email will be sent to this address</div>}</div>
          <div className="field"><label className="label">Phone</label><input className="input" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div className="field"><label className="label">Role</label><select className="input" value={form.role} onChange={e=>f('role',e.target.value)}><option value="OFFICER">Officer</option><option value="OPS_MANAGER">Ops Manager</option><option value="FD">Field Director</option><option value="COMPANY">Admin</option></select></div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}><div className="section-title" style={{marginBottom:'0.25rem'}}>SIA Primary Licence</div></div>
          <div className="field"><label className="label">Licence Type</label><select className="input" value={form.sia_licence_type||''} onChange={e=>f('sia_licence_type',e.target.value)}><option value="">Select...</option>{SIA_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field"><label className="label">Licence No.</label><input className="input" value={form.sia_licence_number} onChange={e=>f('sia_licence_number',e.target.value)} placeholder="16-digit number" /></div>
          <div className="field"><label className="label">Expiry</label><input type="date" className="input" value={form.sia_expiry_date} onChange={e=>f('sia_expiry_date',e.target.value)} /></div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}><div className="section-title" style={{marginBottom:'0.25rem'}}>SIA Second Licence (optional)</div></div>
          <div className="field"><label className="label">Licence Type</label><select className="input" value={form.sia_licence_type_2||''} onChange={e=>f('sia_licence_type_2',e.target.value)}><option value="">None</option>{SIA_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field"><label className="label">Licence No.</label><input className="input" value={form.sia_licence_number_2} onChange={e=>f('sia_licence_number_2',e.target.value)} placeholder="16-digit number" /></div>
          <div className="field"><label className="label">Expiry</label><input type="date" className="input" value={form.sia_expiry_date_2} onChange={e=>f('sia_expiry_date_2',e.target.value)} /></div>

          <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}><div className="section-title" style={{marginBottom:'0.25rem'}}>BS7858 Vetting</div></div>
          <div className="field"><label className="label">Clearance Date</label><input type="date" className="input" value={form.bs7858_clearance_date} onChange={e=>f('bs7858_clearance_date',e.target.value)} /></div>
          <div className="field"><label className="label">Expiry Date</label><input type="date" className="input" value={form.bs7858_expiry_date} onChange={e=>f('bs7858_expiry_date',e.target.value)} /></div>
        </div>
        <div className="field">
          <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer'}}>
            <input type="checkbox" checked={form.is_route_planner||false} onChange={e=>setForm(f=>({...f,is_route_planner:e.target.checked}))} style={{width:'1rem',height:'1rem',accentColor:'var(--blue)'}} />
            <span className="label" style={{margin:0}}>Route Planner — can create &amp; edit patrol routes</span>
          </label>
        </div>
        {/* Pay Rates */}
        {user && (
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.75rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
              <div className="section-title" style={{margin:0}}>Pay Rates</div>
              {!showAddRate && <button className="btn btn-ghost btn-sm" onClick={() => { setEditRateId(null); setRateForm({ site_id:'', hourly_rate:'', role_label:'' }); setShowAddRate(true); }}>+ Add Rate</button>}
            </div>
            {ratesLoading ? <div style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>Loading...</div> : officerRates.length === 0 && !showAddRate ? (
              <div style={{fontSize:'0.8125rem',color:'var(--text-3)',padding:'0.5rem 0'}}>No pay rates set</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.375rem',marginBottom: showAddRate ? '0.75rem' : 0}}>
                {officerRates.map(r => (
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0.75rem',background:'var(--surface-2)',borderRadius:'6px',fontSize:'0.8125rem'}}>
                    <span style={{flex:1,fontWeight:500}}>{r.site?.name || 'All sites (default)'}</span>
                    <span style={{fontWeight:700,color:'var(--text)'}}>£{parseFloat(r.hourly_rate||0).toFixed(2)}/hr</span>
                    {r.role_label && <span style={{color:'var(--text-3)',fontSize:'0.75rem'}}>{r.role_label}</span>}
                    <button className="btn btn-ghost btn-sm" style={{padding:'0.25rem 0.5rem',fontSize:'0.75rem'}} onClick={() => { setEditRateId(r.id); setRateForm({ site_id: r.site_id||'', hourly_rate: r.hourly_rate||'', role_label: r.role_label||'' }); setShowAddRate(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{padding:'0.25rem 0.5rem',fontSize:'0.75rem',color:'var(--danger)'}} onClick={() => deleteRate(r.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            {showAddRate && (
              <div style={{padding:'0.75rem',background:'var(--surface-2)',borderRadius:'8px',border:'1px solid var(--border)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.5rem',marginBottom:'0.5rem'}}>
                  <div className="field"><label className="label">Site</label><select className="input" value={rateForm.site_id} onChange={e => setRateForm(p=>({...p, site_id:e.target.value}))}><option value="">All sites (default)</option>{allSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div className="field"><label className="label">Rate (£/hr)</label><input type="number" step="0.01" min="0" className="input" value={rateForm.hourly_rate} onChange={e => setRateForm(p=>({...p, hourly_rate:e.target.value}))} placeholder="12.50" /></div>
                  <div className="field"><label className="label">Role Label</label><input className="input" value={rateForm.role_label} onChange={e => setRateForm(p=>({...p, role_label:e.target.value}))} placeholder="e.g. SG, DS" /></div>
                </div>
                <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddRate(false); setEditRateId(null); }}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveRate} disabled={!rateForm.hourly_rate}>{editRateId ? 'Update' : 'Add Rate'}</button>
                </div>
              </div>
            )}
          </div>
        )}

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
  const [reportTab, setReportTab] = useState('logs');

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
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',padding:'0 1.5rem',background:'var(--surface)'}}>
        {[{key:'logs',label:'Reports'},{key:'visitors',label:'Visitors & Contractors'}].map(t => (
          <button key={t.key} onClick={() => setReportTab(t.key)}
            style={{padding:'0.75rem 1rem',background:'none',border:'none',borderBottom:`2px solid ${reportTab===t.key?'var(--blue)':'transparent'}`,color:reportTab===t.key?'var(--blue)':'var(--text-2)',fontSize:'0.875rem',fontWeight:600,cursor:'pointer',marginBottom:'-1px',whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="page-content">
        {reportTab === 'visitors' && <VisitorReportTab />}
        {reportTab === 'logs' && loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : reportTab === 'logs' ? (
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
        ) : null}
      </div>
    </div>
  );
}

function VisitorReportTab() {
  const [visitors, setVisitors] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = { limit: 300 };
      if (siteFilter) params.site_id = siteFilter;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const [vRes, sRes] = await Promise.all([api.visitors.list(params), api.sites.list()]);
      setVisitors(vRes.data || []);
      setSites(sRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [siteFilter, statusFilter]);

  const filtered = search
    ? visitors.filter(v => { const q = search.toLowerCase(); return (v.visitor_name||'').toLowerCase().includes(q) || (v.company_name||'').toLowerCase().includes(q) || (v.vehicle_reg||'').toLowerCase().includes(q); })
    : visitors;

  function exportCSV() {
    const headers = ['Name','Company','Site','Pass','Vehicle','Time In','Time Out','Status','Officer'];
    const rows = filtered.map(v => [v.visitor_name, v.company_name||'', v.site?.name||'', v.pass_number||'', v.vehicle_reg||'',
      v.time_in ? new Date(v.time_in).toLocaleString('en-GB',{timeZone:'Europe/London'}) : '',
      v.time_out ? new Date(v.time_out).toLocaleString('en-GB',{timeZone:'Europe/London'}) : '',
      v.status, v.officer ? `${v.officer.first_name} ${v.officer.last_name}` : '']);
    const csv = [headers,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `visitors-all-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  }

  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) : '—';
  const fmtDate = t => t ? new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/London'}) : '';

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        <input className="input" style={{width:'200px'}} placeholder="Search name, company, reg..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{width:'150px'}} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
          <option value="">All Sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px'}}>
          {[['','All'],['on_site','On Site']].map(([k,l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                background:statusFilter===k?'var(--blue)':'transparent',color:statusFilter===k?'#fff':'var(--text-2)'}}>
              {l}
            </button>
          ))}
        </div>
        <span style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>{filtered.length} visitor{filtered.length!==1?'s':''}</span>
        <div style={{flex:1}} />
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={filtered.length===0}>Export CSV</button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state"><p>No visitors found</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>Name</th><th>Company</th><th>Site</th><th>Pass</th><th>Vehicle</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Officer</th></tr></thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id}>
                <td style={{fontWeight:500}}>{v.visitor_name}</td>
                <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.company_name||v.who_visiting||'—'}</td>
                <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.site?.name||'—'}</td>
                <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{v.pass_number||'—'}</td>
                <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{v.vehicle_reg||'—'}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{fmtDate(v.time_in)} {fmtTime(v.time_in)}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{v.time_out ? `${fmtDate(v.time_out)} ${fmtTime(v.time_out)}` : '—'}</td>
                <td><span className={`badge ${v.status==='on_site'?'badge-success':'badge-neutral'}`}>{v.status==='on_site'?'ON SITE':'OFF SITE'}</span></td>
                <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.officer?`${v.officer.first_name} ${v.officer.last_name}`:'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

function SiteVisitorsTab({ siteId }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('on_site');

  async function load() {
    setLoading(true);
    try {
      const params = { site_id: siteId, limit: 200 };
      if (filter === 'on_site') params.status = 'on_site';
      if (filter === 'today') {
        const today = new Date(); today.setHours(0,0,0,0);
        params.from = today.toISOString();
      }
      const res = await api.visitors.list(params);
      setVisitors(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [siteId, filter]);

  const filtered = search
    ? visitors.filter(v => {
        const q = search.toLowerCase();
        return (v.visitor_name||'').toLowerCase().includes(q) || (v.company_name||'').toLowerCase().includes(q);
      })
    : visitors;

  function exportCSV() {
    const headers = ['Name','Company','Pass','Vehicle','Personnel','Time In','Time Out','Status','Officer'];
    const rows = filtered.map(v => [
      v.visitor_name, v.company_name||'', v.pass_number||'', v.vehicle_reg||'', v.personnel_count,
      v.time_in ? new Date(v.time_in).toLocaleString('en-GB',{timeZone:'Europe/London'}) : '',
      v.time_out ? new Date(v.time_out).toLocaleString('en-GB',{timeZone:'Europe/London'}) : '',
      v.status, v.officer ? `${v.officer.first_name} ${v.officer.last_name}` : '',
    ]);
    const csv = [headers,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `visitors-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  }

  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) : '—';
  const fmtDate = t => t ? new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/London'}) : '';

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>;

  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem',flexWrap:'wrap'}}>
        <input className="input" style={{width:'180px'}} placeholder="Search name, company..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px'}}>
          {[['','All'],['on_site','On Site'],['today','Today']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                background:filter===k?'var(--blue)':'transparent',color:filter===k?'#fff':'var(--text-2)'}}>
              {l}
            </button>
          ))}
        </div>
        <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{filtered.length} visitor{filtered.length!==1?'s':''}</span>
        <div style={{flex:1}} />
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={filtered.length===0}>Export CSV</button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state"><p>No visitors found</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>Name</th><th>Company</th><th>Pass</th><th>Vehicle</th><th>In</th><th>Out</th><th>Status</th><th>Officer</th></tr></thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id}>
                <td style={{fontWeight:500}}>{v.visitor_name}</td>
                <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.company_name||v.who_visiting||'—'}</td>
                <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{v.pass_number||'—'}</td>
                <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{v.vehicle_reg||'—'}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{fmtDate(v.time_in)} {fmtTime(v.time_in)}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{v.time_out ? `${fmtDate(v.time_out)} ${fmtTime(v.time_out)}` : '—'}</td>
                <td><span className={`badge ${v.status==='on_site'?'badge-success':'badge-neutral'}`}>{v.status==='on_site'?'ON SITE':'OFF SITE'}</span></td>
                <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.officer?`${v.officer.first_name} ${v.officer.last_name}`:'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

// ── Shared Patrol Session Map Modal ─────────────────────────────────────────
function PatrolSessionModal({ session, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' }) : '—';
  const fmtDate = t => t ? new Date(t).toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric', timeZone:'Europe/London' }) : '—';

  function calcDistance(trail) {
    if (!trail?.length || trail.length < 2) return null;
    let total = 0;
    for (let i = 1; i < trail.length; i++) {
      const R = 6371000;
      const lat1 = trail[i-1].lat * Math.PI/180, lat2 = trail[i].lat * Math.PI/180;
      const dLat = lat2 - lat1, dLng = (trail[i].lng - trail[i-1].lng) * Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return Math.round(total);
  }

  useEffect(() => {
    if (!session || !mapRef.current || mapInstance.current) return;
    function renderMap() {
      if (!window.L || !mapRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      const allPoints = [];

      if (session.gps_trail?.length) {
        const trail = session.gps_trail.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
        if (trail.length > 0) {
          L.polyline(trail, { color: '#3b82f6', weight: 3, opacity: 0.9 }).addTo(map);
          L.circleMarker(trail[0], { radius: 8, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map).bindPopup('Start');
          L.circleMarker(trail[trail.length-1], { radius: 8, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map).bindPopup('End');
          allPoints.push(...trail);
        }
      }

      if (session.checkpoints_completed?.length) {
        session.checkpoints_completed.forEach((cp, i) => {
          if (!cp.lat || !cp.lng) return;
          const icon = L.divIcon({ html: `<div style="width:22px;height:22px;background:#a78bfa;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0b1222">${i+1}</div>`, iconSize:[22,22], iconAnchor:[11,11] });
          L.marker([cp.lat, cp.lng], { icon }).addTo(map).bindPopup(cp.name || `Checkpoint ${i+1}`);
          allPoints.push([cp.lat, cp.lng]);
        });
      }

      if (allPoints.length > 0) map.fitBounds(allPoints, { padding: [30, 30] });
      else map.setView([52.48, -1.89], 14);
      mapInstance.current = map;
    }

    if (window.L) { renderMap(); }
    else {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link'); link.id='leaflet-css'; link.rel='stylesheet';
        link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
      }
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script'); script.id='leaflet-js';
        script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = renderMap; document.head.appendChild(script);
      } else { setTimeout(renderMap, 200); }
    }
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [session]);

  const duration = session.started_at && session.ended_at
    ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000) : null;
  const dist = calcDistance(session.gps_trail);
  const checkpoints = session.checkpoints_completed || [];
  const allMedia = [
    ...(session.media || []),
    ...checkpoints.flatMap(cp => [
      ...(cp.media || []),
      ...(cp.photo_url ? [{ url: cp.photo_url, type: 'image/jpeg', name: cp.name || 'photo' }] : []),
    ]),
  ];
  const [lightbox, setLightbox] = useState(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'640px',maxHeight:'92vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Patrol — {fmtDate(session.started_at)}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Meta strip */}
        <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1rem',padding:'0.75rem',background:'var(--surface-2)',borderRadius:'6px'}}>
          {session.officer && <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Officer</div><div style={{fontWeight:600,fontSize:'0.875rem'}}>{session.officer.first_name} {session.officer.last_name}</div></div>}
          {session.site && <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Site</div><div style={{fontWeight:600,fontSize:'0.875rem'}}>{session.site.name}</div></div>}
          <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Time</div><div style={{fontSize:'0.875rem'}}>{fmtTime(session.started_at)}{session.ended_at ? ` → ${fmtTime(session.ended_at)}` : ' (active)'}</div></div>
          {duration != null && <div><div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase',marginBottom:'2px'}}>Duration</div><div style={{fontWeight:600,fontSize:'0.875rem'}}>{duration >= 60 ? `${Math.floor(duration/60)}h ${duration%60}m` : `${duration}m`}</div></div>}
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem'}}>
          <div style={{flex:1,padding:'0.625rem',background:'var(--surface-2)',borderRadius:'6px',textAlign:'center'}}>
            <div style={{fontSize:'1.25rem',fontWeight:700}}>{checkpoints.length}</div>
            <div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase'}}>Checkpoints</div>
          </div>
          {dist != null && <div style={{flex:1,padding:'0.625rem',background:'var(--surface-2)',borderRadius:'6px',textAlign:'center'}}>
            <div style={{fontSize:'1.25rem',fontWeight:700}}>{dist >= 1000 ? `${(dist/1000).toFixed(1)}km` : `${dist}m`}</div>
            <div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase'}}>Distance</div>
          </div>}
          {session.gps_trail?.length > 0 && <div style={{flex:1,padding:'0.625rem',background:'var(--surface-2)',borderRadius:'6px',textAlign:'center'}}>
            <div style={{fontSize:'1.25rem',fontWeight:700}}>{session.gps_trail.length}</div>
            <div style={{fontSize:'0.6875rem',color:'var(--text-3)',textTransform:'uppercase'}}>GPS Points</div>
          </div>}
        </div>

        {/* Map */}
        <div ref={mapRef} style={{width:'100%',height:'320px',borderRadius:'8px',border:'1px solid var(--border)',marginBottom:'1rem'}} />

        {/* Checkpoints */}
        {checkpoints.length > 0 && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Checkpoints</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
              {checkpoints.map((cp, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.5rem 0.625rem',background:'var(--surface-2)',borderRadius:'6px'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#a78bfa',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#0b1222',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,fontSize:'0.8125rem',fontWeight:500}}>{typeof cp === 'object' ? cp.name || `Checkpoint ${i+1}` : cp}</div>
                  {typeof cp === 'object' && cp.timestamp && <div style={{fontSize:'0.75rem',color:'var(--text-3)',flexShrink:0}}>{fmtTime(cp.timestamp)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {allMedia.length > 0 && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Photos ({allMedia.length})</div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              {allMedia.map((m, i) => (
                <div key={i} onClick={() => m.type?.startsWith('image') && setLightbox(m.url)}
                  style={{width:80,height:80,borderRadius:'8px',overflow:'hidden',border:'1px solid var(--border)',cursor:'zoom-in',flexShrink:0}}>
                  <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt={m.name||'photo'} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <img src={lightbox} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:'8px',objectFit:'contain'}} />
          <button onClick={() => setLightbox(null)} style={{position:'absolute',top:'1rem',right:'1rem',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',width:36,height:36,borderRadius:'50%',fontSize:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
      )}
    </div>
  );
}

// ── Manager Patrol History Screen ────────────────────────────────────────────
function PatrolHistoryScreen({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');
  const [sites, setSites] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [sessRes, sitesRes] = await Promise.all([
          api.patrols.listSessions({ limit: 100 }),
          api.sites.list(),
        ]);
        setSessions(sessRes.data || []);
        setSites(sitesRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function openSession(s) {
    if (s.gps_trail) { setSelected(s); return; }
    setLoadingSession(true);
    try {
      const res = await api.patrols.getSession(s.id);
      setSelected(res.data);
    } catch (err) { alert('Failed to load patrol: ' + err.message); }
    finally { setLoadingSession(false); }
  }

  const filtered = siteFilter ? sessions.filter(s => s.site_id === siteFilter) : sessions;

  const fmtDate = t => t ? new Date(t).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Europe/London' }) : '—';
  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' }) : '—';
  const duration = s => s.started_at && s.ended_at ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000) : null;
  const fmtDur = d => d == null ? '—' : d >= 60 ? `${Math.floor(d/60)}h ${d%60}m` : `${d}m`;

  return (
    <div style={{padding:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'0.75rem'}}>
        <div>
          <h2 style={{fontSize:'1.125rem',fontWeight:700,margin:0}}>Patrol History</h2>
          <p style={{fontSize:'0.8125rem',color:'var(--text-2)',margin:'0.25rem 0 0'}}>All completed patrols — click to view route map</p>
        </div>
        <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
          style={{padding:'0.5rem 0.75rem',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'6px',color:'var(--text)',fontSize:'0.875rem'}}>
          <option value="">All Sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'var(--text-3)'}}>No patrols found</div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--border)'}}>
                {['Date','Officer','Site','Start','End','Duration','Checkpoints','GPS Points',''].map(h => (
                  <th key={h} style={{padding:'0.625rem 0.75rem',textAlign:'left',fontSize:'0.75rem',fontWeight:600,color:'var(--text-2)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => openSession(s)}
                  style={{borderBottom:'1px solid var(--border)',cursor:'pointer'}}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',whiteSpace:'nowrap'}}>{fmtDate(s.started_at)}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem'}}>{s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : '—'}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem'}}>{s.site?.name || '—'}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',whiteSpace:'nowrap'}}>{fmtTime(s.started_at)}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',whiteSpace:'nowrap'}}>{fmtTime(s.ended_at)}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',fontWeight:600}}>{fmtDur(duration(s))}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',textAlign:'center'}}>{(s.checkpoints_completed?.length) || 0}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',textAlign:'center'}}>{s.gps_trail?.length || 0}</td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.75rem',color:'var(--blue)',whiteSpace:'nowrap'}}>View map →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loadingSession && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="spinner" />
        </div>
      )}

      {selected && <PatrolSessionModal session={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export { PatrolHistoryScreen };
export { PatrolSessionModal };
