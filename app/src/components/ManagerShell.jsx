import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import { ManagerDashboard, SiteManagement, LogReview, TaskAssignment, SiteDetail, TeamManagement, Reporting } from './ManagerScreens';
import { ShiftRoster, ProfitLoss } from './RosterPnL';
import { DocumentsScreen, PatrolRoutesScreen, ShiftPatternsScreen, RatesScreen, AlertsScreen, PoliciesScreen, SiteInstructionsScreen, MessagesScreen } from './ManagerFeatures';
import { PortalSettingsModal } from './Portal';
import { ContractsScreen } from './ContractsScreen';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

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
          <Route path="/contracts"   element={<ContractsScreen user={user} />} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}


function ManagerSidebar({ user }) {
  const location = useLocation();
  const { signOut } = useAuth();

  const navGroups = [
    {
      label: null,
      items: [
        { to: '/dashboard', icon: HomeIcon,                  label: 'Dashboard' },
        { to: '/alerts',    icon: BellAlertIcon,             label: 'Alerts' },
        { to: '/messages',  icon: BellAlertIcon,             label: 'Messages' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { to: '/logs',      icon: ClipboardDocumentListIcon, label: 'Log Review' },
        { to: '/tasks',     icon: ClipboardDocumentListIcon, label: 'Tasks' },
        { to: '/sites',     icon: BuildingOfficeIcon,        label: 'Sites' },
        { to: '/team',      icon: UsersIcon,                 label: 'Team' },
      ]
    },
    {
      label: 'Scheduling',
      items: [
        { to: '/roster',    icon: ClockIcon,                 label: 'Roster' },
        { to: '/patterns',  icon: ClockIcon,                 label: 'Shift Patterns' },
        { to: '/pnl',       icon: ChartBarIcon,              label: 'P&L' },
        { to: '/rates',     icon: ChartBarIcon,              label: 'Rates' },
        { to: '/reports',   icon: ChartBarIcon,              label: 'Reports' },
      ]
    },
    {
      label: 'Site Config',
      items: [
        { to: '/docs',         icon: DocumentTextIcon, label: 'Documents' },
        { to: '/patrols',      icon: MapPinIcon,       label: 'Patrol Routes' },
        { to: '/instructions', icon: DocumentTextIcon, label: 'Instructions' },
        { to: '/policies',     icon: DocumentTextIcon, label: 'Policies' },
      ]
    },
    {
      label: 'Commercial',
      items: [
        { to: '/contracts', icon: DocumentTextIcon, label: 'Contracts' },
      ]
    },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="wordmark"><span className="dob">DOB</span><span className="live"> Live</span></div>
        <div className="sub">Operations</div>
      </div>
      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div style={{padding:'0.625rem 1rem 0.25rem',fontSize:'0.625rem',fontWeight:600,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.1em'}}>
                {group.label}
              </div>
            )}
            {group.items.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`sidebar-nav-item${location.pathname === to || location.pathname.startsWith(to + '/') ? ' active' : ''}`}
              >
                <Icon style={{width:'1rem',height:'1rem'}} />
                {label}
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
