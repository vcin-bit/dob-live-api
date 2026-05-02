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
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',padding:'0 1.25rem'}}>
        {[['dashboard','Dashboard'],['issues','Issues'],['incidents','Occurrences'],['docs','Documents']].map(([val,label]) => (
          <button key={val} onClick={() => setTab(val)} style={{padding:'0.75rem 1rem',fontSize:'0.875rem',fontWeight:500,border:'none',borderBottom:`2px solid ${tab===val?'#1a52a8':'transparent'}`,color:tab===val?'#1a52a8':'#64748b',background:'none',cursor:'pointer',marginBottom:'-1px'}}>
            {label}
            {val==='issues' && openAlerts.length > 0 && <span style={{marginLeft:'0.375rem',background:'#dc2626',color:'#fff',borderRadius:'999px',fontSize:'0.6875rem',padding:'0 5px',fontWeight:700}}>{openAlerts.length}</span>}
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

            {/* Open Alerts */}
            {openAlerts.length > 0 && (
              <div className="card" style={{marginBottom:'1.25rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Open Issues</div>
                {openAlerts.slice(0,5).map(a => (
                  <div key={a.id} style={{padding:'0.625rem 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:severityColor(a.severity),flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:'0.875rem',fontWeight:500}}>{a.title}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{new Date(a.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                    <span className={`badge ${a.status==='resolved'?'badge-success':'badge-warning'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'issues' ? (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <div className="section-title">Alerts & Issues</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowRaiseAlert(true)}>+ Raise Alert</button>
            </div>
            {alerts.length === 0 ? (
              <div className="empty-state"><p>No alerts</p></div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
                {alerts.map(a => {
                  let responses = [];
                  try { const parsed = JSON.parse(a.description); if (Array.isArray(parsed)) responses = parsed; } catch {}
                  const descText = responses.length > 0 ? null : a.description;
                  return (
                    <div key={a.id} className="card" style={{borderLeft:`3px solid ${severityColor(a.severity)}`}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{a.title}</div>
                          {descText && <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginTop:'0.25rem'}}>{descText}</div>}
                          <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.25rem'}}>{new Date(a.created_at).toLocaleDateString('en-GB')}</div>
                        </div>
                        <span className={`badge ${a.status==='resolved'?'badge-success':'badge-warning'}`}>{a.status}</span>
                      </div>
                      {responses.length > 0 && (
                        <div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid var(--border)'}}>
                          {responses.map((r, i) => (
                            <div key={i} style={{padding:'0.375rem 0',fontSize:'0.8125rem',color:'var(--text-2)'}}>
                              <span style={{fontWeight:600,color:'var(--text-1)'}}>{r.name || r.from}</span>
                              <span style={{color:'var(--text-3)',marginLeft:'0.5rem',fontSize:'0.75rem'}}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}</span>
                              <div style={{marginTop:'0.125rem'}}>{r.text}</div>
                            </div>
                          ))}
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
    </div>
  );
}

function PortalRaiseAlertModal({ token, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!form.title.trim()) { setError('Title required'); return; }
    try {
      setSaving(true);
      await api.portal.raiseAlert(token, form);
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Raise an Alert</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Subject</label><input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Brief description of the issue" /></div>
        <div className="field"><label className="label">Details</label><textarea className="input" rows={4} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Additional details..." /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving}>{saving?'Sending...':'Send Alert'}</button>
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
