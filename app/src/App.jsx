import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from './lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from './lib/constants';
import { 
  HomeIcon, 
  ClipboardDocumentListIcon, 
  MapPinIcon, 
  ClockIcon, 
  UserGroupIcon, 
  Cog6ToothIcon,
  PlusIcon,
  ArrowRightOnRectangleIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  DocumentTextIcon,
  BellAlertIcon,
  UsersIcon,
  EyeIcon,
  FunnelIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';



// ════════════════════════════════════════════════════════════════════════════
// CLIENT PORTAL — separate from Clerk auth, PIN-based per site
// ════════════════════════════════════════════════════════════════════════════

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

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, logsRes, alertsRes, docsRes] = await Promise.all([
          api.portal.summary(token),
          api.portal.logs(token, { limit: 100 }),
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
        {[['dashboard','Dashboard'],['issues','Issues'],['logs','Log Feed'],['docs','Documents']].map(([val,label]) => (
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
            <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
              <div className="stat-card"><div className="stat-value">{summary?.logs_7d||0}</div><div className="stat-label">Logs (7 days)</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#1a52a8'}}>{summary?.patrols_7d||0}</div><div className="stat-label">Patrols</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'var(--danger)'}}>{summary?.incidents_7d||0}</div><div className="stat-label">Incidents</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:summary?.open_alerts>0?'var(--warning)':'var(--text)'}}>{summary?.open_alerts||0}</div><div className="stat-label">Open Alerts</div></div>
            </div>
            {openAlerts.length > 0 && (
              <div className="card" style={{marginBottom:'1.25rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Open Alerts</div>
                {openAlerts.slice(0,3).map(a => (
                  <div key={a.id} style={{padding:'0.625rem 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:severityColor(a.severity),flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:'0.875rem',fontWeight:500}}>{a.title}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{new Date(a.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="card">
              <div className="section-title" style={{marginBottom:'0.75rem'}}>Recent Activity</div>
              {logs.slice(0,5).map(l => (
                <div key={l.id} style={{padding:'0.5rem 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'0.75rem'}}>
                  <span className={`badge ${typeColors[l.log_type]||'badge-neutral'}`}>{l.log_type}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title||'Log Entry'}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{new Date(l.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              ))}
            </div>
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
                {alerts.map(a => (
                  <div key={a.id} className="card" style={{borderLeft:`3px solid ${severityColor(a.severity)}`}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{a.title}</div>
                        {a.description && <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginTop:'0.25rem'}}>{a.description}</div>}
                        <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.25rem'}}>{new Date(a.created_at).toLocaleDateString('en-GB')}</div>
                      </div>
                      <span className={`badge ${a.status==='resolved'?'badge-success':'badge-warning'}`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'logs' ? (
          <div>
            <div style={{display:'flex',gap:'0.75rem',alignItems:'center',marginBottom:'1rem'}}>
              <div className="section-title" style={{flex:1}}>Security Log</div>
              <select className="input" style={{width:'160px'}} value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {['PATROL','INCIDENT','ALARM','ACCESS','VISITOR','HANDOVER','GENERAL'].map(t => <option key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            {filteredLogs.length === 0 ? <div className="empty-state"><p>No logs</p></div> : (
              <table className="table">
                <thead><tr><th>Date/Time</th><th>Type</th><th>Entry</th><th>Officer</th></tr></thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <tr key={l.id}>
                      <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{new Date(l.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td><span className={`badge ${typeColors[l.log_type]||'badge-neutral'}`}>{l.log_type}</span></td>
                      <td style={{fontWeight:500,maxWidth:'260px'}}>
                        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title||'Log Entry'}</div>
                        {l.description && <div style={{fontSize:'0.75rem',color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.description}</div>}
                      </td>
                      <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{l.officer?`${l.officer.first_name} ${l.officer.last_name}`:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                            <a href={`https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/documents/${d.storage_path}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
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
                        <a href={`https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/documents/${d.storage_path}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
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
const clerkPubKey = 'pk_test_c3BlY2lhbC1ib2JjYXQtNDguY2xlcmsuYWNjb3VudHMuZGV2JA';

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key")
}

// Main App with Clerk Provider
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/portal/*" element={<PortalApp />} />
        <Route path="*" element={
          <ClerkProvider publishableKey={clerkPubKey}>
            <SignedOut><AuthFlow /></SignedOut>
            <SignedIn><ErrorBoundary><AuthenticatedApp /></ErrorBoundary></SignedIn>
          </ClerkProvider>
        } />
      </Routes>
    </Router>
  );
}

// Auth flow for signed-out users
function AuthFlow() {
  const [mode, setMode] = useState('signin');
  return (
    <div className="auth-page" style={{padding:'1rem'}}>
      <div className="auth-box" style={{maxWidth:'380px'}}>
        <div className="auth-logo" style={{marginBottom:'1.5rem'}}>
          <div className="wordmark" style={{fontSize:'1.75rem'}}><span className="dob">DOB</span><span className="live"> Live</span></div>
          <div className="sub">Security Management Platform</div>
        </div>
        <div className="auth-card" style={{padding:'1.5rem'}}>
          <h2 style={{fontSize:'0.9375rem',fontWeight:600,marginBottom:'1.25rem',color:'var(--text)'}}>
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h2>
          {mode === 'signin' ? (
            <SignIn       appearance={{
                elements: {
                  card: 'shadow-none border-0 bg-transparent p-0 w-full',
                  headerTitle: 'hidden', headerSubtitle: 'hidden',
                  socialButtons: 'hidden', socialButtonsBlockButton: 'hidden',
                  divider: 'hidden', footer: 'hidden', footerAction: 'hidden',
                  footerActionText: 'hidden', footerActionLink: 'hidden',
                  identityPreview: 'hidden', alternativeMethods: 'hidden',
                  formFieldLabel: 'label',
                  formFieldInput: 'input',
                  formButtonPrimary: 'btn btn-primary w-full',
                  formFieldRow: 'field',
                  formFieldAction: 'text-right mt-1',
                  formFieldInputShowPasswordButton: '',
                  formFieldErrorText: 'text-xs mt-1' ,
                  globalError: 'alert alert-danger mb-4',
                  otpCodeFieldInput: 'w-10 h-10 text-center border border-[#cbd5e1] rounded text-base font-semibold',
                }
              }} />
          ) : (
            <SignUp       appearance={{
                elements: {
                  card: 'shadow-none border-0 bg-transparent p-0 w-full',
                  headerTitle: 'hidden', headerSubtitle: 'hidden',
                  socialButtons: 'hidden', socialButtonsBlockButton: 'hidden',
                  divider: 'hidden', footer: 'hidden', footerAction: 'hidden',
                  footerActionText: 'hidden', footerActionLink: 'hidden',
                  identityPreview: 'hidden', alternativeMethods: 'hidden',
                  formFieldLabel: 'label',
                  formFieldInput: 'input',
                  formButtonPrimary: 'btn btn-primary w-full',
                  formFieldRow: 'field',
                  formFieldAction: 'text-right mt-1',
                  formFieldInputShowPasswordButton: '',
                  formFieldErrorText: 'text-xs mt-1' ,
                  globalError: 'alert alert-danger mb-4',
                  otpCodeFieldInput: 'w-10 h-10 text-center border border-[#cbd5e1] rounded text-base font-semibold',
                }
              }} />
          )}
          <div style={{borderTop:'1px solid var(--border)',marginTop:'1.25rem',paddingTop:'1rem',fontSize:'0.875rem',color:'var(--text-2)',textAlign:'center'}}>
            {mode === 'signin' ? (
              <span>No account? <button onClick={() => setMode('signup')} style={{color:'var(--blue)',fontWeight:500,background:'none',border:'none',cursor:'pointer'}}>Create one</button></span>
            ) : (
              <span>Have an account? <button onClick={() => setMode('signin')} style={{color:'var(--blue)',fontWeight:500,background:'none',border:'none',cursor:'pointer'}}>Sign in</button></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// Main authenticated application
function AuthenticatedApp() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user data from our database
  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        const userData = await api.users.me();
        setDbUser(userData.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchUserData();
    }
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  if (!dbUser) {
    return <UserNotFoundScreen />;
  }

  // Route based on user role
  if (dbUser.role === 'OFFICER') {
    return <OfficerApp user={dbUser} />;
  } else {
    return <ManagerApp user={dbUser} />;
  }
}

// Loading screen
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mb-4"></div>
        <p className="text-slate-600">Loading your dashboard...</p>
      </div>
    </div>
  );
}

// Error screen
function ErrorScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Connection Error</h2>
        <p className="text-slate-600 mb-6">
          {error instanceof ApiError 
            ? `API Error: ${error.message}` 
            : 'Unable to connect to DOB Live services.'
          }
        </p>
        <button onClick={onRetry} className="btn btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}

// User not found screen
function UserNotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Account Setup Required</h2>
        <p className="text-slate-600 mb-6">
          Your account exists but needs to be set up by your administrator. 
          Please contact your operations manager.
        </p>
        <button onClick={() => window.Clerk.signOut()} className="btn btn-secondary">
          Sign Out
        </button>
      </div>
    </div>
  );
}

// Officer Application
function OfficerApp({ user }) {
  const location = useLocation();
  const [activeShift, setActiveShift] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch officer data
  useEffect(() => {
    async function fetchOfficerData() {
      try {
        // Get sites assigned to this officer
        const sitesResponse = await api.officerSites.list(user.id);
        setSites(sitesResponse.data || []);

        // Get active shift
        const shiftsResponse = await api.shifts.list({ 
          officer_id: user.id, 
          status: 'ACTIVE' 
        });
        const activeShifts = shiftsResponse.data || [];
        if (activeShifts.length > 0) {
          setActiveShift(activeShifts[0]);
          setSelectedSite(activeShifts[0].site);
        }
      } catch (err) {
        console.error('Failed to fetch officer data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOfficerData();
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  // If no site selected and not on site picker page, redirect to site picker
  if (!selectedSite && location.pathname !== '/sites') {
    return <Navigate to="/sites" replace />;
  }

  return (
    <div className="officer-shell">
      <OfficerHeader user={user} selectedSite={selectedSite} activeShift={activeShift} />
      <div className="officer-content">
      
      <Routes>
        <Route path="/sites" element={
          <SitePickerScreen 
            sites={sites}
            onSiteSelect={setSelectedSite}
            user={user}
          />
        } />
        <Route path="/" element={
          <OfficerDashboard 
            user={user}
            site={selectedSite}
            shift={activeShift}
          />
        } />
        <Route path="/log" element={
          <LogEntryScreen 
            user={user}
            site={selectedSite}
            shift={activeShift}
          />
        } />
        <Route path="/logs" element={
          <LogHistoryScreen 
            user={user}
            site={selectedSite}
          />
        } />
        <Route path="/tasks" element={
          <TasksScreen 
            user={user}
            site={selectedSite}
            shift={activeShift}
          />
        } />
        <Route path="/instructions" element={<OfficerInstructionsScreen user={user} site={selectedSite} />} />
        <Route path="/policies" element={<OfficerPoliciesScreen user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      <OfficerNavigation />
    </div>
  );
}

// Officer Header
function OfficerHeader({ user, selectedSite, activeShift }) {
  return (
    <div className="officer-header">
      <div className="logo"><span className="dob">DOB</span><span className="live"> Live</span></div>
      <div style={{textAlign:'right'}}>
        {selectedSite && <div style={{fontSize:'0.8125rem',fontWeight:500}}>{selectedSite.name}</div>}
        <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.5)'}}>{user.first_name} {user.last_name}</div>
      </div>
    </div>
  );
}


function SitePickerScreen({ sites, onSiteSelect, user }) {
  const navigate = useNavigate();
  
  const handleSiteSelect = (site) => {
    onSiteSelect(site);
    navigate('/');
  };
  
  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Select Your Site</h2>
          <p className="text-slate-600">Choose which site you're working at today</p>
        </div>
        
        <div className="grid gap-4">
          {sites.length === 0 ? (
            <div className="text-center py-12">
              <MapPinIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No sites available. Contact your manager.</p>
            </div>
          ) : (
            sites.map((site) => (
              <button
                key={site.id}
                onClick={() => handleSiteSelect(site)}
                className="card text-left hover: transition-all p-6 border-2 border-transparent hover:border-cyan-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{site.name}</h3>
                    <p className="text-slate-600 mb-2">{site.address}</p>
                    {site.description && (
                      <p className="text-sm text-slate-500">{site.description}</p>
                    )}
                  </div>
                  <ArrowRightOnRectangleIcon className="w-6 h-6 text-slate-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Officer Dashboard
function OfficerDashboard({ user, site, shift }) {
  const [recentLogs, setRecentLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Get recent logs for this officer at this site
        const logsResponse = await api.logs.list({
          site_id: site?.id,
          limit: 5,
          officer_id: user.id
        });
        setRecentLogs(logsResponse.data || []);
        
        // Get pending tasks
        const tasksResponse = await api.tasks.list({
          site_id: site?.id,
          status: 'PENDING'
        });
        setTasks(tasksResponse.data || []);
        
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    if (site) {
      fetchDashboardData();
    }
  }, [site, user]);
  
  if (!site) {
    return <Navigate to="/sites" replace />;
  }
  
  return (
    <div className="container py-6 pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {shift ? 'Active Shift' : 'Dashboard'}
        </h2>
        <p className="text-slate-600">
          {shift 
            ? `Started ${formatDateTime(shift.start_time)}`
            : `Welcome to ${site.name}`
          }
        </p>
      </div>
      
      <div className="grid gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionButton
              to="/log"
              icon={<PlusIcon className="w-5 h-5" />}
              title="New Log Entry"
              subtitle="Record an occurrence"
              color="accent"
            />
            <QuickActionButton
              to="/tasks"
              icon={<ClipboardDocumentListIcon className="w-5 h-5" />}
              title="View Tasks"
              subtitle={`${tasks.length} pending`}
              color="info"
            />
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Logs</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ClipboardDocumentListIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent logs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <LogPreviewCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
        
        {/* Pending Tasks */}
        {tasks.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Pending Tasks</h3>
            <div className="space-y-3">
              {tasks.slice(0, 3).map((task) => (
                <TaskPreviewCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({ to, icon, title, subtitle, color = 'primary' }) {
  const navigate = useNavigate();
  
  const colorClasses = {
    primary: 'bg-slate-50 hover:bg-slate-100 text-slate-700',
    accent: 'bg-[#e8f0fb] hover:bg-[#dce8f8] text-[#163f87]',
    info: 'bg-blue-50 hover:bg-blue-100 text-blue-700'
  };
  
  return (
    <button
      onClick={() => navigate(to)}
      className={`p-4 rounded-lg text-left transition-colors ${colorClasses[color]}`}
    >
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-sm opacity-75">{subtitle}</p>
    </button>
  );
}

// Log Preview Card
function LogPreviewCard({ log }) {
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
      <div className="text-2xl">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-900">{log.title}</span>
          <span className={`status-badge ${config.color === 'alert' ? 'status-alert' : 'status-info'}`}>
            {config.label}
          </span>
        </div>
        <p className="text-sm text-slate-600 truncate">{log.description}</p>
        <p className="text-xs text-slate-500 mt-1">
          {getRelativeTime(log.occurred_at)}
        </p>
      </div>
    </div>
  );
}

// Task Preview Card
function TaskPreviewCard({ task }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
      <div className="text-2xl">📋</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-900">{task.title}</span>
          <span className={`status-badge status-pending`}>
            {task.priority || 'Normal'}
          </span>
        </div>
        <p className="text-sm text-slate-600 truncate">{task.description}</p>
        {task.due_date && (
          <p className="text-xs text-slate-500 mt-1">
            Due: {formatDateTime(task.due_date)}
          </p>
        )}
      </div>
    </div>
  );
}

// Log Entry Screen with comprehensive form
function LogEntryScreen({ user, site, shift }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    log_type: '',
    title: '',
    description: '',
    occurred_at: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    latitude: null,
    longitude: null,
    what3words: '',
    type_data: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Unable to get current location');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.log_type) {
        throw new Error('Please select a log type');
      }
      if (!formData.title?.trim()) {
        throw new Error('Please enter a title');
      }
      if (!formData.description?.trim()) {
        throw new Error('Please enter a description');
      }

      // Submit log entry
      const logData = {
        site_id: site.id,
        shift_id: shift?.id || null,
        log_type: formData.log_type,
        title: formData.title.trim(),
        description: formData.description.trim(),
        occurred_at: formData.occurred_at,
        latitude: formData.latitude,
        longitude: formData.longitude,
        what3words: formData.what3words?.trim() || null,
        type_data: formData.type_data
      };

      await api.logs.create(logData);
      
      // Success - redirect to dashboard
      navigate('/', { 
        state: { message: 'Log entry created successfully' }
      });
    } catch (err) {
      console.error('Failed to create log entry:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedLogConfig = LOG_TYPE_CONFIG[formData.log_type];

  return (
    <div className="container py-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">New Log Entry</h2>
          <p className="text-slate-600">Record a security occurrence or observation</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-red-800 font-medium">Error</p>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Log Type Selection */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Log Type</h3>
            <div className="grid gap-3">
              {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => (
                <LogTypeOption
                  key={type}
                  type={type}
                  config={config}
                  selected={formData.log_type === type}
                  onSelect={() => setFormData(prev => ({ 
                    ...prev, 
                    log_type: type,
                    type_data: {} // Reset type-specific data when changing type
                  }))}
                />
              ))}
            </div>
          </div>

          {/* Basic Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief summary of the occurrence"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description *
                </label>
                <textarea
                  className="input textarea"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of what occurred, actions taken, and any observations"
                  rows="4"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  value={formData.occurred_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, occurred_at: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Location</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {locationLoading ? (
                    <>
                      <div className="spinner"></div>
                      <span>Getting Location...</span>
                    </>
                  ) : (
                    <>
                      <MapPinIcon className="w-4 h-4" />
                      <span>Get Current Location</span>
                    </>
                  )}
                </button>
                
                {formData.latitude && formData.longitude && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <span>✓</span>
                    <span>Location captured</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  What3Words (Optional)
                </label>
                <input
                  type="text"
                  className="input font-mono"
                  value={formData.what3words}
                  onChange={(e) => setFormData(prev => ({ ...prev, what3words: e.target.value }))}
                  placeholder="e.g. filled.count.soap"
                />
              </div>
            </div>
          </div>

          {/* Type-Specific Fields */}
          {selectedLogConfig && (
            <TypeSpecificFields
              logType={formData.log_type}
              config={selectedLogConfig}
              data={formData.type_data}
              onChange={(typeData) => setFormData(prev => ({ ...prev, type_data: typeData }))}
            />
          )}

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading || !formData.log_type || !formData.title.trim() || !formData.description.trim()}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  <span>Creating...</span>
                </>
              ) : (
                'Create Log Entry'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Log Type Option Component
function LogTypeOption({ type, config, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`p-4 text-left rounded-lg border-2 transition-all ${
        selected 
          ? 'border-cyan-300 bg-[#e8f0fb]' 
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-slate-900">{config.label}</span>
            <span className={`status-badge status-${config.color}`}>
              {type}
            </span>
          </div>
          <p className="text-sm text-slate-600">{config.description}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 bg-[#1a52a8] rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
      </div>
    </button>
  );
}

// Type-Specific Fields Component
function TypeSpecificFields({ logType, config, data, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  if (!config.fields || config.fields.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        {config.label} Details
      </h3>
      <div className="space-y-4">
        {config.fields.map((field) => (
          <TypeSpecificField
            key={field}
            field={field}
            logType={logType}
            value={data[field] || ''}
            onChange={(value) => updateField(field, value)}
          />
        ))}
      </div>
    </div>
  );
}

// Individual Type-Specific Field Component
function TypeSpecificField({ field, logType, value, onChange }) {
  const getFieldConfig = () => {
    const fieldConfigs = {
      // Location fields
      location: { label: 'Location', type: 'text', placeholder: 'Specific location or area' },
      area: { label: 'Area', type: 'text', placeholder: 'Building area or zone' },
      access_point: { label: 'Access Point', type: 'text', placeholder: 'Door, gate, or entry point' },
      
      // People fields
      people_involved: { label: 'People Involved', type: 'textarea', placeholder: 'Names and details of people involved' },
      person_name: { label: 'Person Name', type: 'text', placeholder: 'Full name' },
      visitor_name: { label: 'Visitor Name', type: 'text', placeholder: 'Full name of visitor' },
      driver_name: { label: 'Driver Name', type: 'text', placeholder: 'Full name of driver' },
      
      // Observations and issues
      observations: { label: 'Observations', type: 'textarea', placeholder: 'What was observed during the patrol' },
      issues_found: { label: 'Issues Found', type: 'textarea', placeholder: 'Any problems or concerns identified' },
      condition: { label: 'Condition', type: 'select', options: ['Good', 'Fair', 'Poor', 'Damaged'] },
      issues: { label: 'Issues', type: 'textarea', placeholder: 'Describe any issues or problems' },
      
      // Incident fields
      incident_type: { label: 'Incident Type', type: 'select', options: ['Theft', 'Vandalism', 'Trespass', 'Disturbance', 'Suspicious Activity', 'Other'] },
      severity: { label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      actions_taken: { label: 'Actions Taken', type: 'textarea', placeholder: 'Describe the response and actions taken' },
      
      // Equipment and maintenance
      equipment: { label: 'Equipment', type: 'text', placeholder: 'Equipment name or ID' },
      issue_description: { label: 'Issue Description', type: 'textarea', placeholder: 'Describe the maintenance issue' },
      priority: { label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High', 'Urgent'] },
      contractor_notified: { label: 'Contractor Notified', type: 'select', options: ['Yes', 'No', 'N/A'] },
      equipment_checked: { label: 'Equipment Checked', type: 'textarea', placeholder: 'List equipment inspected' },
      equipment_status: { label: 'Equipment Status', type: 'select', options: ['Good', 'Needs Attention', 'Faulty', 'Out of Service'] },
      
      // Vehicle fields
      vehicle_reg: { label: 'Vehicle Registration', type: 'text', placeholder: 'Registration number' },
      purpose: { label: 'Purpose', type: 'text', placeholder: 'Reason for visit or access' },
      permit_checked: { label: 'Permit Checked', type: 'select', options: ['Yes', 'No', 'N/A'] },
      
      // Visitor fields
      company: { label: 'Company', type: 'text', placeholder: 'Visitor\'s company' },
      host: { label: 'Host', type: 'text', placeholder: 'Person being visited' },
      badge_issued: { label: 'Badge Issued', type: 'select', options: ['Yes', 'No'] },
      
      // Access control
      time_granted: { label: 'Time Granted', type: 'datetime-local' },
      authority: { label: 'Authority', type: 'text', placeholder: 'Who authorized access' },
      
      // Alarm fields
      alarm_type: { label: 'Alarm Type', type: 'select', options: ['Intruder', 'Fire', 'Medical', 'Technical Fault', 'Other'] },
      cause: { label: 'Cause', type: 'text', placeholder: 'Cause of alarm activation' },
      response_time: { label: 'Response Time', type: 'text', placeholder: 'Time taken to respond (minutes)' },
      alarm_location: { label: 'Alarm Location', type: 'text', placeholder: 'Specific alarm point or zone' },
      
      // Shift fields
      handover_received: { label: 'Handover Received', type: 'textarea', placeholder: 'Key points from previous shift' },
      handover_given: { label: 'Handover Given', type: 'textarea', placeholder: 'Information passed to next shift' },
      priorities: { label: 'Priorities', type: 'textarea', placeholder: 'Key tasks and priorities for the shift' },
      outstanding_issues: { label: 'Outstanding Issues', type: 'textarea', placeholder: 'Issues that need follow-up' },
      from_officer: { label: 'From Officer', type: 'text', placeholder: 'Officer giving handover' },
      to_officer: { label: 'To Officer', type: 'text', placeholder: 'Officer receiving handover' },
      key_points: { label: 'Key Points', type: 'textarea', placeholder: 'Important information to pass on' },
      actions_required: { label: 'Actions Required', type: 'textarea', placeholder: 'Tasks that need to be completed' },
      
      // Break fields
      break_type: { label: 'Break Type', type: 'select', options: ['Meal Break', 'Rest Break', 'Toilet Break'] },
      duration: { label: 'Duration', type: 'text', placeholder: 'Duration in minutes' },
      coverage: { label: 'Coverage', type: 'text', placeholder: 'Who provided coverage during break' },
      
      // Emergency fields
      emergency_type: { label: 'Emergency Type', type: 'select', options: ['Medical', 'Fire', 'Security', 'Evacuation', 'Other'] },
      services_called: { label: 'Services Called', type: 'textarea', placeholder: 'Emergency services contacted (Police, Fire, Ambulance)' },
      casualties: { label: 'Casualties', type: 'textarea', placeholder: 'Any injuries or casualties' },
      
      // Medical fields
      patient_details: { label: 'Patient Details', type: 'textarea', placeholder: 'Patient information (name, age, condition)' },
      injury_description: { label: 'Injury Description', type: 'textarea', placeholder: 'Nature and extent of injury' },
      treatment_given: { label: 'Treatment Given', type: 'textarea', placeholder: 'First aid or treatment provided' },
      ambulance: { label: 'Ambulance Called', type: 'select', options: ['Yes', 'No'] },
      
      // Fire/Evacuation fields
      reason: { label: 'Reason', type: 'text', placeholder: 'Reason for evacuation' },
      areas_affected: { label: 'Areas Affected', type: 'textarea', placeholder: 'Which areas were evacuated' },
      people_evacuated: { label: 'People Evacuated', type: 'text', placeholder: 'Approximate number of people' },
      all_clear_time: { label: 'All Clear Time', type: 'datetime-local' },
      evacuation: { label: 'Evacuation Required', type: 'select', options: ['Yes', 'No', 'Partial'] },
      fire_service: { label: 'Fire Service Called', type: 'select', options: ['Yes', 'No'] },
      
      // Training fields
      training_type: { label: 'Training Type', type: 'text', placeholder: 'Type of training or drill' },
      participants: { label: 'Participants', type: 'textarea', placeholder: 'Who participated in the training' },
      outcome: { label: 'Outcome', type: 'textarea', placeholder: 'Results and observations from training' },
      
      // Admin fields
      task_description: { label: 'Task Description', type: 'textarea', placeholder: 'Describe the administrative task' },
      completed_by: { label: 'Completed By', type: 'text', placeholder: 'Who completed the task' },
      notes: { label: 'Notes', type: 'textarea', placeholder: 'Additional notes or comments' },
      category: { label: 'Category', type: 'text', placeholder: 'Category or classification' },
      
      // Photo field
      photos: { label: 'Photos Required', type: 'select', options: ['Yes', 'No'] }
    };
    
    return fieldConfigs[field] || { label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), type: 'text' };
  };

  const fieldConfig = getFieldConfig();

  switch (fieldConfig.type) {
    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {fieldConfig.label}
          </label>
          <select
            className="input select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select {fieldConfig.label.toLowerCase()}...</option>
            {fieldConfig.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    
    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {fieldConfig.label}
          </label>
          <textarea
            className="input textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldConfig.placeholder}
            rows="3"
          />
        </div>
      );
    
    case 'datetime-local':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {fieldConfig.label}
          </label>
          <input
            type="datetime-local"
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    
    default:
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {fieldConfig.label}
          </label>
          <input
            type="text"
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldConfig.placeholder}
          />
        </div>
      );
  }
}

// Log History Screen
function LogHistoryScreen({ user, site }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    log_type: '',
    from: '',
    to: '',
    limit: 20,
    offset: 0
  });
  const [hasMore, setHasMore] = useState(true);

  // Fetch logs
  const fetchLogs = async (isLoadMore = false) => {
    try {
      setLoading(true);
      const params = {
        site_id: site?.id,
        ...filters,
        offset: isLoadMore ? logs.length : 0
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key] && params[key] !== 0) delete params[key];
      });

      const response = await api.logs.list(params);
      const newLogs = response.data || [];
      
      if (isLoadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
      
      setHasMore(newLogs.length === filters.limit);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (site) {
      fetchLogs();
    }
  }, [site, filters.log_type, filters.from, filters.to]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, offset: 0 }));
    setLogs([]);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchLogs(true);
    }
  };

  if (!site) {
    return <Navigate to="/sites" replace />;
  }

  return (
    <div className="container py-6 pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Log History</h2>
        <p className="text-slate-600">View your recent log entries</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Log Type
            </label>
            <select
              className="input select"
              value={filters.log_type}
              onChange={(e) => handleFilterChange('log_type', e.target.value)}
            >
              <option value="">All Types</option>
              {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => (
                <option key={type} value={type}>{config.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              className="input"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              className="input"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <p className="text-red-800 font-medium">Error loading logs</p>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
          <button 
            onClick={() => fetchLogs()} 
            className="btn btn-secondary mt-3"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Logs List */}
      <div className="space-y-4">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="spinner mb-4"></div>
              <p className="text-slate-600">Loading logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No logs found</p>
            <p className="text-slate-500 text-sm mt-1">
              {filters.log_type || filters.from || filters.to 
                ? 'Try adjusting your filters' 
                : 'Start by creating your first log entry'
              }
            </p>
          </div>
        ) : (
          <>
            {logs.map((log) => (
              <LogHistoryCard key={log.id} log={log} />
            ))}
            
            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? (
                    <>
                      <div className="spinner"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Log History Card Component
function LogHistoryCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  
  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className="text-2xl flex-shrink-0">{config.icon}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{log.title}</h3>
            <span className={`status-badge status-${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-slate-500">
              {formatDateTime(log.occurred_at)}
            </span>
          </div>
          
          <p className="text-slate-600 mb-3 leading-relaxed">
            {expanded ? log.description : (
              log.description.length > 150 
                ? `${log.description.substring(0, 150)}...`
                : log.description
            )}
          </p>
          
          {/* Location */}
          {(log.latitude && log.longitude) && (
            <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
              <MapPinIcon className="w-4 h-4" />
              <span>
                {log.what3words 
                  ? `${log.what3words} (${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)})`
                  : `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`
                }
              </span>
            </div>
          )}
          
          {/* Site Info */}
          {log.site && (
            <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
              <span>📍</span>
              <span>{log.site.name}</span>
            </div>
          )}
          
          {/* Type-specific data */}
          {log.type_data && Object.keys(log.type_data).length > 0 && expanded && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Additional Details</h4>
              <div className="space-y-2">
                {Object.entries(log.type_data).map(([key, value]) => {
                  if (!value) return null;
                  return (
                    <div key={key} className="flex gap-2 text-sm">
                      <span className="font-medium text-slate-600 capitalize min-w-0">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-slate-700">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Photos indicator */}
          {log.photos && log.photos.length > 0 && (
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
              <span>📷</span>
              <span>{log.photos.length} photo{log.photos.length !== 1 ? 's' : ''} attached</span>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            {log.description.length > 150 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-[#1a52a8] hover:text-[#1a52a8] font-medium"
              >
                {expanded ? 'Show Less' : 'Show More'}
              </button>
            )}
            
            <span className="text-xs text-slate-400">
              Created {getRelativeTime(log.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tasks Screen
function TasksScreen({ user, site, shift }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, in_progress, completed

  // Fetch tasks
  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        const params = { site_id: site?.id };
        
        if (filter !== 'all') {
          params.status = filter.toUpperCase();
        }

        const response = await api.tasks.list(params);
        setTasks(response.data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (site) {
      fetchTasks();
    }
  }, [site, filter]);

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await api.tasks.update(taskId, { status: newStatus });
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: newStatus }
          : task
      ));
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task status');
    }
  };

  if (!site) {
    return <Navigate to="/sites" replace />;
  }

  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'PENDING'),
    in_progress: tasks.filter(t => t.status === 'IN_PROGRESS'),
    completed: tasks.filter(t => t.status === 'COMPLETED')
  };

  return (
    <div className="container py-6 pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Tasks</h2>
        <p className="text-slate-600">Manage your assigned tasks</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
        {[
          { key: 'all', label: 'All Tasks', count: tasks.length },
          { key: 'pending', label: 'Pending', count: tasksByStatus.pending.length },
          { key: 'in_progress', label: 'In Progress', count: tasksByStatus.in_progress.length },
          { key: 'completed', label: 'Completed', count: tasksByStatus.completed.length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-white text-slate-900 '
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <p className="text-red-800 font-medium">Error loading tasks</p>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <p className="text-slate-600">Loading tasks...</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <ClockIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No tasks found</p>
          <p className="text-slate-500 text-sm mt-1">
            Tasks will appear here when assigned by your manager
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onUpdateStatus={updateTaskStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({ task, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(false);
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'status-info';
      case 'IN_PROGRESS': return 'status-pending';
      case 'COMPLETED': return 'status-active';
      case 'CANCELLED': return 'status-alert';
      default: return 'status-info';
    }
  };

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case 'PENDING': return 'IN_PROGRESS';
      case 'IN_PROGRESS': return 'COMPLETED';
      default: return null;
    }
  };

  const getStatusLabel = (status) => {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const nextStatus = getNextStatus(task.status);

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className="text-2xl flex-shrink-0">
          {task.priority === 'HIGH' ? '🔥' :
           task.priority === 'URGENT' ? '⚡' : '📋'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{task.title}</h3>
            <span className={`status-badge ${getStatusColor(task.status)}`}>
              {getStatusLabel(task.status)}
            </span>
            {task.priority && task.priority !== 'NORMAL' && (
              <span className={`status-badge ${
                task.priority === 'URGENT' ? 'status-alert' : 'status-pending'
              }`}>
                {task.priority}
              </span>
            )}
          </div>
          
          <p className="text-slate-600 mb-3 leading-relaxed">
            {expanded ? task.description : (
              task.description && task.description.length > 120 
                ? `${task.description.substring(0, 120)}...`
                : task.description
            )}
          </p>
          
          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <ClockIcon className="w-4 h-4 text-slate-500" />
              <span className={`${
                new Date(task.due_date) < new Date() && task.status !== 'COMPLETED'
                  ? 'text-red-600 font-medium'
                  : 'text-slate-600'
              }`}>
                Due: {formatDateTime(task.due_date)}
              </span>
            </div>
          )}
          
          {/* Assigned by */}
          {task.assigned_by && (
            <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
              <UserGroupIcon className="w-4 h-4" />
              <span>Assigned by {task.assigned_by.first_name} {task.assigned_by.last_name}</span>
            </div>
          )}
          
          {/* Task Details */}
          {task.task_data && Object.keys(task.task_data).length > 0 && expanded && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Task Details</h4>
              <div className="space-y-2">
                {Object.entries(task.task_data).map(([key, value]) => {
                  if (!value) return null;
                  return (
                    <div key={key} className="flex gap-2 text-sm">
                      <span className="font-medium text-slate-600 capitalize min-w-0">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-slate-700">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            {nextStatus && (
              <button
                onClick={() => onUpdateStatus(task.id, nextStatus)}
                className={`btn btn-sm ${
                  nextStatus === 'COMPLETED' ? 'btn-success' : 'btn-primary'
                }`}
              >
                {nextStatus === 'COMPLETED' ? '✓ Complete' : 'Start Task'}
              </button>
            )}
            
            {task.description && task.description.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-[#1a52a8] hover:text-[#1a52a8] font-medium"
              >
                {expanded ? 'Show Less' : 'Show More'}
              </button>
            )}
            
            <span className="text-xs text-slate-400 ml-auto">
              Created {getRelativeTime(task.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Manager Application
function ManagerApp({ user }) {
  return (
    <div className="manager-shell">
      <ManagerSidebar user={user} />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<ManagerDashboard user={user} />} />
          <Route path="/sites"     element={<SiteManagement user={user} />} />
          <Route path="/sites/:id" element={<SiteDetail user={user} />} />
          <Route path="/team"      element={<TeamManagement user={user} />} />
          <Route path="/logs"      element={<LogReview user={user} />} />
          <Route path="/tasks"     element={<TaskAssignment user={user} />} />
          <Route path="/reports"   element={<Reporting user={user} />} />
          <Route path="/roster"    element={<ShiftRoster user={user} />} />
          <Route path="/pnl"       element={<ProfitLoss user={user} />} />
          <Route path="/docs"       element={<DocumentsScreen user={user} />} />
          <Route path="/patrols"    element={<PatrolRoutesScreen user={user} />} />
          <Route path="/patterns"   element={<ShiftPatternsScreen user={user} />} />
          <Route path="/rates"      element={<RatesScreen user={user} />} />
          <Route path="/alerts"     element={<AlertsScreen user={user} />} />
          <Route path="/policies"   element={<PoliciesScreen user={user} />} />
          <Route path="/instructions" element={<SiteInstructionsScreen user={user} />} />
          <Route path="/messages"     element={<MessagesScreen user={user} />} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}


function ManagerSidebar({ user }) {
  const location = useLocation();
  const { signOut } = useAuth();

  const nav = [
    { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
    { to: '/sites',     icon: BuildingOfficeIcon, label: 'Sites' },
    { to: '/team',      icon: UsersIcon, label: 'Team' },
    { to: '/logs',      icon: ClipboardDocumentListIcon, label: 'Log Review' },
    { to: '/tasks',     icon: ClipboardDocumentListIcon, label: 'Tasks' },
    { to: '/reports',   icon: ChartBarIcon, label: 'Reports' },
    { to: '/roster',    icon: ClockIcon,    label: 'Roster' },
    { to: '/pnl',       icon: ChartBarIcon,              label: 'P&L' },
    { to: '/docs',      icon: DocumentTextIcon,          label: 'Documents' },
    { to: '/patrols',   icon: MapPinIcon,                label: 'Patrol Routes' },
    { to: '/patterns',  icon: ClockIcon,                 label: 'Shift Patterns' },
    { to: '/rates',     icon: ChartBarIcon,              label: 'Rates' },
    { to: '/alerts',    icon: BellAlertIcon,             label: 'Alerts' },
    { to: '/policies',     icon: DocumentTextIcon, label: 'Policies' },
    { to: '/instructions', icon: DocumentTextIcon, label: 'Site Instructions' },
    { to: '/messages',     icon: BellAlertIcon,    label: 'Messages' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="wordmark"><span className="dob">DOB</span><span className="live"> Live</span></div>
        <div className="sub">Operations</div>
      </div>
      <nav className="sidebar-nav">
        {nav.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`sidebar-nav-item${location.pathname === to || location.pathname.startsWith(to + '/') ? ' active' : ''}`}
          >
            <Icon style={{width:'1rem',height:'1rem'}} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user-name">{user.first_name} {user.last_name}</div>
        <div className="sidebar-user-email">{user.email}</div>
        <button
          onClick={() => signOut()}
          style={{marginTop:'0.75rem',fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer',padding:0}}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}


function ManagerHeader({ user, title, subtitle }) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title || 'Dashboard'}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
    </div>
  );
}


function ManagerDashboard({ user }) {
  const [stats, setStats] = useState({ activeSites: 0, todayLogs: 0, pendingTasks: 0, totalUsers: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sitesRes, logsRes, tasksRes, usersRes] = await Promise.all([
          api.sites.list(),
          api.logs.list({ limit: 8 }),
          api.tasks.list({ status: 'PENDING' }),
          api.users.list(),
        ]);
        setStats({
          activeSites:  sitesRes.data?.length || 0,
          todayLogs:    logsRes.data?.length || 0,
          pendingTasks: tasksRes.data?.length || 0,
          totalUsers:   usersRes.data?.length || 0,
        });
        setRecentLogs(logsRes.data?.slice(0, 6) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',padding:'3rem'}}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
      </div>
      <div className="page-content">
        <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
          <div className="stat-card">
            <div className="stat-value">{stats.activeSites}</div>
            <div className="stat-label">Sites</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Team Members</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{color:'var(--blue)'}}>{stats.todayLogs}</div>
            <div className="stat-label">Recent Logs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{color: stats.pendingTasks > 0 ? 'var(--warning)' : 'var(--text)'}}>{stats.pendingTasks}</div>
            <div className="stat-label">Pending Tasks</div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
          <div className="card">
            <div className="section-header">
              <div className="section-title">Recent Log Entries</div>
              <Link to="/logs" style={{fontSize:'0.8125rem',color:'var(--blue)',textDecoration:'none'}}>View all</Link>
            </div>
            {recentLogs.length === 0 ? (
              <div className="empty-state"><p>No logs yet</p></div>
            ) : (
              <div>
                {recentLogs.map(log => <ManagerLogPreview key={log.id} log={log} />)}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title" style={{marginBottom:'1rem'}}>Quick Actions</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
              <Link to="/tasks" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}>
                <PlusIcon style={{width:'1rem',height:'1rem'}} /> Assign Task
              </Link>
              <Link to="/logs" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}>
                <EyeIcon style={{width:'1rem',height:'1rem'}} /> Review Logs
              </Link>
              <Link to="/sites" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}>
                <BuildingOfficeIcon style={{width:'1rem',height:'1rem'}} /> Manage Sites
              </Link>
              <Link to="/reports" className="btn btn-secondary" style={{justifyContent:'flex-start',gap:'0.5rem'}}>
                <ChartBarIcon style={{width:'1rem',height:'1rem'}} /> Reports
              </Link>
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
                  <td style={{fontWeight:500}}>{site.name}</td>
                  <td style={{color:'var(--text-2)'}}>{site.address || '—'}</td>
                  <td>
                    <span className={`badge ${site.active !== false ? 'badge-success' : 'badge-neutral'}`}>
                      {site.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
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
          onSaved={() => { setShowForm(false); load(); }}
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
    name: site?.name || '',
    address: site?.address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.name.trim()) { setError('Site name is required'); return; }
    try {
      setSaving(true);
      if (site) {
        await api.sites.update(site.id, form);
      } else {
        await api.sites.create(form);
      }
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
          <div className="modal-title">{site ? 'Edit Site' : 'Add Site'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field">
          <label className="label">Site Name</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Brindleyplace" />
        </div>
        <div className="field">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Street, City, Postcode" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}



function LogReview({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.logs.list({ limit: 100 });
        setLogs(res.data || []);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const logTypes = ['PATROL','INCIDENT','ALARM','ACCESS','VISITOR','HANDOVER','MAINTENANCE','VEHICLE','WELFARE','GENERAL'];

  const filtered = logs.filter(l => {
    if (typeFilter && l.log_type !== typeFilter) return false;
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
            style={{width:'200px'}}
            placeholder="Search logs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select className="input" style={{width:'140px'}} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
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
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover: transition-shadow">
      <div className="flex items-start gap-4">
        <div className="text-2xl">{config.icon}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h4 className="font-semibold text-slate-900">{log.title}</h4>
            <span className={`status-badge status-${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-slate-500">
              {formatDateTime(log.occurred_at)}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
            {log.site && (
              <span className="flex items-center gap-1">
                <BuildingOfficeIcon className="w-4 h-4" />
                {log.site.name}
              </span>
            )}
            {log.officer && (
              <span className="flex items-center gap-1">
                <UsersIcon className="w-4 h-4" />
                {log.officer.first_name} {log.officer.last_name}
              </span>
            )}
          </div>
          
          <p className="text-slate-700 leading-relaxed">
            {expanded ? log.description : (
              log.description?.length > 200 
                ? `${log.description.substring(0, 200)}...`
                : log.description
            )}
          </p>
          
          {log.description?.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-[#1a52a8] hover:text-[#1a52a8] font-medium mt-2"
            >
              {expanded ? 'Show Less' : 'Show More'}
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
          <textarea className="input textarea" rows={3} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Additional details..." />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    async function fetchSite() {
      try {
        setLoading(true);
        const [siteRes, logsRes] = await Promise.all([
          api.sites.get(id),
          api.logs.list({ site_id: id, limit: 10 }),
        ]);
        setSite(siteRes.data);
        setRecentLogs(logsRes.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSite();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner"></div>
    </div>
  );

  if (error || !site) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
        {error || 'Site not found'}
      </div>
      <button onClick={() => navigate('/sites')} className="btn btn-secondary">
        ← Back to Sites
      </button>
    </div>
  );

  const statusColors = {
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    INACTIVE: 'bg-slate-100 text-slate-600',
    SUSPENDED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => navigate('/sites')} className="text-slate-500 hover:text-slate-900 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
          {site.client && (
            <p className="text-slate-500 text-sm">{site.client.client_company_name}</p>
          )}
        </div>
        <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${statusColors[site.status] || statusColors.INACTIVE}`}>
          {site.status || 'ACTIVE'}
        </span>
      </div>

      {/* Site Details Card */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Site Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {site.address && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Address</p>
              <p className="text-slate-900 text-sm">{site.address}</p>
            </div>
          )}
          {site.postcode && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Postcode</p>
              <p className="text-slate-900 text-sm font-mono">{site.postcode}</p>
            </div>
          )}
          {site.what3words && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">what3words</p>
              <p className="text-slate-900 text-sm font-mono">///
{site.what3words}</p>
            </div>
          )}
          {site.contact_name && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Site Contact</p>
              <p className="text-slate-900 text-sm">{site.contact_name}</p>
              {site.contact_phone && (
                <a href={`tel:${site.contact_phone}`} className="text-[#1a52a8] text-sm hover:underline">
                  {site.contact_phone}
                </a>
              )}
            </div>
          )}
          {site.contract_start && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Contract Start</p>
              <p className="text-slate-900 text-sm">{new Date(site.contract_start).toLocaleDateString('en-GB')}</p>
            </div>
          )}
          {site.contract_end && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Contract End</p>
              <p className="text-slate-900 text-sm">{new Date(site.contract_end).toLocaleDateString('en-GB')}</p>
            </div>
          )}
        </div>
        {site.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Notes</p>
            <p className="text-slate-700 text-sm whitespace-pre-line">{site.notes}</p>
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Logs</h3>
          <span className="text-xs text-slate-400">Last 10</span>
        </div>
        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No logs recorded for this site</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <ManagerLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
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
                  <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSiteAssignOfficer(o)}>Sites</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditUser(o); setShowForm(true); }}>Edit</button>
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
          onSaved={() => { setShowForm(false); load(); }}
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
    role:       user?.role       || 'OFFICER',
    sia_licence_number: user?.sia_licence_number || '',
    sia_expiry_date:    user?.sia_expiry_date ? user.sia_expiry_date.split('T')[0] : '',
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
        sia_expiry_date:    form.sia_expiry_date || null,
      };
      if (user) {
        await api.users.update(user.id, payload);
      } else {
        await api.users.create(payload);
      }
      onSaved();
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
          <div className="modal-title">{user ? 'Edit Team Member' : 'Add Officer'}</div>
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
            {!user && <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.25rem'}}>They will sign in using this email via Clerk</div>}
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
            <input className="input" value={form.sia_licence_number} onChange={e=>f('sia_licence_number',e.target.value)} placeholder="e.g. 1234-5678-9012-3456" />
          </div>
          <div className="field">
            <label className="label">SIA Expiry</label>
            <input type="date" className="input" value={form.sia_expiry_date} onChange={e=>f('sia_expiry_date',e.target.value)} />
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
    MAINTENANCE:'#ea580c', VEHICLE:'#64748b', WELFARE:'#db2777',
    GENERAL:'#94a3b8',
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Reports</div>
        <select className="input" style={{width:'140px'}} value={dateRange} onChange={e => setDateRange(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
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
                          <div style={{width:`${(count/maxCount)*100}%`,height:'100%',background:typeColors[type]||'#94a3b8',borderRadius:'2px'}} />
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


// ── SHIFT ROSTER ─────────────────────────────────────────────────────────────
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
function DocumentsScreen({ user }) {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    api.sites.list().then(r => setSites(r.data || []));
  }, []);

  useEffect(() => {
    if (!selectedSite) { setFolders([]); setDocuments([]); return; }
    setLoading(true);
    Promise.all([
      api.folders.list({ site_id: selectedSite }),
      api.folders.documents.list({ site_id: selectedSite }),
    ]).then(([fr, dr]) => {
      setFolders(fr.data || []);
      setDocuments(dr.data || []);
    }).finally(() => setLoading(false));
  }, [selectedSite]);

  const folderDocs = selectedFolder
    ? documents.filter(d => d.folder_id === selectedFolder.id)
    : documents.filter(d => !d.folder_id);

  async function createFolder() {
    if (!newFolderName.trim() || !selectedSite) return;
    try {
      await api.folders.create({ site_id: selectedSite, name: newFolderName });
      setNewFolderName(''); setShowFolderForm(false);
      const r = await api.folders.list({ site_id: selectedSite });
      setFolders(r.data || []);
    } catch (e) { setError(e.message); }
  }

  async function deleteFolder(id) {
    if (!window.confirm('Delete this folder and all its documents?')) return;
    await api.folders.delete(id);
    setSelectedFolder(null);
    const r = await api.folders.list({ site_id: selectedSite });
    setFolders(r.data || []);
  }

  async function deleteDocument(id) {
    if (!window.confirm('Delete this document?')) return;
    await api.folders.documents.delete(id);
    const r = await api.folders.documents.list({ site_id: selectedSite });
    setDocuments(r.data || []);
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Documents</div>
        <select className="input" style={{width:'200px'}} value={selectedSite} onChange={e => { setSelectedSite(e.target.value); setSelectedFolder(null); }}>
          <option value="">Select site...</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {!selectedSite ? (
          <div className="empty-state"><p>Select a site to view documents</p></div>
        ) : loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'1.25rem'}}>
            {/* Folder sidebar */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                <div className="section-title">Folders</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowFolderForm(true)}>+ New</button>
              </div>
              {showFolderForm && (
                <div style={{marginBottom:'0.5rem',display:'flex',gap:'0.5rem'}}>
                  <input className="input" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} placeholder="Folder name" onKeyDown={e=>e.key==='Enter'&&createFolder()} />
                  <button className="btn btn-primary btn-sm" onClick={createFolder}>Add</button>
                </div>
              )}
              <div
                onClick={() => setSelectedFolder(null)}
                style={{padding:'0.5rem 0.625rem',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'0.875rem',fontWeight: !selectedFolder?600:400,background:!selectedFolder?'var(--blue-light)':'transparent',color:!selectedFolder?'var(--blue)':'var(--text)',marginBottom:'0.25rem'}}
              >
                All Documents
              </div>
              {folders.map(f => (
                <div key={f.id} style={{display:'flex',alignItems:'center',gap:'0.375rem',padding:'0.5rem 0.625rem',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'0.875rem',fontWeight:selectedFolder?.id===f.id?600:400,background:selectedFolder?.id===f.id?'var(--blue-light)':'transparent',color:selectedFolder?.id===f.id?'var(--blue)':'var(--text)',marginBottom:'0.25rem'}}
                  onClick={() => setSelectedFolder(f)}>
                  <span style={{flex:1}}>{f.name}</span>
                  <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',padding:'0 2px',fontSize:'0.75rem'}}>x</button>
                </div>
              ))}
            </div>

            {/* Documents list */}
            <div className="card">
              <div className="section-header" style={{marginBottom:'1rem'}}>
                <div className="section-title">{selectedFolder ? selectedFolder.name : 'All Documents'}</div>
                <DocumentUploadButton siteId={selectedSite} folderId={selectedFolder?.id} onUploaded={() => api.folders.documents.list({site_id:selectedSite}).then(r=>setDocuments(r.data||[]))} />
              </div>
              {folderDocs.length === 0 ? (
                <div className="empty-state"><p>No documents yet</p></div>
              ) : (
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
                  <tbody>
                    {folderDocs.map(d => (
                      <tr key={d.id}>
                        <td style={{fontWeight:500}}>{d.name}</td>
                        <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.mime_type||'—'}</td>
                        <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.file_size ? `${(d.file_size/1024).toFixed(0)} KB` : '—'}</td>
                        <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{new Date(d.created_at).toLocaleDateString('en-GB')}</td>
                        <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                          <a href={`https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/documents/${d.storage_path}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View</a>
                          <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>deleteDocument(d.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentUploadButton({ siteId, folderId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload to Supabase storage via signed URL approach
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bxesqjzkuredqzvepomn.supabase.co';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const path = `${siteId}/${folderId || 'root'}/${Date.now()}-${file.name}`;
      
      // Upload via Supabase storage REST API
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      
      // Register in database
      await api.folders.documents.create({
        site_id: siteId,
        folder_id: folderId || null,
        name: file.name,
        original_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      });
      onUploaded();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <input type="file" ref={inputRef} style={{display:'none'}} onChange={handleFile} />
      <button className="btn btn-primary btn-sm" onClick={() => inputRef.current.click()} disabled={!siteId||uploading}>
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </>
  );
}

// ── PATROL ROUTES ─────────────────────────────────────────────────────────────
function PatrolRoutesScreen({ user }) {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRoute, setEditRoute] = useState(null);

  useEffect(() => { api.sites.list().then(r => setSites(r.data||[])); }, []);

  async function load() {
    if (!selectedSite) return;
    setLoading(true);
    const r = await api.patrols.list({ site_id: selectedSite });
    setRoutes(r.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [selectedSite]);

  async function deleteRoute(id) {
    if (!window.confirm('Delete this patrol route?')) return;
    await api.patrols.delete(id);
    load();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Patrol Routes</div>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <select className="input" style={{width:'200px'}} value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
            <option value="">Select site...</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!selectedSite} onClick={() => { setEditRoute(null); setShowForm(true); }}>
            <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Route
          </button>
        </div>
      </div>
      <div className="page-content">
        {!selectedSite ? (
          <div className="empty-state"><p>Select a site to manage patrol routes</p></div>
        ) : loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : routes.length === 0 ? (
          <div className="empty-state"><p>No patrol routes for this site</p></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {routes.map(route => (
              <div key={route.id} className="card">
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{route.name}</div>
                    {route.instructions && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'0.25rem'}}>{route.instructions}</div>}
                    <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                      {(route.checkpoints||[]).map((cp, i) => (
                        <span key={cp.id} className="badge badge-navy">{i+1}. {cp.name}</span>
                      ))}
                      {(route.checkpoints||[]).length === 0 && <span style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>No checkpoints</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'0.5rem',flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditRoute(route); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => deleteRoute(route.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && (
        <PatrolRouteFormModal
          route={editRoute}
          siteId={selectedSite}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function PatrolRouteFormModal({ route, siteId, onClose, onSaved }) {
  const [name, setName] = useState(route?.name || '');
  const [instructions, setInstructions] = useState(route?.instructions || '');
  const [checkpoints, setCheckpoints] = useState(route?.checkpoints?.map(c => ({ name: c.name, instructions: c.instructions || '' })) || [{ name: '', instructions: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function addCheckpoint() { setCheckpoints(cp => [...cp, { name: '', instructions: '' }]); }
  function removeCheckpoint(i) { setCheckpoints(cp => cp.filter((_, j) => j !== i)); }
  function updateCheckpoint(i, field, val) { setCheckpoints(cp => cp.map((c, j) => j === i ? {...c, [field]: val} : c)); }

  async function save() {
    if (!name.trim()) { setError('Route name required'); return; }
    const validCps = checkpoints.filter(c => c.name.trim());
    try {
      setSaving(true);
      if (route) {
        await api.patrols.update(route.id, { name, instructions, checkpoints: validCps });
      } else {
        await api.patrols.create({ site_id: siteId, name, instructions, checkpoints: validCps });
      }
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'600px'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{route ? 'Edit Route' : 'New Patrol Route'}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field">
          <label className="label">Route Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Perimeter Check" />
        </div>
        <div className="field">
          <label className="label">Instructions</label>
          <textarea className="input" rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="General instructions for this route..." />
        </div>
        <div style={{marginBottom:'1rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <label className="label" style={{margin:0}}>Checkpoints</label>
            <button className="btn btn-ghost btn-sm" onClick={addCheckpoint}>+ Add</button>
          </div>
          {checkpoints.map((cp, i) => (
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'0.5rem',marginBottom:'0.5rem',alignItems:'center'}}>
              <input className="input" value={cp.name} onChange={e => updateCheckpoint(i, 'name', e.target.value)} placeholder={`Checkpoint ${i+1} name`} />
              <input className="input" value={cp.instructions} onChange={e => updateCheckpoint(i, 'instructions', e.target.value)} placeholder="Instructions (optional)" />
              <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => removeCheckpoint(i)}>x</button>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Route'}</button>
        </div>
      </div>
    </div>
  );
}

// ── SHIFT PATTERNS ────────────────────────────────────────────────────────────
function ShiftPatternsScreen({ user }) {
  const [patterns, setPatterns] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPattern, setEditPattern] = useState(null);

  async function load() {
    const [pr, sr] = await Promise.all([api.patterns.list(), api.sites.list()]);
    setPatterns(pr.data || []);
    setSites(sr.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const DAYS = [['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Shift Patterns</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditPattern(null); setShowForm(true); }}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Pattern
        </button>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : patterns.length === 0 ? <div className="empty-state"><p>No shift patterns yet</p></div>
        : (
          <table className="table">
            <thead><tr><th>Name</th><th>Site</th><th>Days</th><th>Hours</th><th>Pay Rate</th><th>Charge Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {patterns.map(p => (
                <tr key={p.id}>
                  <td style={{fontWeight:500}}>{p.name}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{p.site?.name||'—'}</td>
                  <td style={{fontSize:'0.8125rem'}}>
                    <div style={{display:'flex',gap:'2px',flexWrap:'wrap'}}>
                      {DAYS.map(([d,l]) => (
                        <span key={d} style={{padding:'1px 5px',borderRadius:'3px',fontSize:'0.6875rem',fontWeight:600,background:(p.days||[]).includes(d)?'var(--blue)':'var(--surface-2)',color:(p.days||[]).includes(d)?'#fff':'var(--text-3)'}}>{l}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{p.start_time}–{p.end_time}</td>
                  <td style={{fontSize:'0.8125rem'}}>{p.pay_rate ? `£${p.pay_rate}/h` : '—'}</td>
                  <td style={{fontSize:'0.8125rem'}}>{p.charge_rate ? `£${p.charge_rate}/h` : '—'}</td>
                  <td><span className={`badge ${p.active!==false?'badge-success':'badge-neutral'}`}>{p.active!==false?'Active':'Inactive'}</span></td>
                  <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditPattern(p); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPortalSite(site)}>Portal</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => { if(window.confirm('Delete pattern?')){ await api.patterns.delete(p.id); load(); }}}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <ShiftPatternFormModal pattern={editPattern} sites={sites} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ShiftPatternFormModal({ pattern, sites, onClose, onSaved }) {
  const DAYS = [['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];
  const [form, setForm] = useState({
    name: pattern?.name||'', site_id: pattern?.site_id||'',
    days: pattern?.days||[], start_time: pattern?.start_time||'07:00',
    end_time: pattern?.end_time||'19:00', pay_rate: pattern?.pay_rate||'',
    charge_rate: pattern?.charge_rate||'', notes: pattern?.notes||'',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  function toggleDay(d) { setForm(p=>({...p,days:p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d]})); }

  async function save() {
    if (!form.name||!form.site_id||form.days.length===0) { setError('Name, site and at least one day required'); return; }
    try {
      setSaving(true);
      const payload = {...form, pay_rate: form.pay_rate||null, charge_rate: form.charge_rate||null};
      if (pattern) await api.patterns.update(pattern.id, payload);
      else await api.patterns.create(payload);
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{pattern?'Edit Pattern':'New Shift Pattern'}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Pattern Name</label><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Weekday Nights" /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">Select site</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Days</label>
            <div style={{display:'flex',gap:'0.375rem'}}>
              {DAYS.map(([d,l]) => (
                <button key={d} type="button" onClick={()=>toggleDay(d)} style={{padding:'0.375rem 0.625rem',borderRadius:'4px',border:'1px solid',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',background:form.days.includes(d)?'var(--blue)':'var(--surface)',color:form.days.includes(d)?'#fff':'var(--text-2)',borderColor:form.days.includes(d)?'var(--blue)':'var(--border)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Start Time</label><input type="time" className="input" value={form.start_time} onChange={e=>f('start_time',e.target.value)} /></div>
          <div className="field"><label className="label">End Time</label><input type="time" className="input" value={form.end_time} onChange={e=>f('end_time',e.target.value)} /></div>
          <div className="field"><label className="label">Pay Rate (£/hr)</label><input type="number" step="0.01" className="input" value={form.pay_rate} onChange={e=>f('pay_rate',e.target.value)} /></div>
          <div className="field"><label className="label">Charge Rate (£/hr)</label><input type="number" step="0.01" className="input" value={form.charge_rate} onChange={e=>f('charge_rate',e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── RATES ─────────────────────────────────────────────────────────────────────
function RatesScreen({ user }) {
  const [rates, setRates] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [rr, ur, sr] = await Promise.all([api.rates.list(), api.users.list(), api.sites.list()]);
    setRates(rr.data||[]);
    setOfficers((ur.data||[]).filter(u=>u.role==='OFFICER'));
    setSites(sr.data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Officer Rates</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}><PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Rate</button>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : rates.length===0 ? <div className="empty-state"><p>No rates configured</p></div>
        : (
          <table className="table">
            <thead><tr><th>Officer</th><th>Site</th><th>Role</th><th>Rate</th><th>From</th><th></th></tr></thead>
            <tbody>
              {rates.map(r=>(
                <tr key={r.id}>
                  <td style={{fontWeight:500}}>{r.officer?`${r.officer.first_name} ${r.officer.last_name}`:'—'}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{r.site?.name||'All sites'}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{r.role_label||'—'}</td>
                  <td style={{fontWeight:600}}>£{r.hourly_rate}/hr</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{new Date(r.effective_from).toLocaleDateString('en-GB')}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async()=>{ if(window.confirm('Remove this rate?')){ await api.rates.delete(r.id); load(); }}}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <RateFormModal officers={officers} sites={sites} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();}} />}
    </div>
  );
}

function RateFormModal({ officers, sites, onClose, onSaved }) {
  const [form, setForm] = useState({ officer_id:'', site_id:'', hourly_rate:'', role_label:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    if (!form.officer_id||!form.hourly_rate) { setError('Officer and rate required'); return; }
    try { setSaving(true); await api.rates.create({...form, site_id:form.site_id||null}); onSaved(); }
    catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Add Officer Rate</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Officer</label>
            <select className="input" value={form.officer_id} onChange={e=>f('officer_id',e.target.value)}>
              <option value="">Select officer</option>
              {officers.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Site (optional)</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Hourly Rate (£)</label><input type="number" step="0.01" className="input" value={form.hourly_rate} onChange={e=>f('hourly_rate',e.target.value)} placeholder="e.g. 13.50" /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Role Label</label><input className="input" value={form.role_label} onChange={e=>f('role_label',e.target.value)} placeholder="e.g. Door Supervisor" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save Rate'}</button>
        </div>
      </div>
    </div>
  );
}

// ── ALERTS ────────────────────────────────────────────────────────────────────
function AlertsScreen({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('open');

  async function load() {
    const [ar, sr] = await Promise.all([api.alerts.list(), api.sites.list()]);
    setAlerts(ar.data||[]);
    setSites(sr.data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const filtered = alerts.filter(a => a.status === tab);
  const severityBadge = { low:'badge-neutral', medium:'badge-warning', high:'badge-danger', critical:'badge-danger' };

  async function resolve(id) {
    await api.alerts.update(id, { status:'resolved' });
    load();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Alerts</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}><PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Raise Alert</button>
      </div>
      <div className="page-content">
        <div className="tabs">
          {[['open','Open'],['resolved','Resolved']].map(([val,label])=>(
            <button key={val} className={`tab${tab===val?' active':''}`} onClick={()=>setTab(val)}>{label}</button>
          ))}
        </div>
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : filtered.length===0 ? <div className="empty-state"><p>No {tab} alerts</p></div>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {filtered.map(a=>(
              <div key={a.id} className="card" style={{borderLeft:`3px solid ${a.severity==='high'||a.severity==='critical'?'var(--danger)':a.severity==='medium'?'var(--warning)':'var(--border)'}`}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
                      <span style={{fontWeight:600}}>{a.title}</span>
                      <span className={`badge ${severityBadge[a.severity]||'badge-neutral'}`}>{a.severity}</span>
                    </div>
                    {a.description && <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>{a.description}</div>}
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>
                      {a.site?.name||''}{a.site?' · ':''}{new Date(a.created_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  {tab==='open' && (
                    <button className="btn btn-secondary btn-sm" onClick={()=>resolve(a.id)}>Resolve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && <AlertFormModal sites={sites} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();}} />}
    </div>
  );
}

function AlertFormModal({ sites, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', description:'', site_id:'', severity:'medium' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    if (!form.title.trim()) { setError('Title required'); return; }
    try { setSaving(true); await api.alerts.create({...form, site_id:form.site_id||null}); onSaved(); }
    catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Raise Alert</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Title</label><input className="input" value={form.title} onChange={e=>f('title',e.target.value)} placeholder="Brief description of the issue" /></div>
        <div className="field"><label className="label">Details</label><textarea className="input" rows={3} value={form.description} onChange={e=>f('description',e.target.value)} placeholder="Additional details..." /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Severity</label>
            <select className="input" value={form.severity} onChange={e=>f('severity',e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Raise Alert'}</button>
        </div>
      </div>
    </div>
  );
}

// ── COMPANY POLICIES ──────────────────────────────────────────────────────────
function PoliciesScreen({ user }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const canEdit = ['COMPANY','SUPER_ADMIN'].includes(user.role);

  useEffect(() => {
    api.policies.get().then(r => { setSections(r.data?.sections || []); setLoading(false); });
  }, []);

  function addSection() { setSections(s => [...s, { title:'', content:'' }]); }
  function updateSection(i, field, val) { setSections(s => s.map((sec,j) => j===i ? {...sec,[field]:val} : sec)); }
  function removeSection(i) { setSections(s => s.filter((_,j) => j!==i)); }

  async function save() {
    try {
      setSaving(true); setError(null);
      await api.policies.update(sections);
      setSuccess(true); setTimeout(()=>setSuccess(false), 2000);
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Company Policies</div>
        {canEdit && (
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="btn btn-ghost btn-sm" onClick={addSection}>+ Add Section</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save Policies'}</button>
          </div>
        )}
      </div>
      <div className="page-content">
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>Policies saved</div>}
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : sections.length===0 ? (
          <div className="empty-state">
            <p>No policy sections yet</p>
            {canEdit && <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={addSection}>Add First Section</button>}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {sections.map((sec,i) => (
              <div key={i} className="card">
                {canEdit ? (
                  <>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                      <input className="input" value={sec.title} onChange={e=>updateSection(i,'title',e.target.value)} placeholder="Section title" style={{fontWeight:600,fontSize:'1rem'}} />
                      <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',marginLeft:'0.5rem'}} onClick={()=>removeSection(i)}>Remove</button>
                    </div>
                    <textarea className="input" rows={6} value={sec.content} onChange={e=>updateSection(i,'content',e.target.value)} placeholder="Policy content..." />
                  </>
                ) : (
                  <>
                    <div style={{fontWeight:600,marginBottom:'0.5rem'}}>{sec.title}</div>
                    <div style={{fontSize:'0.875rem',color:'var(--text-2)',whiteSpace:'pre-line'}}>{sec.content}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ── SITE INSTRUCTIONS (MANAGER) ───────────────────────────────────────────────
function SiteInstructionsScreen({ user }) {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { api.sites.list().then(r => setSites(r.data||[])); }, []);

  useEffect(() => {
    if (!selectedSite) { setSections([]); return; }
    setLoading(true);
    api.instructions.get(selectedSite).then(r => {
      setSections(r.data?.sections || []);
      setLoading(false);
    });
  }, [selectedSite]);

  function addSection() { setSections(s => [...s, { title:'', content:'' }]); }
  function update(i, field, val) { setSections(s => s.map((sec,j) => j===i ? {...sec,[field]:val} : sec)); }
  function remove(i) { setSections(s => s.filter((_,j) => j!==i)); }

  async function save() {
    if (!selectedSite) return;
    try {
      setSaving(true); setError(null);
      await api.instructions.update(selectedSite, sections);
      setSuccess(true); setTimeout(()=>setSuccess(false), 2000);
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Site Instructions</div>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <select className="input" style={{width:'200px'}} value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
            <option value="">Select site...</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedSite && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={addSection}>+ Section</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </>
          )}
        </div>
      </div>
      <div className="page-content">
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>Instructions saved</div>}
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {!selectedSite ? (
          <div className="empty-state"><p>Select a site to edit its instructions</p></div>
        ) : loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {sections.length === 0 && (
              <div className="empty-state">
                <p>No instructions yet</p>
                <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={addSection}>Add First Section</button>
              </div>
            )}
            {sections.map((sec,i) => (
              <div key={i} className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                  <input className="input" value={sec.title} onChange={e=>update(i,'title',e.target.value)} placeholder="Section title" style={{fontWeight:600}} />
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',marginLeft:'0.5rem'}} onClick={()=>remove(i)}>Remove</button>
                </div>
                <textarea className="input" rows={5} value={sec.content} onChange={e=>update(i,'content',e.target.value)} placeholder="Instructions content..." />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
function MessagesScreen({ user }) {
  const [messages, setMessages] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [mr, ur] = await Promise.all([api.messages.list(), api.users.list()]);
    setMessages(mr.data||[]);
    setOfficers((ur.data||[]).filter(u => u.id !== user.id));
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Messages</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> New Message
        </button>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : messages.length===0 ? <div className="empty-state"><p>No messages yet</p></div>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
            {messages.map(m => (
              <div key={m.id} className="card" style={{padding:'0.875rem'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
                      <span style={{fontWeight:600,fontSize:'0.875rem'}}>
                        {m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown'}
                      </span>
                      {m.recipient && (
                        <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>
                          to {m.recipient.first_name} {m.recipient.last_name}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:'0.875rem',color:'var(--text-2)'}}>{m.body}</div>
                  </div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>
                    {new Date(m.created_at||'').toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && <NewMessageModal officers={officers} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();}} />}
    </div>
  );
}

function NewMessageModal({ officers, onClose, onSaved }) {
  const [form, setForm] = useState({ recipient_id:'', body:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!form.body.trim()) { setError('Message body required'); return; }
    try {
      setSaving(true);
      await api.messages.create({ recipient_id: form.recipient_id||null, body: form.body });
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">New Message</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">To (leave blank for all)</label>
          <select className="input" value={form.recipient_id} onChange={e=>setForm(f=>({...f,recipient_id:e.target.value}))}>
            <option value="">All officers</option>
            {officers.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
          </select>
        </div>
        <div className="field"><label className="label">Message</label>
          <textarea className="input" rows={4} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} placeholder="Your message..." />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving}>{saving?'Sending...':'Send'}</button>
        </div>
      </div>
    </div>
  );
}


function OfficerInstructionsScreen({ user, site }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!site?.id) { setLoading(false); return; }
    api.instructions.get(site.id).then(r => { setData(r.data); setLoading(false); });
  }, [site?.id]);

  if (!site) return (
    <div style={{padding:'1.5rem'}}>
      <div className="empty-state"><p>Select a site first</p></div>
    </div>
  );

  return (
    <div style={{padding:'1rem'}}>
      <h2 style={{fontWeight:600,marginBottom:'1rem',fontSize:'1rem'}}>{site.name} — Site Instructions</h2>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>
      : !data || data.sections?.length===0 ? <div className="empty-state"><p>No instructions for this site</p></div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
          {data.sections.map((sec, i) => (
            <div key={i} className="card">
              <div style={{fontWeight:600,marginBottom:'0.375rem'}}>{sec.title}</div>
              <div style={{fontSize:'0.875rem',color:'var(--text-2)',whiteSpace:'pre-line'}}>{sec.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OfficerPoliciesScreen({ user }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.policies.get().then(r => { setSections(r.data?.sections||[]); setLoading(false); });
  }, []);

  return (
    <div style={{padding:'1rem'}}>
      <h2 style={{fontWeight:600,marginBottom:'1rem',fontSize:'1rem'}}>Company Policies</h2>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>
      : sections.length===0 ? <div className="empty-state"><p>No policies published yet</p></div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
          {sections.map((sec,i) => (
            <div key={i} className="card">
              <div style={{fontWeight:600,marginBottom:'0.375rem'}}>{sec.title}</div>
              <div style={{fontSize:'0.875rem',color:'var(--text-2)',whiteSpace:'pre-line'}}>{sec.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function OfficerNavigation() {
  const location = useLocation();
  const nav = [
    { to: '/',      icon: HomeIcon,                   label: 'Home' },
    { to: '/log',   icon: PlusIcon,                   label: 'Log Entry' },
    { to: '/logs',  icon: ClipboardDocumentListIcon,  label: 'History' },
    { to: '/tasks',        icon: ClipboardDocumentListIcon, label: 'Tasks' },
    { to: '/instructions', icon: DocumentTextIcon,          label: 'Site Info' },
  ];
  return (
    <nav className="officer-nav">
      {nav.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          className={`officer-nav-item${location.pathname === to ? ' active' : ''}`}
        >
          <Icon style={{width:'1.25rem',height:'1.25rem'}} />
          {label}
        </Link>
      ))}
    </nav>
  );
}


export default App;
