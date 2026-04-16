import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

// Clerk configuration
const clerkPubKey = 'pk_test_c3BlY2lhbC1ib2JjYXQtNDguY2xlcmsuYWNjb3VudHMuZGV2JA';

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key")
}

// Main App with Clerk Provider
function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <Router>
        <div className="min-h-screen bg-slate-50">
          <SignedOut>
            <div className="min-h-screen flex items-center justify-center">
              <AuthFlow />
            </div>
          </SignedOut>
          <SignedIn>
            <AuthenticatedApp />
          </SignedIn>
        </div>
      </Router>
    </ClerkProvider>
  );
}

// Auth flow for signed-out users
function AuthFlow() {
  const [mode, setMode] = useState('signin');
  
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">DOB Live</h1>
        <p className="text-slate-600">Security Officer Portal</p>
      </div>
      
      {mode === 'signin' ? (
        <div className="space-y-4">
          <SignIn 
            routing="hash" 
            signUpUrl="#sign-up"
            appearance={{
              elements: {
                formButtonPrimary: 'btn btn-primary',
                card: 'shadow-lg border-0'
              }
            }}
          />
          <p className="text-center text-sm text-slate-600">
            Need an account?{' '}
            <button
              onClick={() => setMode('signup')}
              className="text-cyan-600 hover:text-cyan-500 font-medium"
            >
              Sign up
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <SignUp 
            routing="hash" 
            signInUrl="#sign-in"
            appearance={{
              elements: {
                formButtonPrimary: 'btn btn-primary',
                card: 'shadow-lg border-0'
              }
            }}
          />
          <p className="text-center text-sm text-slate-600">
            Already have an account?{' '}
            <button
              onClick={() => setMode('signin')}
              className="text-cyan-600 hover:text-cyan-500 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      )}
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
        // Get sites for this officer
        const sitesResponse = await api.sites.list();
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
    <div className="min-h-screen">
      <OfficerHeader user={user} selectedSite={selectedSite} activeShift={activeShift} />
      
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <OfficerNavigation />
    </div>
  );
}

// Officer Header
function OfficerHeader({ user, selectedSite, activeShift }) {
  const { signOut } = useAuth();
  
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-slate-900">DOB Live</h1>
          {selectedSite && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <MapPinIcon className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">{selectedSite.name}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {activeShift && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-700">On Duty</span>
            </div>
          )}
          <UserButton 
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8'
              }
            }}
            userProfileMode="navigation"
            userProfileUrl="/profile"
          />
        </div>
      </div>
    </header>
  );
}

// Site Picker Screen
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
                className="card text-left hover:shadow-lg transition-all p-6 border-2 border-transparent hover:border-cyan-200"
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
    accent: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700',
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

// Placeholder screens (will build these next)
function LogEntryScreen({ user, site, shift }) {
  return (
    <div className="container py-6 pb-24">
      <h2 className="text-2xl font-bold mb-4">New Log Entry</h2>
      <p className="text-slate-600">Log entry form will be implemented next...</p>
    </div>
  );
}

function LogHistoryScreen({ user, site }) {
  return (
    <div className="container py-6 pb-24">
      <h2 className="text-2xl font-bold mb-4">Log History</h2>
      <p className="text-slate-600">Log history view will be implemented next...</p>
    </div>
  );
}

function TasksScreen({ user, site, shift }) {
  return (
    <div className="container py-6 pb-24">
      <h2 className="text-2xl font-bold mb-4">Tasks</h2>
      <p className="text-slate-600">Tasks management will be implemented next...</p>
    </div>
  );
}

function ManagerApp({ user }) {
  return (
    <div className="min-h-screen">
      <div className="container py-8">
        <h2 className="text-2xl font-bold mb-4">Operations Manager Dashboard</h2>
        <p className="text-slate-600">Manager interface will be implemented after officer app...</p>
      </div>
    </div>
  );
}

// Bottom Navigation for Officer
function OfficerNavigation() {
  const location = useLocation();
  
  const navItems = [
    { to: '/', icon: HomeIcon, label: 'Home' },
    { to: '/log', icon: PlusIcon, label: 'Log' },
    { to: '/logs', icon: ClipboardDocumentListIcon, label: 'History' },
    { to: '/tasks', icon: ClockIcon, label: 'Tasks' },
  ];
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 safe-area-inset-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavItem
              key={to}
              to={to}
              icon={Icon}
              label={label}
              isActive={isActive}
            />
          );
        })}
      </div>
    </nav>
  );
}

// Navigation Item
function NavItem({ to, icon: Icon, label, isActive }) {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
        isActive 
          ? 'text-cyan-600 bg-cyan-50' 
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default App;
