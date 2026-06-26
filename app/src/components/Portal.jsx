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

function PortalApp() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('portal_session')); } catch { return null; }
  });

  function login(token, site) {
    const s = { token, site };
    sessionStorage.setItem('portal_session', JSON.stringify(s));
    setSession(s);
  }

  function logout() {
    sessionStorage.removeItem('portal_session');
    setSession(null);
  }

  if (!session) return <PortalLogin onLogin={login} />;
  return <PortalDashboard session={session} onLogout={logout} />;
}

function PortalLogin({ onLogin }) {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.portal.sites().then(r => setSites(r.data || [])).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!siteId || !pin) { setError('Select a site and enter your PIN'); return; }
    setLoading(true); setError(null);
    try {
      const r = await api.portal.auth(siteId, pin);
      onLogin(r.token, r.site);
    } catch (err) {
      setError('Incorrect PIN or access not enabled for this site');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{width:'100%',maxWidth:'380px'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{fontSize:'1.75rem',fontWeight:700,letterSpacing:'-0.02em'}}>
            <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#0b1222'}}> Live</span>
          </div>
          <div style={{fontSize:'0.875rem',color:'#64748b',marginTop:'0.25rem'}}>Client Portal</div>
        </div>
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'1.5rem'}}>
          <h2 style={{fontSize:'0.9375rem',fontWeight:600,marginBottom:'1.25rem'}}>Access your site portal</h2>
          {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label className="label">Site</label>
              <select className="input" value={siteId} onChange={e => setSiteId(e.target.value)} required>
                <option value="">Select your site...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.client_name ? ` — ${s.client_name}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">PIN</label>
              <input type="password" className="input" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter site PIN" required maxLength={10} style={{letterSpacing:'0.2em',fontSize:'1.25rem'}} />
            </div>
            <button type="submit" className="btn btn-primary" style={{width:'100%',marginTop:'0.5rem'}} disabled={loading}>
              {loading ? 'Signing in...' : 'Access Portal'}
            </button>
          </form>
        </div>
        <div style={{textAlign:'center',marginTop:'1rem',fontSize:'0.75rem',color:'#94a3b8'}}>
          Contact your security provider if you need help accessing the portal
        </div>
      </div>
    </div>
  );
}

function PortalDashboard({ session, onLogout }) {
  const { token, site } = session;
  const [tab, setTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRaiseAlert, setShowRaiseAlert] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toLocaleDateString('en-CA', {timeZone:'Europe/London'}); });
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA', {timeZone:'Europe/London'}));

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, logsRes, alertsRes, docsRes] = await Promise.all([
          api.portal.summary(token),
          api.portal.logs(token, { limit: 500 }),
          api.portal.alerts(token),
          api.portal.documents(token),
        ]);
        setSummary(sumRes.data);
        setLogs(logsRes.data || []);
        setAlerts(alertsRes.data || []);
        setFolders(docsRes.folders || []);
        setDocuments(docsRes.documents || []);
      } catch (err) {
        if (err.status === 401) onLogout();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const filteredLogs = logTypeFilter ? logs.filter(l => l.log_type === logTypeFilter) : logs;
  const openAlerts = alerts.filter(a => a.status === 'open');
  const severityColor = s => s === 'high' || s === 'critical' ? 'var(--danger)' : s === 'medium' ? 'var(--warning)' : 'var(--text-3)';

  const typeColors = { PATROL:'badge-blue', INCIDENT:'badge-danger', ALARM:'badge-warning', ACCESS:'badge-navy', VISITOR:'badge-navy', HANDOVER:'badge-success', GENERAL:'badge-neutral' };

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{background:'#0b1222',padding:'0 1.25rem',height:'52px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontSize:'1.125rem',fontWeight:700}}>
          <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
          <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',marginLeft:'0.75rem',fontWeight:400}}>{site.name}</span>
        </div>
        <button onClick={onLogout} style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer'}}>Sign out</button>
      </div>

      {/* Tabs */}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',padding:'0 1.25rem',overflowX:'auto'}}>
        {[['dashboard','Dashboard'],['tasks','Tasks'],['expected','Expected Visitors'],['distribution','Distribution List'],['incidents','Occurrences'],['ai','Assignment Instructions'],['risks','Risk Assessments'],['codes','Site Codes'],['vendor-docs','Supplier Docs'],['docs','Documents']].map(([val,label]) => (
          <button key={val} onClick={() => setTab(val)} style={{padding:'0.75rem 1rem',fontSize:'0.875rem',fontWeight:500,border:'none',borderBottom:`2px solid ${tab===val?'#1a52a8':'transparent'}`,color:tab===val?'#1a52a8':'#64748b',background:'none',cursor:'pointer',marginBottom:'-1px'}}>
            {label}
            {val==='tasks' && openAlerts.length > 0 && <span style={{marginLeft:'0.375rem',background:'#1a52a8',color:'#fff',borderRadius:'999px',fontSize:'0.6875rem',padding:'0 5px',fontWeight:700}}>{openAlerts.length}</span>}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'auto',padding:'1.25rem',maxWidth:'900px',width:'100%',margin:'0 auto'}}>
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner" /></div>
        ) : tab === 'dashboard' ? (
          <div>
            {/* Officer On Duty */}
            <div className="card" style={{marginBottom:'1.25rem',borderLeft: (summary?.on_duty||[]).length > 0 ? '3px solid #10b981' : '3px solid #ef4444'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                <div className="section-title" style={{margin:0}}>Officer On Duty</div>
                <span style={{display:'inline-flex',alignItems:'center',gap:'0.375rem',fontSize:'0.8125rem',fontWeight:600,color: (summary?.on_duty||[]).length > 0 ? '#10b981' : '#ef4444'}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background: (summary?.on_duty||[]).length > 0 ? '#10b981' : '#ef4444',animation: (summary?.on_duty||[]).length > 0 ? 'pulse 2s infinite' : 'none'}} />
                  {(summary?.on_duty||[]).length > 0 ? 'ACTIVE' : 'NO COVER'}
                </span>
              </div>
              {(summary?.on_duty||[]).length > 0 ? (
                <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  {summary.on_duty.map((o, i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem',background:'rgba(16,185,129,0.05)',borderRadius:'8px'}}>
                      <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',fontWeight:700,color:'#10b981',flexShrink:0}}>
                        {o.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{o.name}</div>
                        <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>
                          {o.sia_type && <span>{o.sia_type}</span>}
                          {o.sia_last4 && <span style={{marginLeft:'0.5rem',fontFamily:'monospace',color:'var(--text-3)'}}>SIA {o.sia_last4}</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right',fontSize:'0.75rem',color:'var(--text-3)'}}>
                        On duty since<br /><span style={{fontWeight:600,color:'var(--text-2)'}}>{o.since ? new Date(o.since).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontSize:'0.875rem',color:'#ef4444'}}>No officer currently on duty at this site</div>
              )}
            </div>

            {/* Service Delivery Stats */}
            <div className="card" style={{marginBottom:'1.25rem'}}>
              <div className="section-title" style={{marginBottom:'0.875rem'}}>Service Delivery — Last 7 Days</div>
              {/* Headline stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'0.625rem',marginBottom:'1rem'}}>
                {[
                  { label:'Occurrences', value: summary?.total_occurrences_7d||0, color:'#1a52a8' },
                  { label:'Foot Patrols', value: summary?.foot_patrols_7d||0, color:'#10b981' },
                  { label:'CCTV Patrols', value: summary?.cctv_patrols_7d||0, color:'#0891b2' },
                  { label:'Police Involved', value: summary?.police_involved_7d||0, color: (summary?.police_involved_7d||0) > 0 ? '#dc2626' : '#6b7280' },
                ].map((s,i) => (
                  <div key={i} style={{textAlign:'center',padding:'0.75rem 0.5rem',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:'1.375rem',fontWeight:800,color:s.color}}>{s.value}</div>
                    <div style={{fontSize:'0.5625rem',color:'#6b7280',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',marginTop:'0.125rem'}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Breakdown */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                {[
                  { label: 'Incidents', value: summary?.incidents_7d||0, color: '#dc2626', filter: 'INCIDENT' },
                  { label: 'Vehicle Reports', value: summary?.vehicle_reports_7d||0, color: '#7c3aed', filter: 'VEHICLE_CHECK' },
                  { label: 'EH&S Reports', value: summary?.health_safety_7d||0, color: '#f59e0b', filter: 'HEALTH_SAFETY' },
                  { label: 'Alarms / Emergency', value: summary?.alarms_7d||0, color: '#ef4444', filter: 'ALARM' },
                ].map((s, i) => (
                  <div key={i} onClick={() => { setLogTypeFilter(s.filter); setTab('incidents'); }}
                    style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.5rem 0.75rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid #f1f5f9',cursor:'pointer',transition:'background 0.15s'}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}} />
                    <div style={{flex:1,fontSize:'0.8125rem',color:'#374151'}}>{s.label}</div>
                    <div style={{fontSize:'0.9375rem',fontWeight:700,color:s.value>0?s.color:'#d1d5db'}}>{s.value}</div>
                    <div style={{fontSize:'0.6875rem',color:'#9ca3af'}}>View &rarr;</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hours Delivered */}
            {summary?.contracted_weekly > 0 && (
              <div className="card" style={{marginBottom:'1.25rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Hours Delivered This Week</div>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'0.5rem'}}>
                  <div style={{flex:1,background:'#e2e8f0',borderRadius:'6px',height:'12px',overflow:'hidden'}}>
                    <div style={{width:`${Math.min(100, (summary.hours_delivered_7d / summary.contracted_weekly) * 100)}%`,height:'100%',background: summary.hours_delivered_7d >= summary.contracted_weekly ? '#10b981' : '#3b82f6',borderRadius:'6px'}} />
                  </div>
                  <span style={{fontSize:'0.9375rem',fontWeight:700,whiteSpace:'nowrap'}}>{summary.hours_delivered_7d} / {summary.contracted_weekly} hrs</span>
                </div>
              </div>
            )}

            {/* Open Tasks */}
            {openAlerts.length > 0 && (
              <div className="card" style={{marginBottom:'1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                  <div className="section-title" style={{margin:0}}>Open Tasks</div>
                  <button onClick={() => setTab('tasks')} style={{fontSize:'0.75rem',color:'#1a52a8',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>View all &rarr;</button>
                </div>
                {openAlerts.slice(0,3).map(a => (
                  <div key={a.id} style={{padding:'0.625rem 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#1a52a8',flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:'0.875rem',fontWeight:500}}>{a.title}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{new Date(a.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                    <span className={`badge ${a.status==='resolved'?'badge-success':a.status==='unsuccessful'?'badge-danger':'badge-blue'}`}>{a.status === 'resolved' ? 'Complete' : a.status === 'unsuccessful' ? 'Unsuccessful' : 'Open'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'tasks' ? (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <div className="section-title">Tasks</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowRaiseAlert(true)}>+ Raise a Task</button>
            </div>
            {/* Status indicators */}
            {alerts.length > 0 && (
              <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
                {[
                  { label:'All', value:'', count: alerts.length },
                  { label:'Open', value:'open', count: alerts.filter(a=>a.status==='open').length, color:'#1a52a8' },
                  { label:'Complete', value:'resolved', count: alerts.filter(a=>a.status==='resolved').length, color:'#10b981' },
                  { label:'Unsuccessful', value:'unsuccessful', count: alerts.filter(a=>a.status==='unsuccessful').length, color:'#dc2626' },
                ].map(f => (
                  <button key={f.value} onClick={() => setTaskStatusFilter(f.value)}
                    style={{padding:'0.25rem 0.75rem',borderRadius:'999px',border:`1px solid ${taskStatusFilter===f.value ? (f.color||'#374151') : '#d1d5db'}`,
                      background:taskStatusFilter===f.value ? (f.color||'#374151') : '#fff',
                      color:taskStatusFilter===f.value ? '#fff' : '#6b7280',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>
                    {f.label} {f.count > 0 && <span style={{marginLeft:'0.25rem',opacity:0.7}}>({f.count})</span>}
                  </button>
                ))}
              </div>
            )}
            {alerts.length === 0 ? (
              <div className="empty-state"><p>No tasks raised yet. Use the button above to request an action from the security team.</p></div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
                {alerts.filter(a => !taskStatusFilter || a.status === taskStatusFilter).map(a => {
                  let responses = [];
                  try { const parsed = JSON.parse(a.description); if (Array.isArray(parsed)) responses = parsed; } catch {}
                  const descText = responses.length > 0 ? null : a.description;
                  return (
                    <div key={a.id} className="card" style={{borderLeft:`3px solid ${a.status==='resolved'?'#10b981':a.status==='unsuccessful'?'#dc2626':'#1a52a8'}`}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{a.title}</div>
                          {descText && <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginTop:'0.25rem'}}>{descText}</div>}
                          <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.25rem'}}>{new Date(a.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
                        </div>
                        <span className={`badge ${a.status==='resolved'?'badge-success':a.status==='unsuccessful'?'badge-danger':'badge-blue'}`}>{a.status === 'resolved' ? 'Complete' : a.status === 'unsuccessful' ? 'Unsuccessful' : 'Open'}</span>
                      </div>
                      {responses.length > 0 && (
                        <div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid var(--border)'}}>
                          <div style={{fontSize:'0.6875rem',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.375rem'}}>Updates</div>
                          {responses.map((r, i) => (
                            <div key={i} style={{padding:'0.375rem 0',fontSize:'0.8125rem',color:'var(--text-2)'}}>
                              <span style={{fontWeight:600,color:'var(--text-1)'}}>{r.name || r.from}</span>
                              <span style={{color:'var(--text-3)',marginLeft:'0.5rem',fontSize:'0.75rem'}}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}</span>
                              <div style={{marginTop:'0.125rem'}}>{r.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Actions */}
                      {(a.status === 'open' || a.status === 'unsuccessful') && (
                        <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid var(--border)'}}>
                          {a.status === 'open' && (
                            <>
                              <button onClick={() => setEditTask(a)} style={{fontSize:'0.75rem',color:'#1a52a8',background:'none',border:'1px solid #dbeafe',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>Edit</button>
                              <button onClick={async () => {
                                if (!window.confirm('Delete this task?')) return;
                                try { await api.portal.deleteAlert(token, a.id); setAlerts(prev => prev.filter(x => x.id !== a.id)); } catch {}
                              }} style={{fontSize:'0.75rem',color:'#dc2626',background:'none',border:'1px solid #fecaca',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>Delete</button>
                            </>
                          )}
                          {a.status === 'unsuccessful' && (
                            <button onClick={async () => {
                              try {
                                await api.portal.updateAlert(token, a.id, { status: 'open' });
                                const r = await api.portal.alerts(token);
                                setAlerts(r.data || []);
                              } catch {}
                            }} style={{fontSize:'0.75rem',color:'#1a52a8',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'6px',padding:'0.375rem 0.75rem',cursor:'pointer',fontWeight:700}}>
                              Re-issue Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === 'incidents' ? (
          <div>
            <div style={{marginBottom:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                <div className="section-title" style={{margin:0}}>Occurrence Reports</div>
              </div>
              {/* Date range */}
              <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginBottom:'0.75rem',flexWrap:'wrap'}}>
                <span style={{fontSize:'0.75rem',color:'#6b7280',fontWeight:600}}>From</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{padding:'0.375rem 0.5rem',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'0.8125rem',color:'#374151',background:'#fff'}} />
                <span style={{fontSize:'0.75rem',color:'#6b7280',fontWeight:600}}>To</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{padding:'0.375rem 0.5rem',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'0.8125rem',color:'#374151',background:'#fff'}} />
                <button onClick={() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); setDateFrom(d.toLocaleDateString('en-CA',{timeZone:'Europe/London'})); setDateTo(new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})); }}
                  style={{padding:'0.375rem 0.625rem',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'0.75rem',color:'#6b7280',background:'#f9fafb',cursor:'pointer',fontWeight:500}}>This Week</button>
                <button onClick={() => { const d=new Date(); d.setDate(1); setDateFrom(d.toLocaleDateString('en-CA',{timeZone:'Europe/London'})); setDateTo(new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})); }}
                  style={{padding:'0.375rem 0.625rem',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'0.75rem',color:'#6b7280',background:'#f9fafb',cursor:'pointer',fontWeight:500}}>This Month</button>
              </div>
              {/* Type pills */}
              <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                {[
                  { label:'All', value:'' },
                  { label:'Incidents', value:'INCIDENT' },
                  { label:'Vehicle', value:'VEHICLE_CHECK' },
                  { label:'EH&S', value:'HEALTH_SAFETY' },
                  { label:'Alarms', value:'ALARM' },
                ].map(f => (
                  <button key={f.value} onClick={() => setLogTypeFilter(f.value)}
                    style={{padding:'0.25rem 0.625rem',borderRadius:'999px',border:`1px solid ${logTypeFilter===f.value?'#1a52a8':'#d1d5db'}`,background:logTypeFilter===f.value?'#1a52a8':'#fff',color:logTypeFilter===f.value?'#fff':'#6b7280',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const relevantTypes = ['INCIDENT','VEHICLE_CHECK','HEALTH_SAFETY','ALARM','FIRE_ALARM','EMERGENCY'];
              const fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
              const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;
              const filtered = logs.filter(l => {
                if (!relevantTypes.includes(l.log_type)) return false;
                if (logTypeFilter && l.log_type !== logTypeFilter && !(logTypeFilter === 'ALARM' && ['ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type))) return false;
                const d = new Date(l.occurred_at);
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                return true;
              });
              const typeLabels = { INCIDENT:'Incident', VEHICLE_CHECK:'Vehicle Report', HEALTH_SAFETY:'EH&S', ALARM:'Alarm', FIRE_ALARM:'Fire Alarm', EMERGENCY:'Emergency' };
              const typeBorders = { INCIDENT:'#dc2626', VEHICLE_CHECK:'#7c3aed', HEALTH_SAFETY:'#f59e0b', ALARM:'#ef4444', FIRE_ALARM:'#ef4444', EMERGENCY:'#ef4444' };
              return (
                <>
                  <div style={{fontSize:'0.75rem',color:'#9ca3af',marginBottom:'0.75rem'}}>{filtered.length} occurrence{filtered.length!==1?'s':''} found</div>
                  {filtered.length === 0 ? <div className="empty-state"><p>No occurrence reports for this period</p></div> : (
                    <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                      {filtered.map(l => (
                        <div key={l.id} className="card" style={{borderLeft:`3px solid ${typeBorders[l.log_type]||'#6b7280'}`}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{l.title||typeLabels[l.log_type]||'Report'}</div>
                              {l.description && <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginTop:'0.25rem',lineHeight:1.5}}>{l.description}</div>}
                              <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.5rem'}}>
                                {new Date(l.occurred_at).toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
                              </div>
                            </div>
                            <span style={{padding:'0.125rem 0.5rem',borderRadius:'999px',fontSize:'0.6875rem',fontWeight:700,background:`${typeBorders[l.log_type]||'#6b7280'}15`,color:typeBorders[l.log_type]||'#6b7280',border:`1px solid ${typeBorders[l.log_type]||'#6b7280'}30`,whiteSpace:'nowrap'}}>{typeLabels[l.log_type]||l.log_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : tab === 'ai' ? (
          <PortalAssignmentInstructions token={token} site={site} />
        ) : tab === 'risks' ? (
          <PortalRiskAssessments token={token} />
        ) : tab === 'codes' ? (
          <PortalSiteCodes token={token} />
        ) : tab === 'vendor-docs' ? (
          <PortalSubcontractorDocs token={token} />
        ) : tab === 'docs' ? (
          <div>
            <div className="section-title" style={{marginBottom:'1rem'}}>Documents</div>
            {folders.length === 0 && documents.length === 0 ? (
              <div className="empty-state"><p>No documents available</p></div>
            ) : (
              <>
                {folders.map(folder => {
                  const folderDocs = documents.filter(d => d.folder_id === folder.id);
                  return (
                    <div key={folder.id} className="card" style={{marginBottom:'0.875rem'}}>
                      <div style={{fontWeight:600,marginBottom:'0.75rem'}}>{folder.name}</div>
                      {folderDocs.length === 0 ? <div style={{fontSize:'0.875rem',color:'var(--text-3)'}}>No documents in this folder</div> : (
                        folderDocs.map(d => (
                          <div key={d.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem 0',borderBottom:'1px solid var(--border)'}}>
                            <div>
                              <div style={{fontSize:'0.875rem',fontWeight:500}}>{d.name}</div>
                              <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{d.file_size ? `${(d.file_size/1024).toFixed(0)} KB` : ''}</div>
                            </div>
                            <a href={d.storage_path?.startsWith("http") ? d.storage_path : `https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/documents/${d.storage_path}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
                {documents.filter(d => !d.folder_id).length > 0 && (
                  <div className="card">
                    <div style={{fontWeight:600,marginBottom:'0.75rem'}}>Other Documents</div>
                    {documents.filter(d => !d.folder_id).map(d => (
                      <div key={d.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem 0',borderBottom:'1px solid var(--border)'}}>
                        <div style={{fontSize:'0.875rem',fontWeight:500}}>{d.name}</div>
                        <a href={d.storage_path?.startsWith("http") ? d.storage_path : `https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/documents/${d.storage_path}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : tab === 'expected' ? (
          <PortalExpectedVisitors token={token} />
        ) : tab === 'distribution' ? (
          <PortalDistributionList token={token} />
        ) : null}
      </div>

      {showRaiseAlert && (
        <PortalRaiseAlertModal
          token={token}
          onClose={() => setShowRaiseAlert(false)}
          onSaved={() => {
            setShowRaiseAlert(false);
            api.portal.alerts(token).then(r => setAlerts(r.data||[]));
          }}
        />
      )}

      {editTask && (
        <PortalEditTaskModal
          token={token}
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={() => {
            setEditTask(null);
            api.portal.alerts(token).then(r => setAlerts(r.data||[]));
          }}
        />
      )}
    </div>
  );
}

function PortalSubcontractorDocs({ token }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.portal.subcontractorDocs(token)
      .then(r => setDocs(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function viewDoc(docId) {
    try {
      const res = await api.portal.subcontractorDocSigned(token, docId);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch { alert('Could not open document'); }
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner" /></div>;
  if (docs.length === 0) return <div className="empty-state"><p>No supplier documents shared for this site</p></div>;

  return (
    <div>
      <div className="section-title" style={{marginBottom:'1rem'}}>Supplier Documents</div>
      <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
        {docs.map(d => (
          <div key={d.id} className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{d.name}</div>
              <div style={{fontSize:'0.8125rem',color:'#6b7280',marginTop:'0.125rem'}}>
                {d.subcontractor?.company_name && <span style={{fontWeight:500}}>{d.subcontractor.company_name}</span>}
                {d.subcontractor?.service_type && <span style={{marginLeft:'0.5rem',fontSize:'0.75rem',padding:'1px 6px',borderRadius:'3px',background:'rgba(99,102,241,0.1)',color:'#6366f1',fontWeight:600}}>{d.subcontractor.service_type}</span>}
                {d.doc_type && <span style={{marginLeft:'0.5rem'}}>· {d.doc_type}</span>}
              </div>
              <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:'0.25rem'}}>
                {new Date(d.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                {d.file_size && <span style={{marginLeft:'0.5rem'}}>{(d.file_size/1024).toFixed(0)} KB</span>}
              </div>
            </div>
            <button onClick={() => viewDoc(d.id)} className="btn btn-secondary btn-sm">View</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalAssignmentInstructions({ token, site }) {
  const [ai, setAI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    api.portal.assignmentInstructions(token)
      .then(r => { setAI(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function approve() {
    if (!approverName.trim()) { setError('Please enter your name'); return; }
    try {
      setApproving(true); setError(null);
      await api.portal.approveAI(token, { name: approverName.trim(), email: approverEmail.trim() || null });
      setAI(prev => ({ ...prev, client_approved: true, client_approved_by: approverName.trim(), client_approved_at: new Date().toISOString() }));
      setShowApprove(false);
    } catch (e) { setError(e.message); }
    finally { setApproving(false); }
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner" /></div>;
  if (!ai) return <div className="empty-state"><p>No published assignment instructions for this site</p></div>;

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <div>
          <div className="section-title" style={{margin:0}}>{ai.title}</div>
          <div style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.25rem'}}>
            Revision {ai.revision} — Published {ai.published_at ? new Date(ai.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : ''}
          </div>
        </div>
        <span style={{fontSize:'0.6875rem',padding:'4px 10px',borderRadius:'999px',fontWeight:700,
          background: ai.client_approved ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          color: ai.client_approved ? '#059669' : '#d97706',
          border: `1px solid ${ai.client_approved ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`}}>
          {ai.client_approved ? `Approved by ${ai.client_approved_by}` : 'Pending client approval'}
        </span>
      </div>

      {/* Approval banner */}
      {!ai.client_approved && !showApprove && (
        <div className="card" style={{marginBottom:'1rem',borderLeft:'3px solid #f59e0b',padding:'1rem'}}>
          <div style={{fontWeight:600,marginBottom:'0.375rem'}}>Client Approval Required</div>
          <div style={{fontSize:'0.875rem',color:'#6b7280',marginBottom:'0.75rem'}}>
            Please review all sections below. Once satisfied, approve to confirm these Assignment Instructions are acceptable.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowApprove(true)}>Approve Assignment Instructions</button>
        </div>
      )}

      {/* Approval form */}
      {showApprove && (
        <div className="card" style={{marginBottom:'1rem',borderLeft:'3px solid #1a52a8',padding:'1rem'}}>
          <div style={{fontWeight:600,marginBottom:'0.75rem'}}>Confirm Approval</div>
          {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}>
            <div className="field" style={{margin:0}}>
              <label className="label">Your Name *</label>
              <input className="input" value={approverName} onChange={e => setApproverName(e.target.value)} placeholder="e.g. Julie Sanders" />
            </div>
            <div className="field" style={{margin:0}}>
              <label className="label">Email (optional)</label>
              <input className="input" type="email" value={approverEmail} onChange={e => setApproverEmail(e.target.value)} placeholder="e.g. julie@harrislamb.com" />
            </div>
          </div>
          <div style={{fontSize:'0.8125rem',color:'#6b7280',marginBottom:'0.75rem'}}>
            By approving, you confirm that you have reviewed Revision {ai.revision} of the Assignment Instructions for {site.name} and find them acceptable.
          </div>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="btn btn-primary btn-sm" onClick={approve} disabled={approving}>{approving ? 'Approving...' : 'Confirm Approval'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowApprove(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Approved banner */}
      {ai.client_approved && (
        <div className="card" style={{marginBottom:'1rem',borderLeft:'3px solid #10b981',padding:'1rem',background:'rgba(16,185,129,0.03)'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
            <span style={{color:'#059669',fontWeight:700}}>Approved</span>
            <span style={{fontSize:'0.8125rem',color:'#6b7280'}}>
              by {ai.client_approved_by} on {new Date(ai.client_approved_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* Sections */}
      <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
        {(ai.sections || []).map((sec, i) => (
          <div key={i} className="card">
            <div style={{fontWeight:600,marginBottom:'0.375rem'}}>
              <span style={{color:'#1a52a8',marginRight:'0.375rem'}}>{i + 1}.</span>{sec.title}
            </div>
            <div style={{fontSize:'0.875rem',color:'#374151',whiteSpace:'pre-line',lineHeight:1.6}}>{sec.content}</div>
          </div>
        ))}
      </div>

      {/* Linked policies */}
      {ai.linked_policies && ai.linked_policies.length > 0 && (
        <div style={{marginTop:'1rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Linked Policies</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.375rem'}}>
            {ai.linked_policies.map((p, i) => (
              <span key={i} style={{fontSize:'0.75rem',padding:'2px 8px',borderRadius:'4px',background:'#f1f5f9',border:'1px solid #e2e8f0',color:'#475569',fontWeight:500}}>{p}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortalRiskAssessments({ token }) {
  const [ras, setRAs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.portal.riskAssessments(token)
      .then(r => setRAs(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner" /></div>;
  if (ras.length === 0) return <div className="empty-state"><p>No risk assessments available for this site</p></div>;

  const levelColor = l => {
    if (!l) return '#6b7280';
    const lc = l.toLowerCase();
    if (lc === 'very high' || lc === 'critical') return '#dc2626';
    if (lc === 'high') return '#ea580c';
    if (lc === 'medium') return '#d97706';
    if (lc === 'low') return '#16a34a';
    return '#6b7280';
  };

  return (
    <div>
      <div className="section-title" style={{marginBottom:'1rem'}}>Risk Assessments</div>
      <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
        {ras.map(ra => (
          <div key={ra.id} className="card">
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',cursor:'pointer'}} onClick={() => setExpanded(expanded === ra.id ? null : ra.id)}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
                  <span style={{fontWeight:700,color:'#1a52a8',fontSize:'0.8125rem'}}>{ra.reference_number}</span>
                  <span style={{fontSize:'0.6875rem',padding:'2px 6px',borderRadius:'3px',fontWeight:700,color:levelColor(ra.overall_risk_level),background:`${levelColor(ra.overall_risk_level)}10`,border:`1px solid ${levelColor(ra.overall_risk_level)}30`}}>
                    {ra.overall_risk_level || 'Unrated'}
                  </span>
                </div>
                <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{ra.title}</div>
                {ra.scope && <div style={{fontSize:'0.8125rem',color:'#6b7280',marginTop:'0.25rem'}}>{ra.scope}</div>}
                <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:'0.25rem'}}>
                  Assessed: {ra.assessment_date ? new Date(ra.assessment_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '—'}
                  {ra.review_date && <span> · Review: {new Date(ra.review_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</span>}
                </div>
              </div>
              <span style={{fontSize:'0.75rem',color:'#9ca3af',marginLeft:'0.5rem'}}>{expanded === ra.id ? '▲' : '▼'}</span>
            </div>

            {expanded === ra.id && ra.risks && ra.risks.length > 0 && (
              <div style={{marginTop:'1rem',borderTop:'1px solid #e2e8f0',paddingTop:'0.875rem'}}>
                <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.75rem'}}>
                  Hazards & Controls ({ra.risks.length})
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                  {ra.risks.map(risk => (
                    <div key={risk.id} style={{padding:'0.75rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid #f1f5f9'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.375rem'}}>
                        {risk.risk_category?.name && <span style={{fontSize:'0.6875rem',fontWeight:600,color:'#475569',background:'#e2e8f0',padding:'1px 6px',borderRadius:'3px'}}>{risk.risk_category.name}</span>}
                        <span style={{fontSize:'0.6875rem',fontWeight:700,color:levelColor(risk.risk_level)}}>{risk.risk_level || ''}</span>
                        {risk.residual_level && <span style={{fontSize:'0.6875rem',color:'#6b7280'}}>→ {risk.residual_level}</span>}
                      </div>
                      <div style={{fontWeight:600,fontSize:'0.875rem',marginBottom:'0.25rem'}}>{risk.hazard_description}</div>
                      {risk.who_at_risk && <div style={{fontSize:'0.8125rem',color:'#6b7280'}}><strong>Who:</strong> {risk.who_at_risk}</div>}
                      {risk.potential_consequences && <div style={{fontSize:'0.8125rem',color:'#6b7280'}}><strong>Consequences:</strong> {risk.potential_consequences}</div>}
                      {risk.existing_controls && <div style={{fontSize:'0.8125rem',color:'#374151',marginTop:'0.25rem'}}><strong>Controls:</strong> {risk.existing_controls}</div>}
                      {risk.additional_controls && <div style={{fontSize:'0.8125rem',color:'#374151'}}><strong>Additional:</strong> {risk.additional_controls}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalSiteCodes({ token }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.portal.codes(token)
      .then(r => setCodes(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'4rem'}}><div className="spinner" /></div>;
  if (codes.length === 0) return <div className="empty-state"><p>No site codes configured</p></div>;

  return (
    <div>
      <div className="section-title" style={{marginBottom:'1rem'}}>Site Codes</div>
      <div className="card">
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.875rem'}}>
          <thead>
            <tr style={{borderBottom:'2px solid #e2e8f0'}}>
              <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'#6b7280',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Label</th>
              <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'#6b7280',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Code</th>
              <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'#6b7280',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Type</th>
              <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'#6b7280',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(c => (
              <tr key={c.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                <td style={{padding:'0.625rem 0.75rem',fontWeight:600}}>{c.label}</td>
                <td style={{padding:'0.625rem 0.75rem',fontFamily:'monospace',fontSize:'0.9375rem',fontWeight:700,color:'#1a52a8',letterSpacing:'0.1em'}}>{c.code}</td>
                <td style={{padding:'0.625rem 0.75rem',color:'#6b7280'}}>{c.code_type || '—'}</td>
                <td style={{padding:'0.625rem 0.75rem',color:'#6b7280',fontSize:'0.8125rem'}}>{c.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PortalRaiseAlertModal({ token, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!form.title.trim()) { setError('Please describe the task'); return; }
    try {
      setSaving(true);
      await api.portal.raiseAlert(token, form);
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Raise a Task</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">What do you need us to do?</label><input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Check the back fence tonight" /></div>
        <div className="field"><label className="label">Additional details (optional)</label><textarea className="input" rows={4} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Any extra information that will help the team..." /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving}>{saving?'Sending...':'Submit Task'}</button>
        </div>
      </div>
    </div>
  );
}

function PortalEditTaskModal({ token, task, onClose, onSaved }) {
  const [form, setForm] = useState({ title: task.title || '', description: task.description || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Don't show raw JSON in description field
  useEffect(() => {
    try { const p = JSON.parse(task.description); if (Array.isArray(p)) setForm(f => ({...f, description: ''})); } catch {}
  }, []);

  async function save() {
    if (!form.title.trim()) { setError('Task description required'); return; }
    try {
      setSaving(true);
      await api.portal.updateAlert(token, task.id, { title: form.title, description: form.description || null });
      onSaved();
    } catch(e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Edit Task</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">What do you need us to do?</label><input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
        <div className="field"><label className="label">Additional details (optional)</label><textarea className="input" rows={4} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── PORTAL EXPECTED VISITORS ──────────────────────────────────────────────
function PortalExpectedVisitors({ token }) {
  const [showForm, setShowForm] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editBooking, setEditBooking] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  async function load() {
    try {
      const res = await api.portal.listExpectedVisitors(token);
      const rows = res.data || [];
      const groups = {};
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
      rows.forEach(r => {
        const gid = r.booking_group_id;
        if (!gid) return;
        if (!groups[gid]) {
          groups[gid] = {
            booking_group_id: gid, visitor_name: r.visitor_name, company_name: r.company_name,
            who_visiting: r.who_visiting, vehicle_reg: r.vehicle_reg,
            personnel_count: r.personnel_count, expected_time: r.expected_time, notes: r.notes, days: [],
          };
        }
        groups[gid].days.push({ date: r.expected_date, status: r.status });
      });
      const grouped = Object.values(groups).map(g => {
        g.days.sort((a, b) => a.date.localeCompare(b.date));
        g.date_from = g.days[0].date;
        g.date_to = g.days[g.days.length - 1].date;
        g.day_count = g.days.length;
        const allCancelled = g.days.every(d => d.status === 'cancelled');
        const hasExpectedFuture = g.days.some(d => d.status === 'expected' && d.date >= today);
        const hasOnSite = g.days.some(d => d.status === 'on_site');
        const hasArrived = g.days.some(d => d.status === 'on_site' || d.status === 'signed_out');
        if (allCancelled) g.rolled_status = 'Cancelled';
        else if (hasExpectedFuture) g.rolled_status = hasArrived ? 'Upcoming (partly arrived)' : 'Upcoming';
        else if (hasOnSite) g.rolled_status = 'On site';
        else g.rolled_status = 'Completed';
        return g;
      });
      grouped.sort((a, b) => b.date_from.localeCompare(a.date_from));
      setBookings(grouped);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function cancelBooking(groupId) {
    setCancelling(true);
    try {
      await api.portal.cancelExpectedVisitorGroup(token, groupId);
      setCancelConfirm(null);
      load();
    } catch (err) { alert(err.message); }
    finally { setCancelling(false); }
  }

  const upcoming = bookings.filter(b => b.rolled_status.startsWith('Upcoming') || b.rolled_status === 'On site');
  const past = bookings.filter(b => b.rolled_status === 'Completed' || b.rolled_status === 'Cancelled');
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
  const statusBadge = (s) => {
    const colors = { 'Upcoming': { bg: 'rgba(26,82,168,0.1)', c: '#1a52a8' }, 'Upcoming (partly arrived)': { bg: 'rgba(26,82,168,0.1)', c: '#1a52a8' }, 'On site': { bg: 'rgba(16,185,129,0.1)', c: '#10b981' }, 'Completed': { bg: '#f1f5f9', c: '#64748b' }, 'Cancelled': { bg: '#fef2f2', c: '#9ca3af' } };
    const col = colors[s] || colors['Completed'];
    return <span style={{fontSize:'0.6875rem',fontWeight:600,padding:'0.125rem 0.5rem',borderRadius:'999px',background:col.bg,color:col.c,whiteSpace:'nowrap'}}>{s}</span>;
  };

  function BookingCard({ b, actions }) {
    return (
      <div className="card" style={{marginBottom:'0.625rem',borderLeft: b.rolled_status === 'Cancelled' ? '3px solid #e2e8f0' : b.rolled_status.startsWith('Upcoming') ? '3px solid #1a52a8' : b.rolled_status === 'On site' ? '3px solid #10b981' : '3px solid #e2e8f0'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.75rem'}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{b.visitor_name}</div>
            {b.company_name && <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{b.company_name}</div>}
            {b.who_visiting && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'0.125rem'}}>Purpose: {b.who_visiting}</div>}
            <div style={{display:'flex',gap:'0.75rem',marginTop:'0.375rem',fontSize:'0.8125rem',color:'var(--text-3)',flexWrap:'wrap'}}>
              <span>{b.date_from === b.date_to ? fmtDate(b.date_from) : `${fmtDate(b.date_from)} – ${fmtDate(b.date_to)}`}{b.day_count > 1 ? ` (${b.day_count}d)` : ''}</span>
              {b.expected_time && <span>ETA: {b.expected_time.slice(0,5)}</span>}
              {b.personnel_count > 1 && <span>{b.personnel_count} persons</span>}
              {b.vehicle_reg && <span>Reg: {b.vehicle_reg}</span>}
            </div>
          </div>
          {statusBadge(b.rolled_status)}
        </div>
        {actions && (
          <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid var(--border)'}}>
            <button onClick={() => setEditBooking(b)} style={{fontSize:'0.75rem',color:'#1a52a8',background:'none',border:'1px solid #dbeafe',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>Edit</button>
            <button onClick={() => setCancelConfirm(b)} style={{fontSize:'0.75rem',color:'#dc2626',background:'none',border:'1px solid #fecaca',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
        <div className="section-title">Expected Visitors</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Register Expected Visit</button>
      </div>
      <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginBottom:'1rem'}}>
        Register a contractor or visitor expected on site so officers know to expect them.
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'0.6875rem',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.5rem'}}>Upcoming</div>
              {upcoming.map(b => <BookingCard key={b.booking_group_id} b={b} actions />)}
            </div>
          )}
          {past.length > 0 && (
            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'0.6875rem',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.5rem'}}>Past</div>
              {past.map(b => <BookingCard key={b.booking_group_id} b={b} />)}
            </div>
          )}
          {bookings.length === 0 && (
            <div className="empty-state"><p>No expected visitors registered yet. Use the button above to register one.</p></div>
          )}
        </>
      )}

      {showForm && (
        <PortalExpectedVisitorModal
          token={token}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
      {editBooking && (
        <PortalExpectedVisitorEditModal
          token={token}
          booking={editBooking}
          onClose={() => setEditBooking(null)}
          onSaved={() => { setEditBooking(null); load(); }}
        />
      )}
      {cancelConfirm && (
        <div className="modal-overlay" onClick={() => setCancelConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Cancel Expected Visit</div><button className="modal-close" onClick={() => setCancelConfirm(null)}>x</button></div>
            <p style={{fontSize:'0.875rem',color:'var(--text-2)',margin:'0 0 1rem'}}>Cancel this expected visit? Future days will be removed; any already-arrived days are kept.</p>
            <div style={{fontWeight:500,marginBottom:'1rem'}}>{cancelConfirm.visitor_name}</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCancelConfirm(null)}>Keep</button>
              <button className="btn btn-primary" style={{background:'#dc2626',borderColor:'#dc2626'}} onClick={() => cancelBooking(cancelConfirm.booking_group_id)} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Cancel Visit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PortalExpectedVisitorModal({ token, onClose, onSaved }) {
  const [form, setForm] = useState({
    visitor_name: '', who_visiting: '', expected_from: '', expected_to: '',
    expected_time: '', personnel_count: '1', vehicle_reg: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!form.visitor_name.trim()) { setError('Visitor / company name is required'); return; }
    if (!form.expected_from || !form.expected_to) { setError('Start and end dates are required'); return; }
    try {
      setSaving(true);
      await api.portal.expectedVisitors(token, {
        visitor_name: form.visitor_name.trim(),
        who_visiting: form.who_visiting.trim() || null,
        expected_from: form.expected_from,
        expected_to: form.expected_to,
        expected_time: form.expected_time || null,
        personnel_count: parseInt(form.personnel_count) || 1,
        vehicle_reg: form.vehicle_reg.trim() || null,
        notes: form.notes.trim() || null,
      });
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Register Expected Visit</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Visitor / company name</label><input className="input" value={form.visitor_name} onChange={e => setForm(f=>({...f,visitor_name:e.target.value}))} placeholder="e.g. Severn Trent, BT Engineer" /></div>
        <div className="field"><label className="label">Purpose of visit (optional)</label><input className="input" value={form.who_visiting} onChange={e => setForm(f=>({...f,who_visiting:e.target.value}))} placeholder="e.g. Meter reading, Lift repair" /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">From</label><input type="date" className="input" value={form.expected_from} onChange={e => setForm(f=>({...f,expected_from:e.target.value}))} /></div>
          <div className="field"><label className="label">To</label><input type="date" className="input" value={form.expected_to} onChange={e => setForm(f=>({...f,expected_to:e.target.value}))} /></div>
          <div className="field"><label className="label">ETA (optional)</label><input type="time" className="input" value={form.expected_time} onChange={e => setForm(f=>({...f,expected_time:e.target.value}))} /></div>
        </div>
        <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginBottom:'0.75rem'}}>A multi-day range creates one entry per day for the officer's daily expected list.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">Personnel</label><input type="number" className="input" min="1" value={form.personnel_count} onChange={e => setForm(f=>({...f,personnel_count:e.target.value}))} /></div>
          <div className="field"><label className="label">Vehicle Reg (optional)</label><input className="input" value={form.vehicle_reg} onChange={e => setForm(f=>({...f,vehicle_reg:e.target.value}))} placeholder="e.g. AB12 CDE" /></div>
        </div>
        <div className="field"><label className="label">Notes (optional)</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Any additional information for the security team" /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving}>{saving ? 'Sending...' : 'Register Visit'}</button>
        </div>
      </div>
    </div>
  );
}

function PortalExpectedVisitorEditModal({ token, booking, onClose, onSaved }) {
  const [form, setForm] = useState({
    visitor_name: booking.visitor_name || '', company_name: booking.company_name || '',
    who_visiting: booking.who_visiting || '', expected_time: booking.expected_time ? booking.expected_time.slice(0,5) : '',
    personnel_count: String(booking.personnel_count || 1), vehicle_reg: booking.vehicle_reg || '', notes: booking.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.visitor_name.trim()) { setError('Visitor name is required'); return; }
    try {
      setSaving(true);
      await api.portal.updateExpectedVisitorGroup(token, booking.booking_group_id, {
        visitor_name: form.visitor_name.trim(),
        company_name: form.company_name.trim() || null,
        who_visiting: form.who_visiting.trim() || null,
        expected_time: form.expected_time || null,
        personnel_count: parseInt(form.personnel_count) || 1,
        vehicle_reg: form.vehicle_reg.trim() || null,
        notes: form.notes.trim() || null,
      });
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Edit Expected Visit</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Visitor / company name</label><input className="input" value={form.visitor_name} onChange={e => setForm(f=>({...f,visitor_name:e.target.value}))} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">Company</label><input className="input" value={form.company_name} onChange={e => setForm(f=>({...f,company_name:e.target.value}))} /></div>
          <div className="field"><label className="label">Purpose</label><input className="input" value={form.who_visiting} onChange={e => setForm(f=>({...f,who_visiting:e.target.value}))} /></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">ETA</label><input type="time" className="input" value={form.expected_time} onChange={e => setForm(f=>({...f,expected_time:e.target.value}))} /></div>
          <div className="field"><label className="label">Personnel</label><input type="number" className="input" min="1" value={form.personnel_count} onChange={e => setForm(f=>({...f,personnel_count:e.target.value}))} /></div>
          <div className="field"><label className="label">Vehicle Reg</label><input className="input" value={form.vehicle_reg} onChange={e => setForm(f=>({...f,vehicle_reg:e.target.value}))} /></div>
        </div>
        <div className="field"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} /></div>
        <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginBottom:'0.75rem'}}>Date range cannot be changed. To adjust dates, cancel and re-create the booking.</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── PORTAL DISTRIBUTION LIST ─────────────────────────────────────────────
function PortalDistributionList({ token }) {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    try {
      const res = await api.portal.listDistribution(token);
      setRecipients(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    setRemoving(true);
    try {
      await api.portal.removeDistribution(token, id);
      setRemoveConfirm(null);
      load();
    } catch (err) { alert(err.message); }
    finally { setRemoving(false); }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
        <div className="section-title">Distribution List</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Recipient</button>
      </div>
      <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginBottom:'1rem'}}>
        Recipients on this site's distribution list for PIN codes, comms and report updates.
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      ) : recipients.length === 0 ? (
        <div className="empty-state"><p>No recipients on the distribution list yet. Use the button above to add one.</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
          {recipients.map(r => (
            <div key={r.id} className="card" style={{borderLeft:'3px solid #1a52a8'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.75rem'}}>
                <div style={{flex:1}}>
                  {r.name && <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{r.name}</div>}
                  <div style={{fontSize:'0.875rem',marginTop:r.name?'0.125rem':0}}><a href={`mailto:${r.email}`} style={{color:'#1a52a8',textDecoration:'none'}}>{r.email}</a></div>
                  {r.unit_ref && <div style={{fontSize:'0.8125rem',color:'var(--text-3)',marginTop:'0.125rem'}}>{r.unit_ref}</div>}
                </div>
                {removeConfirm === r.id ? (
                  <div style={{display:'flex',gap:'0.375rem'}}>
                    <button onClick={() => remove(r.id)} disabled={removing} style={{fontSize:'0.75rem',color:'#fff',background:'#dc2626',border:'none',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>{removing ? '...' : 'Yes'}</button>
                    <button onClick={() => setRemoveConfirm(null)} style={{fontSize:'0.75rem',color:'#6b7280',background:'none',border:'1px solid #d1d5db',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setRemoveConfirm(r.id)} style={{fontSize:'0.75rem',color:'#dc2626',background:'none',border:'1px solid #fecaca',borderRadius:'6px',padding:'0.25rem 0.625rem',cursor:'pointer',fontWeight:600}}>Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <PortalAddDistributionModal
          token={token}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function PortalAddDistributionModal({ token, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', unit_ref: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!form.email.trim()) { setError('Email is required'); return; }
    try {
      setSaving(true);
      await api.portal.addDistribution(token, {
        name: form.name.trim() || null,
        email: form.email.trim(),
        unit_ref: form.unit_ref.trim() || null,
      });
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Add Recipient</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Name (optional)</label><input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Recipient name" /></div>
        <div className="field"><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com" /></div>
        <div className="field"><label className="label">Unit Ref (optional)</label><input className="input" value={form.unit_ref} onChange={e => setForm(f=>({...f,unit_ref:e.target.value}))} placeholder="e.g. Unit 12" /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving}>{saving ? 'Sending...' : 'Add Recipient'}</button>
        </div>
      </div>
    </div>
  );
}

// ── PORTAL SETTINGS (manager can enable portal + set PIN per site) ─────────
function PortalSettingsModal({ site, onClose, onSaved }) {
  const [form, setForm] = useState({
    client_portal_enabled: site?.client_portal_enabled || false,
    client_portal_pin: site?.client_portal_pin || '',
    client_name: site?.client_name || '',
    client_contact_name: site?.client_contact_name || '',
    client_contact_email: site?.client_contact_email || '',
    client_contact_phone: site?.client_contact_phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    try {
      setSaving(true);
      await api.portal.saveSettings(site.id, form);
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Portal Settings — {site?.name}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field">
          <label style={{display:'flex',alignItems:'center',gap:'0.625rem',cursor:'pointer'}}>
            <input type="checkbox" checked={form.client_portal_enabled} onChange={e=>f('client_portal_enabled',e.target.checked)} style={{width:'1rem',height:'1rem',accentColor:'var(--blue)'}} />
            <span className="label" style={{margin:0}}>Enable client portal for this site</span>
          </label>
        </div>
        {form.client_portal_enabled && (
          <>
            <div className="field"><label className="label">Portal PIN</label><input className="input" value={form.client_portal_pin} onChange={e=>f('client_portal_pin',e.target.value)} placeholder="e.g. 1234" maxLength={8} /></div>
            <div className="field"><label className="label">Client Name</label><input className="input" value={form.client_name} onChange={e=>f('client_name',e.target.value)} placeholder="e.g. Brindleyplace BID" /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
              <div className="field"><label className="label">Contact Name</label><input className="input" value={form.client_contact_name} onChange={e=>f('client_contact_name',e.target.value)} /></div>
              <div className="field"><label className="label">Contact Phone</label><input className="input" value={form.client_contact_phone} onChange={e=>f('client_contact_phone',e.target.value)} /></div>
            </div>
            <div className="field"><label className="label">Contact Email</label><input type="email" className="input" value={form.client_contact_email} onChange={e=>f('client_contact_email',e.target.value)} /></div>
            <div className="alert alert-warning" style={{marginTop:'0.5rem'}}>
              Share the site PIN with your client contact. They access the portal at <strong>app.doblive.co.uk/portal</strong>
            </div>
          </>
        )}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// Error boundary to catch runtime errors
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:'2rem',maxWidth:'600px',margin:'2rem auto',fontFamily:'monospace'}}>
          <h2 style={{color:'#dc2626',marginBottom:'1rem'}}>App Error</h2>
          <pre style={{background:'#fef2f2',border:'1px solid #fca5a5',padding:'1rem',borderRadius:'6px',fontSize:'0.8125rem',overflow:'auto',whiteSpace:'pre-wrap'}}>
            {this.state.error.message}
            {this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{marginTop:'1rem',padding:'0.5rem 1rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer'}}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Clerk configuration
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key")
}

// Main App with Clerk Provider

export { PortalApp };
export { PortalSettingsModal };
