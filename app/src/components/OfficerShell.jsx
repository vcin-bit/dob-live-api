import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import { LogEntryScreen, LogHistoryScreen } from './OfficerLog';
import { TasksScreen } from './OfficerTasks';
import { OfficerInstructionsScreen, OfficerPoliciesScreen, OfficerNavigation } from './OfficerInfo';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

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
      <div className="logo" style={{flexShrink:0}}><span className="dob">DOB</span><span className="live"> Live</span></div>
      <div style={{textAlign:'right',minWidth:0,overflow:'hidden'}}>
        {selectedSite && <div style={{fontSize:'0.8125rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'180px'}}>{selectedSite.name}</div>}
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
    <div style={{padding:'1.25rem',paddingBottom:'5rem'}}>
      <div style={{marginBottom:'1.5rem'}}>
        <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>Select Your Site</h2>
        <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)'}}>Choose which site you are working at today</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
        {sites.length === 0 ? (
          <div style={{textAlign:'center',padding:'3rem 1rem',color:'rgba(255,255,255,0.3)'}}>
            <MapPinIcon style={{width:'2.5rem',height:'2.5rem',margin:'0 auto 0.75rem'}} />
            <p style={{fontSize:'0.875rem'}}>No sites assigned. Contact your manager.</p>
          </div>
        ) : (
          sites.map((site) => (
            <button
              key={site.id}
              onClick={() => handleSiteSelect(site)}
              style={{background:'#1a2235',border:'1.5px solid rgba(255,255,255,0.08)',borderRadius:'10px',padding:'1rem',textAlign:'left',cursor:'pointer',width:'100%',transition:'border-color 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--blue)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
            >
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.75rem'}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:'1rem',fontWeight:600,color:'#fff',marginBottom:'0.25rem'}}>{site.name}</div>
                  {site.address && <div style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{site.address}</div>}
                </div>
                <ArrowRightOnRectangleIcon style={{width:'1.25rem',height:'1.25rem',color:'rgba(255,255,255,0.3)',flexShrink:0}} />
              </div>
            </button>
          ))
        )}
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
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      {/* Primary action */}
      <Link to="/log" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',fontSize:'1.0625rem'}}>
        <PlusIcon style={{width:'1.25rem',height:'1.25rem'}} />
        New Log Entry
      </Link>

      {/* Task badge */}
      {tasks.length > 0 && (
        <Link to="/tasks" className="officer-action-btn secondary" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
          <span>Tasks</span>
          <span style={{background:'var(--blue)',color:'#fff',borderRadius:'999px',padding:'2px 8px',fontSize:'0.8125rem',fontWeight:700}}>{tasks.length}</span>
        </Link>
      )}

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.625rem',marginBottom:'1.25rem'}}>
        <div className="officer-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'1.75rem',fontWeight:700,color:'#fff'}}>{recentLogs.length}</div>
          <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Logs Today</div>
        </div>
        <div className="officer-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'1.75rem',fontWeight:700,color: shift ? '#4ade80' : 'rgba(255,255,255,0.3)'}}>{shift ? 'ON' : 'OFF'}</div>
          <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Shift Status</div>
        </div>
      </div>

      {/* Recent logs */}
      <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.625rem'}}>Recent Activity</div>
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      ) : recentLogs.length === 0 ? (
        <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>No recent logs</div>
      ) : (
        recentLogs.map((log) => <LogPreviewCard key={log.id} log={log} />)
      )}
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({ to, icon, title, subtitle }) {
  return (
    <Link to={to} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.875rem',background:'#1a2235',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',textDecoration:'none',color:'#fff',transition:'border-color 0.15s'}}
      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
    >
      <span style={{color:'rgba(255,255,255,0.5)'}}>{icon}</span>
      <div>
        <div style={{fontSize:'0.875rem',fontWeight:600}}>{title}</div>
        {subtitle && <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)'}}>{subtitle}</div>}
      </div>
    </Link>
  );
}


function LogPreviewCard({ log }) {
  const typeMap = {
    PATROL:'PAT', INCIDENT:'INC', ALARM:'ALM', ACCESS:'ACC',
    VISITOR:'VIS', HANDOVER:'HND', MAINTENANCE:'MNT', VEHICLE:'VEH',
    KEYHOLDING:'KEY', GENERAL:'GEN',
  };
  const code = typeMap[log.log_type] || log.log_type?.slice(0,3) || 'LOG';
  return (
    <div className="officer-log-item">
      <div className="officer-log-type">{code}</div>
      <div style={{flex:1,minWidth:0}}>
        <div className="officer-log-title">{log.title || log.log_type || 'Log Entry'}</div>
        <div className="officer-log-meta">
          {log.site?.name && `${log.site.name} · `}
          {log.occurred_at ? new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
        </div>
      </div>
    </div>
  );
}


function TaskPreviewCard({ task }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem',background:'rgba(255,255,255,0.05)',borderRadius:'8px'}}>
      <div style={{width:'2.25rem',height:'2.25rem',background:'rgba(26,82,168,0.3)',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <ClipboardDocumentListIcon style={{width:'1rem',height:'1rem',color:'#60a5fa'}} />
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:'0.875rem',fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.title}</div>
        {task.description && <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.description}</div>}
      </div>
    </div>
  );
}

export { OfficerApp };
