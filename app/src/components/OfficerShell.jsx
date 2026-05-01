import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import { LogEntryScreen, LogHistoryScreen } from './OfficerLog';
import { TasksScreen } from './OfficerTasks';
import { OfficerInstructionsScreen, OfficerPoliciesScreen, OfficerNavigation } from './OfficerInfo';
import OfficerProfile from './OfficerProfile';
import PlaybookAlerts from './PlaybookAlerts';
import PatrolScreen, { PatrolHistoryOfficerScreen } from './PatrolScreen';
import { HandoverScreen } from './HandoverScreen';
import OfficerVisitorsScreen from './OfficerVisitors';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function OfficerApp({ user }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [lastPatrolTime, setLastPatrolTime] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const [rosterShift, setRosterShift] = useState(null);
  const [noRosterShift, setNoRosterShift] = useState(false);
  const [handover, setHandover] = useState(null);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverAcked, setHandoverAcked] = useState(false);

  async function loadHandover() {
    if (!selectedSite) return;
    setHandoverLoading(true);
    try {
      const now = new Date();
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);

      // Get previous shift at this site (last COMPLETED shift)
      const prevShiftsRes = await api.shifts.list({ site_id: selectedSite.id, status: 'COMPLETED' });
      const prevShifts = (prevShiftsRes.data || []).sort((a,b) => new Date(b.checked_out_at || b.end_time) - new Date(a.checked_out_at || a.end_time));
      const prevShift = prevShifts[0] || null;

      // Get logs from previous shift period
      let logs = [];
      if (prevShift) {
        const from = prevShift.checked_in_at || prevShift.start_time;
        const to = prevShift.checked_out_at || prevShift.end_time || now.toISOString();
        const logsRes = await api.logs.list({ site_id: selectedSite.id, from, to, limit: 200 });
        logs = (logsRes.data || []).filter(l => !l.type_data?.checkpoint);
      }

      // Get visitors still on site
      let visitors = [];
      try {
        const visRes = await api.visitors.list({ site_id: selectedSite.id, status: 'on_site' });
        visitors = visRes.data || [];
      } catch {}

      // Get playbook tasks completion
      let tasksDone = [];
      try {
        const pbRes = await api.playbooks.get(selectedSite.id);
        tasksDone = (pbRes.tasks || []);
      } catch {}

      const incidents = logs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type));
      const genInfo = logs.filter(l => l.log_type === 'GENERAL' && !l.type_data?.shift_event && !l.type_data?.scheduled_task_id);
      const openIncidents = incidents.filter(l => l.review_status !== 'RESOLVED');

      setHandover({
        prevShift,
        prevOfficer: prevShift?.officer ? `${prevShift.officer.first_name} ${prevShift.officer.last_name}` : 'Unknown',
        prevStart: prevShift?.checked_in_at || prevShift?.start_time,
        prevEnd: prevShift?.checked_out_at || prevShift?.end_time,
        incidents,
        openIncidents,
        genInfo,
        visitors,
        tasksDone,
        logs,
      });
    } catch (e) { console.error('Handover load failed:', e); setHandover({ prevShift: null, prevOfficer: 'N/A', incidents: [], openIncidents: [], genInfo: [], visitors: [], tasksDone: [], logs: [] }); }
    finally { setHandoverLoading(false); }
  }

  async function startShift() {
    if (!selectedSite) return;
    try {
      let lat, lng;
      try {
        const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000}));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {}

      // Find the SCHEDULED roster shift for this officer at this site (today or tonight)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();
      const scheduled = await api.shifts.list({ officer_id: user.id, status: 'SCHEDULED', site_id: selectedSite.id });
      const rShift = (scheduled.data || []).find(s => s.start_time >= todayStart && s.start_time < tomorrowEnd);

      if (!rShift) {
        setNoRosterShift(true);
        return;
      }

      // Activate the roster shift
      const r = await api.shifts.checkin(rShift.id, { lat, lng });
      setActiveShift(r.data);
      setRosterShift(rShift);
    } catch (err) { alert(err.message); }
  }

  async function endShift() {
    if (!activeShift) return;
    try {
      await api.shifts.checkout(activeShift.id);
      setActiveShift(null);
    } catch (err) { console.error(err.message); }
  }

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
        } else {
          // Check for a scheduled shift today — auto-select that site
          try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
            const schedRes = await api.shifts.list({ officer_id: user.id, status: 'SCHEDULED' });
            const todayShift = (schedRes.data || []).find(s => s.start_time >= todayStart && s.start_time < todayEnd);
            if (todayShift?.site) {
              setSelectedSite(todayShift.site);
              setRosterShift(todayShift);
            } else if ((sitesResponse.data || []).length === 1) {
              setSelectedSite(sitesResponse.data[0]);
            }
          } catch {}
        }
      } catch (err) {
        console.error('Failed to fetch officer data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOfficerData();
  }, [user]);

  // Check for roster shift on lock screen
  useEffect(() => {
    if (!selectedSite || activeShift) return;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();
    api.shifts.list({ officer_id: user.id, status: 'SCHEDULED', site_id: selectedSite.id })
      .then(res => {
        const rShift = (res.data || []).find(s => s.start_time >= todayStart && s.start_time < tomorrowEnd);
        if (rShift) { setRosterShift(rShift); setNoRosterShift(false); }
        else { setRosterShift(null); setNoRosterShift(true); }
      }).catch(() => setNoRosterShift(true));
  }, [selectedSite, activeShift]);

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,marginBottom:'1.5rem'}}>
            <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
          </div>
          <div className="spinner" style={{borderTopColor:'#1a52a8',borderColor:'rgba(255,255,255,0.1)',width:'2rem',height:'2rem',margin:'0 auto'}}/>
        </div>
      </div>
    );
  }

  // If no site selected and not on site picker page, redirect to site picker
  if (!selectedSite && location.pathname !== '/sites') {
    return <Navigate to="/sites" replace />;
  }

  // LOCK SCREEN — must go on duty before accessing anything
  if (selectedSite && !activeShift) {
    return (
      <div style={{minHeight:'100vh',background:'#0b1222',display:'flex',flexDirection:'column'}}>
        <OfficerHeader user={user} selectedSite={selectedSite} activeShift={null} />
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}}>
          <div style={{width:'100%',maxWidth:'360px',textAlign:'center'}}>
            <div style={{width:56,height:56,borderRadius:'12px',background:'rgba(26,82,168,0.15)',border:'1px solid rgba(26,82,168,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.25rem'}}>
              <span style={{fontSize:'1.5rem',fontWeight:800,color:'#1a52a8'}}>RS</span>
            </div>
            <div style={{fontSize:'1.25rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem'}}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user.first_name}
            </div>
            <div style={{fontSize:'0.9375rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>{selectedSite.name}</div>
            {rosterShift && (
              <div style={{fontSize:'0.9375rem',color:'#fff',marginBottom:'0.5rem',fontWeight:600}}>
                Your shift: {new Date(rosterShift.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} – {rosterShift.end_time ? new Date(rosterShift.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) : '?'}
              </div>
            )}
            <div style={{fontSize:'0.8125rem',color:'rgba(74,222,128,0.6)',marginBottom:'1.5rem',fontStyle:'italic'}}>Have a safe shift</div>
            {noRosterShift && <div style={{padding:'0.75rem',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',marginBottom:'1rem',fontSize:'0.8125rem',color:'#ef4444'}}>No shift scheduled for you at this site. Contact your manager.</div>}

            {/* Step 1: Load handover */}
            {!handover && !handoverLoading && !noRosterShift && (
              <button onClick={loadHandover}
                style={{width:'100%',padding:'18px',background:'rgba(74,222,128,0.15)',border:'2px solid rgba(74,222,128,0.5)',borderRadius:'12px',color:'#4ade80',fontSize:'1.125rem',fontWeight:700,cursor:'pointer'}}>
                GO ON DUTY
              </button>
            )}
            {handoverLoading && <div style={{padding:'1rem',color:'rgba(255,255,255,0.4)',fontSize:'0.875rem'}}>Loading handover...</div>}

            {/* Step 2: Show handover */}
            {handover && !handoverAcked && (
              <div style={{textAlign:'left',width:'100%'}}>
                <div style={{fontSize:'0.75rem',fontWeight:700,color:'#3b82f6',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.75rem'}}>Shift Handover</div>

                {/* Previous shift */}
                <div style={{padding:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',marginBottom:'0.625rem',fontSize:'0.8125rem'}}>
                  <div style={{fontWeight:600,color:'#fff',marginBottom:'0.25rem'}}>Previous Shift</div>
                  {handover.prevShift ? (
                    <div style={{color:'rgba(255,255,255,0.5)'}}>
                      {handover.prevOfficer} · {new Date(handover.prevStart).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}–{new Date(handover.prevEnd).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} · {new Date(handover.prevStart).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/London'})}
                    </div>
                  ) : <div style={{color:'rgba(255,255,255,0.3)'}}>No previous shift data</div>}
                </div>

                {/* Incidents */}
                <div style={{padding:'0.75rem',background: handover.incidents.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',border:`1px solid ${handover.incidents.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,borderRadius:'8px',marginBottom:'0.625rem',fontSize:'0.8125rem'}}>
                  <div style={{fontWeight:600,color: handover.incidents.length > 0 ? '#ef4444' : '#fff',marginBottom:'0.25rem'}}>Incidents ({handover.incidents.length})</div>
                  {handover.incidents.length === 0 ? <div style={{color:'rgba(255,255,255,0.3)'}}>No incidents last shift</div> : (
                    handover.incidents.map((l,i) => <div key={i} style={{color:'rgba(255,255,255,0.5)',marginTop:'0.25rem'}}>• {l.title} — {new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</div>)
                  )}
                  {handover.openIncidents.length > 0 && <div style={{color:'#ef4444',fontWeight:600,marginTop:'0.375rem'}}>⚠ {handover.openIncidents.length} unresolved</div>}
                </div>

                {/* Gen info */}
                {handover.genInfo.length > 0 && (
                  <div style={{padding:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',marginBottom:'0.625rem',fontSize:'0.8125rem'}}>
                    <div style={{fontWeight:600,color:'#fff',marginBottom:'0.25rem'}}>General Info ({handover.genInfo.length})</div>
                    {handover.genInfo.slice(0,5).map((l,i) => <div key={i} style={{color:'rgba(255,255,255,0.5)',marginTop:'0.25rem'}}>• {l.title || l.description?.slice(0,60)}</div>)}
                  </div>
                )}

                {/* Visitors on site */}
                {handover.visitors.length > 0 && (
                  <div style={{padding:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',marginBottom:'0.625rem',fontSize:'0.8125rem'}}>
                    <div style={{fontWeight:600,color:'#fff',marginBottom:'0.25rem'}}>Visitors On Site ({handover.visitors.length})</div>
                    {handover.visitors.map((v,i) => <div key={i} style={{color:'rgba(255,255,255,0.5)',marginTop:'0.25rem'}}>• {v.visitor_name || v.name}</div>)}
                  </div>
                )}

                {/* Acknowledge */}
                <button onClick={() => {
                  setHandoverAcked(true);
                  // Log the acknowledgement
                  api.logs.create({ site_id: selectedSite.id, log_type: 'GENERAL', title: `Handover Acknowledged — ${user.first_name} ${user.last_name}`, description: `Incoming officer acknowledged shift handover from ${handover.prevOfficer || 'previous shift'}.`, occurred_at: new Date().toISOString(), type_data: { shift_event: 'HANDOVER_ACK', prev_officer: handover.prevOfficer } }).catch(() => {});
                }} style={{width:'100%',padding:'16px',background:'rgba(59,130,246,0.15)',border:'2px solid rgba(59,130,246,0.5)',borderRadius:'12px',color:'#60a5fa',fontSize:'1rem',fontWeight:700,cursor:'pointer',marginTop:'0.5rem'}}>
                  I ACKNOWLEDGE THIS HANDOVER
                </button>
              </div>
            )}

            {/* Step 3: Go on duty */}
            {handoverAcked && (
              <button onClick={startShift}
                style={{width:'100%',padding:'18px',background:'rgba(74,222,128,0.15)',border:'2px solid rgba(74,222,128,0.5)',borderRadius:'12px',color:'#4ade80',fontSize:'1.125rem',fontWeight:700,cursor:'pointer'}}>
                GO ON DUTY
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="officer-shell">
      <PlaybookAlerts user={user} site={selectedSite} shift={activeShift} lastPatrolTime={lastPatrolTime} onTaskDismissed={() => setLastPatrolTime(new Date().toISOString())} />
      <OfficerHeader user={user} selectedSite={selectedSite} activeShift={activeShift} />
      <div className="officer-content">

      <Routes>
        <Route path="/sites" element={
          activeShift ? <Navigate to="/" replace /> :
          <SitePickerScreen
            sites={sites}
            onSiteSelect={(site) => { setSelectedSite(site); }}
            user={user}
          />
        } />
        <Route path="/" element={
          <OfficerDashboard 
            user={user}
            site={selectedSite}
            shift={activeShift}
            onStartShift={startShift}
            onEndShift={endShift}
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
        <Route path="/assignments" element={
          <TasksScreen 
            user={user}
            site={selectedSite}
            shift={activeShift}
          />
        } />
        <Route path="/instructions" element={<OfficerInstructionsScreen user={user} site={selectedSite} />} />
        <Route path="/patrol"   element={<PatrolScreen user={user} site={selectedSite} shift={activeShift} />} />
        <Route path="/patrol-history" element={<PatrolHistoryOfficerScreen user={user} site={selectedSite} />} />
        <Route path="/handover" element={<HandoverScreen user={user} site={selectedSite} shift={activeShift} onShiftEnded={() => { setActiveShift(null); }} />} />
        <Route path="/visitors" element={<OfficerVisitorsScreen site={selectedSite} />} />
          <Route path="/profile" element={<OfficerProfile user={user} />} />
        <Route path="/policies" element={<OfficerPoliciesScreen user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      <OfficerNavigation onSignOut={async () => {
        if (activeShift) {
          // Check if shift was already expired by cron
          try {
            const check = await api.shifts.list({ officer_id: user.id, status: 'ACTIVE' });
            if (!check.data || check.data.length === 0) {
              // Shift was expired — allow sign out
              setActiveShift(null);
              signOut();
              return;
            }
          } catch {}
          // Still active — block
          return;
        }
        signOut();
      }} />

    </div>
  );
}

// Officer Header
function OfficerHeader({ user, selectedSite, activeShift, onSignOut }) {
  return (
    <div className="officer-header">
      {user.logo_url ? (
        <img src={user.logo_url} alt="Logo" style={{maxHeight:'32px',maxWidth:'120px',objectFit:'contain',flexShrink:0}} />
      ) : (
        <div className="logo" style={{flexShrink:0}}><span className="dob">DOB</span><span className="live"> Live</span></div>
      )}
      <div style={{textAlign:'right',minWidth:0,overflow:'hidden'}}>
        {selectedSite && <div style={{fontSize:'0.8125rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'160px'}}>{selectedSite.name}</div>}
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
function OfficerDashboard({ user, site, shift, onStartShift, onEndShift }) {
  const [recentLogs, setRecentLogs] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
  const [taskModal, setTaskModal] = useState(null);
  const [taskNotes, setTaskNotes] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [showCheckCall, setShowCheckCall] = useState(false);
  const [checkPin, setCheckPin] = useState('');
  const [checkCallSubmitting, setCheckCallSubmitting] = useState(false);
  const [checkCallDue, setCheckCallDue] = useState(false);
  const [lastCheckCall, setLastCheckCall] = useState(null);
  const [checkCallConfirmed, setCheckCallConfirmed] = useState(false);
  const [activePatrol, setActivePatrol] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [historyDate, setHistoryDate] = useState('');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Get recent logs for this officer at this site
        const [logsResponse, todayResponse, tasksResponse, playbookRes] = await Promise.all([
          api.logs.list({ site_id: site?.id, limit: 20, officer_id: user.id }),
          api.logs.list({ site_id: site?.id, officer_id: user.id, from: todayStart, limit: 500 }),
          api.tasks.list({ site_id: site?.id, status: 'PENDING' }),
          api.playbooks.get(site?.id).catch(() => ({ tasks: [] })),
        ]);
        setRecentLogs(logsResponse.data || []);
        setTodayCount((todayResponse.data || []).length);
        setTasks(tasksResponse.data || []);
        // Filter scheduled tasks for today's day of week
        const today = new Date().getDay();
        const todayTasks = (playbookRes.tasks || []).filter(t => !t.days_of_week || t.days_of_week.includes(today));
        setScheduledTasks(todayTasks);
        // Check which tasks were completed today
        const done = new Set();
        (todayResponse.data || []).forEach(l => { if (l.type_data?.scheduled_task_id) done.add(l.type_data.scheduled_task_id); });
        setCompletedTaskIds(done);
        // Set last check call from server data
        const lastSafetyCheck = (todayResponse.data || []).find(l => l.type_data?.check_call === true && !l.type_data?.missed_check);
        if (lastSafetyCheck) setLastCheckCall(new Date(lastSafetyCheck.occurred_at));
        // Check for active patrol + last completed patrol time
        try {
          const patrolRes = await api.patrols.activeSession(site.id);
          setActivePatrol(!!patrolRes.data);
        } catch { setActivePatrol(false); }
        // Load last completed patrol session time
        try {
          const sessionsRes = await api.patrols.listSessions({ site_id: site.id, status: 'completed', limit: 1 });
          const lastSession = (sessionsRes.data || [])[0];
          if (lastSession?.ended_at) setLastPatrolTime(lastSession.ended_at);
        } catch {}

      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
        setLastUpdated(new Date());
      }
    }

    if (site) {
      fetchDashboardData();
      // Auto-refresh every 60s
      const interval = setInterval(fetchDashboardData, 60000);
      return () => clearInterval(interval);
    }
  }, [site, user]);

  // Hourly check call timer — uses lastCheckCall from server data (set in dashboard fetch)
  useEffect(() => {
    if (!shift) { setCheckCallDue(false); return; }
    const check = () => {
      // Use server-loaded lastCheckCall, or shift checked_in_at from current active shift
      const last = lastCheckCall || (shift.checked_in_at ? new Date(shift.checked_in_at) : new Date());
      const elapsed = (Date.now() - last.getTime()) / 60000;
      if (elapsed >= 55 && elapsed < 40000) { // Due at 55 mins, cap at ~28 days to catch stale data
        setCheckCallDue(true);
        try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); o.frequency.value = 800; o.connect(ctx.destination); o.start(); setTimeout(() => o.stop(), 500); } catch {}
      } else {
        setCheckCallDue(false);
      }
    };
    // Don't run timer until dashboard has loaded (lastCheckCall will be set from server)
    const delay = setTimeout(check, 3000);
    const t = setInterval(check, 60000);
    return () => { clearTimeout(delay); clearInterval(t); };
  }, [shift, lastCheckCall]);

  // Fetch logs for selected history date
  useEffect(() => {
    if (!historyDate || !site) { setHistoryLogs([]); return; }
    setHistoryLoading(true);
    const from = new Date(historyDate + 'T00:00:00').toISOString();
    const to = new Date(historyDate + 'T23:59:59').toISOString();
    api.logs.list({ site_id: site.id, officer_id: user.id, from, to, limit: 100 })
      .then(res => setHistoryLogs(res.data || []))
      .catch(() => setHistoryLogs([]))
      .finally(() => setHistoryLoading(false));
  }, [historyDate, site?.id]);
  
  if (!site) {
    return <Navigate to="/sites" replace />;
  }
  
  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      {/* Shift status */}
      {shift ? (
        <div style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'10px',padding:'0.875rem 1rem',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',animation:'pulse 2s infinite'}} />
              <span style={{fontSize:'0.8125rem',fontWeight:700,color:'#4ade80'}}>On Duty</span>
              <span style={{color:'rgba(255,255,255,0.3)'}}>—</span>
              <span style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.6)'}}>{site?.name}</span>
            </div>
            <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)',marginTop:'0.25rem'}}>
              {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/London'})}
            </div>
          </div>
        </div>
      ) : (
        <div style={{marginBottom:'0.75rem'}}>
        </div>
      )}

      {/* Primary actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.625rem',marginBottom:'0.625rem'}}>
        <Link to="/patrol" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',fontSize:'0.9375rem',marginBottom:0,background: activePatrol ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.12)',borderColor: activePatrol ? 'rgba(251,191,36,0.4)' : 'rgba(74,222,128,0.3)',color: activePatrol ? '#fbbf24' : '#4ade80'}}>
          <MapPinIcon style={{width:'1.125rem',height:'1.125rem'}} />
          {activePatrol ? 'Resume Patrol' : 'Start Patrol'}
        </Link>
        <Link to="/patrol-history" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',fontSize:'0.875rem',marginBottom:0,background:'rgba(59,130,246,0.08)',borderColor:'rgba(59,130,246,0.25)',color:'#60a5fa'}}>
          <ClockIcon style={{width:'1rem',height:'1rem'}} />
          Patrol History
        </Link>
        <Link to="/log?type=GENERAL" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',fontSize:'0.9375rem',marginBottom:0,background:'rgba(239,68,68,0.12)',borderColor:'rgba(239,68,68,0.3)',color:'#ef4444'}}>
          Log an Incident
        </Link>
        <Link to="/log?type=GENERAL_INFO" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',fontSize:'0.875rem',marginBottom:0}}>
          <PlusIcon style={{width:'1rem',height:'1rem'}} />
          Gen Info
        </Link>
        <Link to="/log?type=CCTV_CHECK" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',fontSize:'0.875rem',marginBottom:0}}>
          CCTV Patrol
        </Link>
        <Link to="/log?type=VISITOR" className="officer-action-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',fontSize:'0.875rem',marginBottom:0}}>
          Visitor / Contractor
        </Link>
      </div>

      {/* Check Call + Panic */}
      {shift && (
        <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.625rem'}}>
          <button onClick={() => { setShowCheckCall(true); setCheckPin(''); }}
            style={{flex:2,padding:'0.875rem',background: checkCallDue ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.1)',border:`2px solid ${checkCallDue ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.25)'}`,borderRadius:'10px',color: checkCallDue ? '#ef4444' : '#60a5fa',fontSize:'0.9375rem',fontWeight:700,cursor:'pointer',animation: checkCallDue ? 'pulse 1s infinite' : 'none'}}>
            📞 {checkCallDue ? 'SAFETY CHECK DUE' : 'Safety Check'}
          </button>
          <button onClick={async () => {
            if (!confirm('ACTIVATE PANIC ALERT? This will immediately alert the control room.')) return;
            let lat, lng;
            try { const p = await new Promise((r,j) => navigator.geolocation.getCurrentPosition(r,j,{timeout:5000})); lat = p.coords.latitude; lng = p.coords.longitude; } catch {}
            try { await api.escalation.panic({ site_id: site?.id, shift_id: shift?.id, lat, lng }); } catch {}
          }} style={{flex:1,padding:'0.875rem',background:'rgba(239,68,68,0.2)',border:'2px solid rgba(239,68,68,0.5)',borderRadius:'10px',color:'#ef4444',fontSize:'0.9375rem',fontWeight:700,cursor:'pointer'}}>
            🚨 SOS
          </button>
        </div>
      )}

      {/* Check Call PIN Modal */}
      {showCheckCall && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'320px',textAlign:'center'}}>
            <div style={{fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'4px'}}>Safety Check</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)',marginBottom:'20px'}}>Enter your PIN to confirm</div>
            <input type="text" inputMode="numeric" maxLength={4} value={checkPin} onChange={e => setCheckPin(e.target.value.replace(/\D/g,''))}
              autoFocus placeholder="● ● ● ●"
              style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1.5px solid rgba(59,130,246,0.3)',borderRadius:'10px',padding:'16px',fontSize:'28px',color:'#fff',textAlign:'center',letterSpacing:'0.5em',boxSizing:'border-box',fontFamily:'monospace'}} />
            <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
              <button onClick={() => setShowCheckCall(false)}
                style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Cancel</button>
              <button disabled={checkPin.length !== 4 || checkCallSubmitting} onClick={async () => {
                setCheckCallSubmitting(true);
                let lat, lng;
                try { const p = await new Promise((r,j) => navigator.geolocation.getCurrentPosition(r,j,{timeout:5000})); lat = p.coords.latitude; lng = p.coords.longitude; } catch {}
                try {
                  await api.escalation.checkCall({ pin: checkPin, site_id: site?.id, shift_id: shift?.id, lat, lng });
                  setLastCheckCall(new Date());
                  setCheckCallDue(false);
                  setShowCheckCall(false);
                  setCheckCallConfirmed(true);
                  setTimeout(() => setCheckCallConfirmed(false), 3000);
                } catch (e) {
                  alert(e.message || 'Invalid PIN');
                }
                finally { setCheckCallSubmitting(false); }
              }} style={{flex:2,padding:'13px',background:'rgba(74,222,128,0.15)',border:'1.5px solid rgba(74,222,128,0.4)',borderRadius:'10px',color:'#4ade80',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity: checkPin.length === 4 ? 1 : 0.5}}>
                {checkCallSubmitting ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
            {!user.safe_pin && (
              <div style={{marginTop:'12px',fontSize:'11px',color:'#f59e0b'}}>No PIN set — go to Profile to set your safe & duress PINs</div>
            )}
          </div>
        </div>
      )}

      {/* Safety Check Confirmation */}
      {checkCallConfirmed && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#0f1929',borderRadius:'16px',padding:'2rem 3rem',textAlign:'center'}}>
            <div style={{fontSize:'3rem',marginBottom:'0.5rem'}}>✓</div>
            <div style={{fontSize:'18px',fontWeight:700,color:'#4ade80',marginBottom:'4px'}}>Safety Check Confirmed</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>Logged at {new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</div>
          </div>
        </div>
      )}

      {/* On Site Now */}
      <Link to="/visitors" className="officer-action-btn secondary" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.625rem'}}>
        <span>👥 Visitors / Contractors On Site Now</span>
      </Link>


      {/* Today's scheduled tasks */}
      {scheduledTasks.length > 0 && (
        <div style={{marginBottom:'1rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Today's Tasks</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            {scheduledTasks.map(t => {
              const done = completedTaskIds.has(t.id);
              return (
                <div key={t.id} onClick={() => { if (!done) { setTaskModal(t); setTaskNotes(''); } }}
                  style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.625rem 0.75rem',background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',border:`1px solid ${done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}`,borderRadius:'8px',cursor: done ? 'default' : 'pointer'}}>
                  <div style={{width:24,height:24,borderRadius:'50%',background: done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'12px',color: done ? '#10b981' : 'rgba(255,255,255,0.3)',fontWeight:700}}>
                    {done ? '✓' : '○'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.875rem',fontWeight:600,color: done ? 'rgba(255,255,255,0.5)' : '#fff'}}>{t.name}</div>
                    <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)'}}>
                      {t.scheduled_time ? t.scheduled_time.slice(0,5) : 'Shift start'}
                      {t.description && <span style={{marginLeft:'0.5rem'}}>· {t.description}</span>}
                      {done && <span style={{color:'#10b981',marginLeft:'0.5rem'}}>Done</span>}
                    </div>
                  </div>
                  {!done && <span style={{color:'rgba(255,255,255,0.2)',fontSize:'1rem'}}>›</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task completion modal */}
      {taskModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px'}}>
            <div style={{fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'4px'}}>{taskModal.name}</div>
            {taskModal.description && <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)',marginBottom:'12px'}}>{taskModal.description}</div>}
            {taskModal.contact_name && (
              <div style={{padding:'8px 10px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'8px',marginBottom:'12px',fontSize:'13px'}}>
                <span style={{color:'#fbbf24',fontWeight:600}}>{taskModal.contact_name}</span>
                {taskModal.contact_phone && <span style={{color:'#fff',fontFamily:'monospace',marginLeft:'8px'}}>{taskModal.contact_phone}</span>}
              </div>
            )}
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:'6px'}}>Notes</label>
              <textarea value={taskNotes} onChange={e => setTaskNotes(e.target.value)} rows={3}
                placeholder="Add any notes, observations..."
                style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px',fontSize:'14px',color:'#fff',resize:'none',boxSizing:'border-box',fontFamily:'inherit'}} />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              <button disabled={taskSubmitting} onClick={async () => {
                setTaskSubmitting(true);
                try {
                  const validLogTypes = ['INCIDENT','PATROL','HEALTH_SAFETY','MEDICAL','VEHICLE_CHECK','CCTV_PATROL','GENERAL','WELFARE_CHECK','CCTV_CHECK','MANAGEMENT_VISIT','VISITOR','ACCESS_CONTROL','MAINTENANCE','HANDOVER','ALARM','FIRE_ALARM','EMERGENCY'];
                  const logType = validLogTypes.includes(taskModal.task_type) ? taskModal.task_type : 'GENERAL';
                  await api.logs.create({ site_id: site?.id, shift_id: shift?.id || null, log_type: logType, title: `✓ ${taskModal.name}`, description: taskNotes.trim() || `Task completed: ${taskModal.name}`, occurred_at: new Date().toISOString(), type_data: { scheduled_task_id: taskModal.id, task_type: taskModal.task_type } });
                  setCompletedTaskIds(prev => new Set([...prev, taskModal.id]));
                  setTaskModal(null);
                } catch (e) { alert(e.message); }
                finally { setTaskSubmitting(false); }
              }} style={{width:'100%',padding:'14px',background:'rgba(74,222,128,0.15)',border:'1.5px solid rgba(74,222,128,0.4)',borderRadius:'10px',color:'#4ade80',fontSize:'15px',fontWeight:700,cursor:'pointer'}}>
                {taskSubmitting ? 'Saving...' : '✓ TASK COMPLETE'}
              </button>
              <button disabled={taskSubmitting} onClick={async () => {
                if (!taskNotes.trim()) { alert('Please add a reason'); return; }
                setTaskSubmitting(true);
                try {
                  const validLogTypes = ['INCIDENT','PATROL','HEALTH_SAFETY','MEDICAL','VEHICLE_CHECK','CCTV_PATROL','GENERAL','WELFARE_CHECK','CCTV_CHECK','MANAGEMENT_VISIT','VISITOR','ACCESS_CONTROL','MAINTENANCE','HANDOVER','ALARM','FIRE_ALARM','EMERGENCY'];
                  const logType = validLogTypes.includes(taskModal.task_type) ? taskModal.task_type : 'GENERAL';
                  await api.logs.create({ site_id: site?.id, shift_id: shift?.id || null, log_type: logType, title: `✗ ${taskModal.name} — Unable to complete`, description: taskNotes.trim(), occurred_at: new Date().toISOString(), type_data: { scheduled_task_id: taskModal.id, task_type: taskModal.task_type, unable: true } });
                  setCompletedTaskIds(prev => new Set([...prev, taskModal.id]));
                  setTaskModal(null);
                } catch (e) { alert(e.message); }
                finally { setTaskSubmitting(false); }
              }} style={{width:'100%',padding:'12px',background:'rgba(239,68,68,0.1)',border:'1.5px solid rgba(239,68,68,0.3)',borderRadius:'10px',color:'#ef4444',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                UNABLE TO COMPLETE
              </button>
              <button onClick={() => setTaskModal(null)}
                style={{width:'100%',padding:'10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'rgba(255,255,255,0.4)',fontSize:'13px',cursor:'pointer'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
          <span style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)'}}>
            Updated {lastUpdated.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
          </span>
          <button
            onClick={() => { setLoading(true); /* trigger re-fetch via state change */ setLastUpdated(null); }}
            style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)',background:'none',border:'none',cursor:'pointer',padding:0}}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.625rem',marginBottom:'1.25rem'}}>
        <div className="officer-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'1.75rem',fontWeight:700,color:'#fff'}}>{todayCount}</div>
          <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Logs Today</div>
        </div>
        <div className="officer-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'1.75rem',fontWeight:700,color:'#fff'}}>{tasks.length}</div>
          <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Tasks Due</div>
        </div>
      </div>

      {/* Recent logs */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.625rem'}}>
        <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Recent Activity</div>
        <Link to="/logs" style={{fontSize:'0.75rem',color:'#60a5fa',textDecoration:'none',fontWeight:500}}>View All →</Link>
      </div>
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      ) : recentLogs.length === 0 ? (
        <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>No recent logs</div>
      ) : (
        recentLogs.filter(l => !l.type_data?.checkpoint).map((log) => <LogPreviewCard key={log.id} log={log} />)
      )}

      {/* Occurrence History */}
      <div style={{marginTop:'1.25rem',borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.625rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Log History</div>
          <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
            style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'0.375rem 0.5rem',fontSize:'0.75rem',color:'#fff',fontFamily:'inherit'}} />
        </div>
        {historyDate && (
          historyLoading ? (
            <div style={{display:'flex',justifyContent:'center',padding:'1rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)',width:'1.25rem',height:'1.25rem'}} /></div>
          ) : historyLogs.length === 0 ? (
            <div style={{textAlign:'center',padding:'1rem',color:'rgba(255,255,255,0.3)',fontSize:'0.8125rem'}}>No logs for {new Date(historyDate + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
          ) : (
            <>
              <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.3)',marginBottom:'0.5rem'}}>{historyLogs.length} log{historyLogs.length!==1?'s':''} on {new Date(historyDate + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
              {historyLogs.map(log => <LogPreviewCard key={log.id} log={log} />)}
            </>
          )
        )}
      </div>
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
          {log.occurred_at ? new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) : ''}
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
