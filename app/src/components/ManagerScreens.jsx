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
          <input className="officer-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Brindleyplace" />
        </div>
        <div className="field">
          <label className="label">Address</label>
          <input className="officer-input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Street, City, Postcode" />
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

  const logTypes = ['PATROL','INCIDENT','ALARM','ACCESS','VISITOR','HANDOVER','MAINTENANCE','VEHICLE','GENERAL'];

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
            className="officer-input"
            style={{width:'200px'}}
            placeholder="Search logs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select className="officer-input" style={{width:'140px'}} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
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
        <div style={{width:'2.5rem',height:'2.5rem',background:'var(--navy)',color:'#fff',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.625rem',fontWeight:700,letterSpacing:'0.05em',flexShrink:0}}>{config.icon}</div>
        
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
          <input className="officer-input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="What needs to be done?" />
        </div>
        <div className="field">
          <label className="label">Description</label>
          <textarea className="officer-input" rows={3} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Additional details..." />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">Assign To</label>
            <select className="officer-input" value={form.assigned_to} onChange={e => setForm(f=>({...f,assigned_to:e.target.value}))}>
              <option value="">Unassigned</option>
              {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Site</label>
            <select className="officer-input" value={form.site_id} onChange={e => setForm(f=>({...f,site_id:e.target.value}))}>
              <option value="">No site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label">Due Date</label>
          <input type="date" className="officer-input" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} />
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
            <input className="officer-input" value={form.first_name} onChange={e=>f('first_name',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Last Name</label>
            <input className="officer-input" value={form.last_name} onChange={e=>f('last_name',e.target.value)} />
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Email</label>
            <input type="email" className="officer-input" value={form.email} onChange={e=>f('email',e.target.value)} disabled={!!user} />
            {!user && <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'0.25rem'}}>They will sign in using this email via Clerk</div>}
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input className="officer-input" value={form.phone} onChange={e=>f('phone',e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Role</label>
            <select className="officer-input" value={form.role} onChange={e=>f('role',e.target.value)}>
              <option value="OFFICER">Officer</option>
              <option value="OPS_MANAGER">Ops Manager</option>
              <option value="FD">Field Director</option>
              <option value="COMPANY">Admin</option>
            </select>
          </div>
          <div className="field">
            <label className="label">SIA Licence No.</label>
            <input className="officer-input" value={form.sia_licence_number} onChange={e=>f('sia_licence_number',e.target.value)} placeholder="e.g. 1234-5678-9012-3456" />
          </div>
          <div className="field">
            <label className="label">SIA Expiry</label>
            <input type="date" className="officer-input" value={form.sia_expiry_date} onChange={e=>f('sia_expiry_date',e.target.value)} />
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
        <select className="officer-input" style={{width:'140px'}} value={dateRange} onChange={e => setDateRange(e.target.value)}>
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

export { ManagerDashboard };
export { SiteManagement };
export { LogReview };
export { TaskAssignment };
export { SiteDetail };
export { TeamManagement };
export { Reporting };
