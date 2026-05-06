import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import { ManagerDashboard, SiteManagement, LogReview, TaskAssignment, SiteDetail, TeamManagement, Reporting, OnDutyScreen, PatrolHistoryScreen } from './ManagerScreens';
import { ProfitLoss, ShiftRoster } from './RosterPnL';
import { DocumentsScreen, PatrolRoutesScreen, ShiftPatternsScreen, RatesScreen, AlertsScreen, PoliciesScreen, SiteInstructionsScreen, MessagesScreen } from './ManagerFeatures';
import { PortalSettingsModal } from './Portal';
import { ContractsScreen } from './ContractsScreen';
import { ManagerUpdatesPanel } from './CompanyUpdates';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function ManagerApp({ user }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  return (
    <div className="manager-shell">
      {/* Mobile hamburger */}
      <div className="mobile-topbar">
        <button onClick={() => setSidebarOpen(true)} style={{background:'none',border:'none',color:'#fff',fontSize:'1.5rem',cursor:'pointer',padding:'0.25rem'}}>☰</button>
        <div style={{fontSize:'0.9375rem',fontWeight:700,color:'#fff'}}>{user.logo_url ? <img src={user.logo_url} alt="" style={{maxHeight:'36px',objectFit:'contain'}} /> : <><span style={{color:'var(--blue)'}}>DOB</span> Live</>}</div>
        <div style={{width:'28px'}} />
      </div>
      {/* Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <ManagerSidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<ManagerDashboard user={user} />} />
          <Route path="/on-duty"   element={<OnDutyScreen user={user} />} />
          <Route path="/sites"     element={<SiteManagement user={user} />} />
          <Route path="/sites/:id" element={<SiteDetail user={user} />} />
          <Route path="/team"      element={<TeamManagement user={user} />} />
          <Route path="/logs"      element={<LogReview user={user} />} />
          <Route path="/assignments" element={<TaskAssignment user={user} />} />
          <Route path="/reports"   element={<Reporting user={user} />} />
          <Route path="/roster"    element={<ShiftRoster user={user} />} />
          <Route path="/pnl"       element={<ProfitLoss user={user} />} />
          <Route path="/docs"       element={<DocumentsScreen user={user} />} />
          <Route path="/patrols"    element={<PatrolRoutesScreen user={user} />} />
          <Route path="/patrol-history" element={<PatrolHistoryScreen user={user} />} />
          <Route path="/patterns"   element={<ShiftPatternsScreen user={user} />} />
          <Route path="/rates"      element={<RatesScreen user={user} />} />
          <Route path="/alerts"     element={<AlertsScreen user={user} />} />
          <Route path="/policies"   element={<PoliciesScreen user={user} />} />
          <Route path="/instructions" element={<SiteInstructionsScreen user={user} />} />
          <Route path="/messages"     element={<MessagesScreen user={user} />} />
          <Route path="/contracts"   element={<ContractsScreen user={user} />} />
          <Route path="/updates"     element={<div className="page-content"><ManagerUpdatesPanel /></div>} />
          <Route path="/portal-settings" element={<PortalManagement user={user} />} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}


function ManagerSidebar({ user, open, onClose }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [commentCount, setCommentCount] = React.useState(0);

  React.useEffect(() => {
    async function fetchComments() {
      try {
        const res = await api.updates.list();
        const total = (res.data || []).reduce((sum, u) => sum + (u.comment_count || 0), 0);
        setCommentCount(total);
      } catch {}
    }
    fetchComments();
    const t = setInterval(fetchComments, 60000);
    return () => clearInterval(t);
  }, []);

  const perms = user.permissions || [];
  const hasAccess = (section) => user.role === 'SUPER_ADMIN' || perms.includes(section);

  const allGroups = [
    {
      label: null, section: null,
      items: [
        { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
      ]
    },
    {
      label: 'Operations', section: 'operations', color: '#3b82f6',
      items: [
        { to: '/on-duty',   icon: UsersIcon,                  label: 'Officers On Duty' },
        { to: '/alerts',    icon: BellAlertIcon,             label: 'Alerts' },
        { to: '/logs',      icon: ClipboardDocumentListIcon, label: 'Daily Occurrence Books' },
        { to: '/sites',     icon: BuildingOfficeIcon,        label: 'Sites' },
        { to: '/reports',   icon: ChartBarIcon,              label: 'Reports' },
      ]
    },
    {
      label: 'Scheduling', section: 'scheduling', color: '#f59e0b',
      items: [
        { to: '/roster',    icon: ClockIcon,                 label: 'Roster' },
        { to: '/patterns',  icon: ClockIcon,                 label: 'Shift Patterns' },
      ]
    },
    {
      label: 'Client Portal', section: 'client_portal', color: '#10b981',
      items: [
        { to: '/portal-settings', icon: EyeIcon, label: 'Portal Settings' },
      ]
    },
    {
      label: 'HR', section: 'hr', color: '#ec4899',
      items: [
        { to: '/team',      icon: UsersIcon,                 label: 'Team' },
        { to: '/rates',     icon: ChartBarIcon,              label: 'Pay Rates' },
        { to: '/updates',   icon: DocumentTextIcon,          label: 'Company Updates', badge: commentCount || null },
      ]
    },
    {
      label: 'Site Config', section: 'site_config', color: '#8b5cf6',
      items: [
        { to: '/docs',         icon: DocumentTextIcon, label: 'Documents' },
        { to: '/instructions', icon: DocumentTextIcon, label: 'Assignment Instructions' },
        { to: '/patrols',      icon: MapPinIcon,       label: 'Patrol Routes' },
        { to: '/patrol-history', icon: ClockIcon,       label: 'Patrol History' },
      ]
    },
    {
      label: 'P&L', section: 'pnl', color: '#14b8a6',
      items: [
        { to: '/pnl', icon: ChartBarIcon, label: 'P&L Dashboard' },
        { to: '/contracts', icon: DocumentTextIcon, label: 'Contracts' },
      ]
    },
    {
      label: 'Compliance', section: 'compliance', color: '#ef4444',
      items: [
        { to: '/policies',     icon: DocumentTextIcon, label: 'Policies' },
      ]
    },
  ];

  const navGroups = allGroups.filter(g => !g.section || hasAccess(g.section));

  return (
    <div className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <div className="sidebar-logo">
        {user.logo_url ? (
          <img src={user.logo_url} alt="Company logo" style={{maxHeight:'72px',maxWidth:'100%',objectFit:'contain'}} />
        ) : (
          <div className="wordmark"><span className="dob">DOB</span><span className="live"> Live</span></div>
        )}
        <div className="sub">Operations</div>
        {['COMPANY','SUPER_ADMIN'].includes(user.role) && (
          <label style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)',cursor:'pointer',marginTop:'0.25rem'}}>
            Change logo
            <input type="file" accept="image/*" style={{display:'none'}} onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const res = await api.companies.uploadLogo(file);
                if (res.logo_url) window.location.reload();
              } catch (err) { alert('Upload failed: ' + err.message); }
            }} />
          </label>
        )}
      </div>
      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <>
                <div style={{margin:'0.5rem 1rem 0',borderTop:'1px solid rgba(255,255,255,0.08)'}} />
                <div style={{padding:'0.75rem 1rem 0.25rem',fontSize:'0.6875rem',fontWeight:700,color: group.color || 'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                  {group.label}
                </div>
              </>
            )}
            {group.items.map(({ to, icon: Icon, label, badge }) => (
              <Link
                key={to}
                to={to}
                onClick={() => onClose?.()}
                className={`sidebar-nav-item${location.pathname === to || location.pathname.startsWith(to + '/') ? ' active' : ''}`}
                style={{display:'flex',alignItems:'center',gap:'0.5rem'}}
              >
                <Icon style={{width:'1rem',height:'1rem'}} />
                <span style={{flex:1}}>{label}</span>
                {badge > 0 && <span style={{background:'#1a52a8',color:'#fff',fontSize:'0.625rem',fontWeight:700,padding:'0.125rem 0.375rem',borderRadius:'8px',minWidth:'16px',textAlign:'center'}}>{badge}</span>}
              </Link>
            ))}
          </div>
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
        <div style={{marginTop:'0.5rem',fontSize:'10px',color:'rgba(255,255,255,0.35)'}}>v {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'}</div>
      </div>
    </div>
  );
}


function PortalManagement({ user }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSite, setEditSite] = useState(null);

  useEffect(() => {
    api.sites.list().then(r => setSites(r.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="topbar"><div className="topbar-title">Client Portal</div></div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div> : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {sites.map(s => (
              <div key={s.id} className="card" style={{padding:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'0.25rem'}}>
                    {s.client_portal_enabled ? <span style={{color:'#10b981',fontWeight:600}}>Portal active</span> : <span style={{color:'var(--text-3)'}}>Portal off</span>}
                    {s.client_portal_pin && <span style={{marginLeft:'0.75rem',color:'var(--text-3)'}}>PIN: {s.client_portal_pin}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditSite(s)}>Settings</button>
              </div>
            ))}
          </div>
        )}
        {editSite && <PortalSettingsModal site={editSite} onClose={() => setEditSite(null)} onSaved={() => { setEditSite(null); api.sites.list().then(r => setSites(r.data || [])); }} />}
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

export { ManagerApp };
