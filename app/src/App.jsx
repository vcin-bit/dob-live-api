import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
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
            <div className="min-h-screen flex items-center justify-center p-4">
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
    <div className="w-full max-w-md mx-auto">
      {/* Professional header with security theme */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-slate-900 rounded-sm"></div>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">DOB Live</h1>
        <p className="text-slate-600">Security Management Platform</p>
      </div>
      
      {/* Professional auth card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        {mode === 'signin' ? (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome back</h2>
              <p className="text-slate-600 text-sm">Sign in to your security dashboard</p>
            </div>
            
            <SignIn 
              appearance={{
                elements: {
                  // Hide all Clerk branding and chrome
                  card: 'shadow-none border-0 bg-transparent p-0 w-full',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden', 
                  socialButtons: 'hidden',
                  socialButtonsBlockButton: 'hidden',
                  divider: 'hidden',
                  footer: 'hidden',
                  footerAction: 'hidden',
                  footerActionText: 'hidden',
                  footerActionLink: 'hidden',
                  identityPreview: 'hidden',
                  alternativeMethods: 'hidden',
                  
                  // Style the form elements professionally
                  formFieldLabel: 'block text-sm font-semibold text-slate-700 mb-2',
                  formFieldInput: 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white transition-all duration-200 text-slate-900 placeholder-slate-500',
                  formButtonPrimary: 'w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]',
                  formFieldRow: 'mb-5',
                  formFieldAction: 'text-right mt-2',
                  formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-700 transition-colors',
                  
                  // Error states
                  formFieldErrorText: 'text-red-600 text-sm mt-1 font-medium',
                  globalError: 'bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4',
                  
                  // OTP fields for 2FA
                  otpCodeFieldInput: 'w-12 h-12 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono text-lg font-semibold',
                }
              }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Create account</h2>
              <p className="text-slate-600 text-sm">Join the DOB Live security platform</p>
            </div>
            
            <SignUp 
              appearance={{
                elements: {
                  // Hide all Clerk branding and chrome  
                  card: 'shadow-none border-0 bg-transparent p-0 w-full',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtons: 'hidden', 
                  socialButtonsBlockButton: 'hidden',
                  divider: 'hidden',
                  footer: 'hidden',
                  footerAction: 'hidden',
                  footerActionText: 'hidden',
                  footerActionLink: 'hidden',
                  identityPreview: 'hidden',
                  alternativeMethods: 'hidden',
                  
                  // Style the form elements professionally
                  formFieldLabel: 'block text-sm font-semibold text-slate-700 mb-2',
                  formFieldInput: 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white transition-all duration-200 text-slate-900 placeholder-slate-500',
                  formButtonPrimary: 'w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]',
                  formFieldRow: 'mb-5',
                  formFieldAction: 'text-right mt-2',
                  formFieldInputShowPasswordButton: 'text-slate-500 hover:text-slate-700 transition-colors',
                  
                  // Error states
                  formFieldErrorText: 'text-red-600 text-sm mt-1 font-medium',
                  globalError: 'bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4',
                  
                  // OTP fields for 2FA
                  otpCodeFieldInput: 'w-12 h-12 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono text-lg font-semibold',
                }
              }}
            />
          </div>
        )}
        
        {/* Professional form switching */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          {mode === 'signin' ? (
            <p className="text-slate-600">
              Don't have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-cyan-600 hover:text-cyan-700 font-semibold hover:underline transition-all duration-200"
              >
                Create account
              </button>
            </p>
          ) : (
            <p className="text-slate-600">
              Already have an account?{' '}
              <button
                onClick={() => setMode('signin')}
                className="text-cyan-600 hover:text-cyan-700 font-semibold hover:underline transition-all duration-200"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
      
      {/* Security badge */}
      <div className="text-center mt-6">
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
          <span className="w-3 h-3 bg-green-400 rounded-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
          </span>
          Secure authentication powered by Clerk
        </p>
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
          ? 'border-cyan-300 bg-cyan-50' 
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
          <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
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
                className="text-sm text-cyan-600 hover:text-cyan-500 font-medium"
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
                ? 'bg-white text-slate-900 shadow-sm'
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
                className="text-sm text-cyan-600 hover:text-cyan-500 font-medium"
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
    <div className="min-h-screen bg-slate-50 flex">
      <ManagerSidebar user={user} />
      <div className="flex-1 ml-64">
        <ManagerHeader user={user} />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<ManagerDashboard user={user} />} />
            <Route path="/sites" element={<SiteManagement user={user} />} />
            <Route path="/sites/:id" element={<SiteDetail user={user} />} />
            <Route path="/team" element={<TeamManagement user={user} />} />
            <Route path="/logs" element={<LogReview user={user} />} />
            <Route path="/tasks" element={<TaskAssignment user={user} />} />
            <Route path="/reports" element={<Reporting user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// Manager Sidebar Navigation
function ManagerSidebar({ user }) {
  const location = useLocation();
  
  const navItems = [
    { to: '/', icon: ChartBarIcon, label: 'Dashboard' },
    { to: '/sites', icon: BuildingOfficeIcon, label: 'Sites' },
    { to: '/team', icon: UsersIcon, label: 'Team' },
    { to: '/logs', icon: EyeIcon, label: 'Log Review' },
    { to: '/tasks', icon: ClipboardDocumentListIcon, label: 'Tasks' },
    { to: '/reports', icon: DocumentTextIcon, label: 'Reports' },
  ];
  
  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-900">DOB Live</h1>
        <p className="text-sm text-slate-600">Operations Manager</p>
      </div>
      
      <div className="space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <ManagerNavItem
              key={to}
              to={to}
              icon={Icon}
              label={label}
              isActive={isActive}
            />
          );
        })}
      </div>
      
      <div className="absolute bottom-6 left-6 right-6">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-sm font-medium text-slate-900">{user.first_name} {user.last_name}</p>
          <p className="text-xs text-slate-600">{user.email}</p>
        </div>
      </div>
    </nav>
  );
}

// Manager Navigation Item
function ManagerNavItem({ to, icon: Icon, label, isActive }) {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate(to)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
        isActive 
          ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' 
          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

// Manager Header
function ManagerHeader({ user }) {
  const { signOut } = useAuth();
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/sites': return 'Site Management';
      case '/team': return 'Team Management';
      case '/logs': return 'Log Review';
      case '/tasks': return 'Task Assignment';
      case '/reports': return 'Reports';
      default: return 'Operations';
    }
  };
  
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{getPageTitle()}</h2>
          <p className="text-slate-600">
            {user.company?.name || 'DOB Live Security'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
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

// Manager Dashboard
function ManagerDashboard({ user }) {
  const [stats, setStats] = useState({
    activeOfficers: 0,
    activeSites: 0,
    todayLogs: 0,
    pendingTasks: 0
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // Get basic stats
        const [sitesRes, logsRes, tasksRes] = await Promise.all([
          api.sites.list(),
          api.logs.list({ limit: 10 }),
          api.tasks.list({ status: 'PENDING', limit: 5 })
        ]);
        
        setStats({
          activeSites: sitesRes.data?.length || 0,
          todayLogs: logsRes.data?.length || 0,
          pendingTasks: tasksRes.data?.length || 0,
          activeOfficers: 0 // Will calculate from shifts
        });
        
        setRecentLogs(logsRes.data?.slice(0, 5) || []);
        
        // Create sample alerts
        setAlerts([
          { id: 1, type: 'warning', message: 'Site inspection overdue at Main Office', time: '2 hours ago' },
          { id: 2, type: 'info', message: '3 new log entries require review', time: '30 minutes ago' }
        ]);
        
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboardData();
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Sites"
          value={stats.activeSites}
          icon={<BuildingOfficeIcon className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Officers On Duty"
          value={stats.activeOfficers}
          icon={<UsersIcon className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Today's Logs"
          value={stats.todayLogs}
          icon={<ClipboardDocumentListIcon className="w-6 h-6" />}
          color="cyan"
        />
        <StatCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          icon={<ClockIcon className="w-6 h-6" />}
          color="amber"
        />
      </div>
      
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BellAlertIcon className="w-5 h-5" />
            Alerts
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  alert.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                  <p className="text-xs text-slate-500">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Logs</h3>
          {recentLogs.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No recent logs</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <ManagerLogPreview key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            <ManagerActionButton
              to="/tasks"
              icon={<PlusIcon className="w-5 h-5" />}
              title="Assign Task"
              subtitle="Create new officer task"
            />
            <ManagerActionButton
              to="/logs"
              icon={<EyeIcon className="w-5 h-5" />}
              title="Review Logs"
              subtitle="Check recent incidents"
            />
            <ManagerActionButton
              to="/reports"
              icon={<ArrowDownTrayIcon className="w-5 h-5" />}
              title="Export Report"
              subtitle="Generate compliance report"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    cyan: 'text-cyan-600 bg-cyan-50',
    amber: 'text-amber-600 bg-amber-50'
  };
  
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Manager Log Preview Component
function ManagerLogPreview({ log }) {
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="text-lg">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-900 text-sm">{log.title}</span>
          <span className={`status-badge ${config.color === 'alert' ? 'status-alert' : 'status-info'}`}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-slate-600">{log.site?.name} • {getRelativeTime(log.occurred_at)}</p>
      </div>
    </div>
  );
}

// Manager Action Button
function ManagerActionButton({ to, icon, title, subtitle }) {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors"
    >
      <div className="text-slate-600">{icon}</div>
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
    </button>
  );
}

// Site Management Screen
function SiteManagement({ user }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await api.sites.list();
        setSites(response.data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch sites:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSites();
  }, []);
  
  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>;
  
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Error loading sites: {error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">All Sites</h3>
          <p className="text-slate-600">Manage and monitor your security sites</p>
        </div>
        <button className="btn btn-primary">
          <PlusIcon className="w-4 h-4" />
          Add Site
        </button>
      </div>
      
      {sites.length === 0 ? (
        <div className="text-center py-12">
          <BuildingOfficeIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No sites found</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}

// Site Card Component
function SiteCard({ site }) {
  const navigate = useNavigate();
  
  return (
    <div className="card cursor-pointer hover:shadow-lg transition-shadow"
         onClick={() => navigate(`/sites/${site.id}`)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <BuildingOfficeIcon className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{site.name}</h4>
            <p className="text-slate-600">{site.address}</p>
            {site.description && (
              <p className="text-sm text-slate-500 mt-1">{site.description}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 mb-2">
            <span className="status-badge status-active">Active</span>
          </div>
          <p className="text-sm text-slate-500">0 officers on site</p>
        </div>
      </div>
    </div>
  );
}

// Log Review Screen
function LogReview({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    log_type: '',
    site_id: '',
    from: '',
    to: '',
    limit: 20
  });
  const [sites, setSites] = useState([]);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [logsRes, sitesRes] = await Promise.all([
          api.logs.list(Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))),
          api.sites.list()
        ]);
        
        setLogs(logsRes.data || []);
        setSites(sitesRes.data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [filters]);
  
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FunnelIcon className="w-5 h-5" />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Log Type</label>
            <select 
              className="input select"
              value={filters.log_type}
              onChange={(e) => updateFilter('log_type', e.target.value)}
            >
              <option value="">All Types</option>
              {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => (
                <option key={type} value={type}>{config.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
            <select 
              className="input select"
              value={filters.site_id}
              onChange={(e) => updateFilter('site_id', e.target.value)}
            >
              <option value="">All Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <input 
              type="date" 
              className="input"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <input 
              type="date" 
              className="input"
              value={filters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error loading logs: {error}</p>
        </div>
      )}
      
      {/* Logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">All Logs</h3>
          <button className="btn btn-secondary">
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No logs found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <ManagerLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Manager Log Card Component (more detailed than preview)
function ManagerLogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
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
              className="text-sm text-cyan-600 hover:text-cyan-500 font-medium mt-2"
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksRes, officersRes, sitesRes] = await Promise.all([
          api.tasks.list(),
          api.users.list({ role: 'OFFICER' }),
          api.sites.list()
        ]);
        
        setTasks(tasksRes.data || []);
        setOfficers(officersRes.data || []);
        setSites(sitesRes.data || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);
  
  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Task Management</h3>
          <p className="text-slate-600">Create and track officer assignments</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          <PlusIcon className="w-4 h-4" />
          Assign Task
        </button>
      </div>
      
      {showCreateForm && (
        <TaskCreateForm
          officers={officers}
          sites={sites}
          onClose={() => setShowCreateForm(false)}
          onSuccess={(newTask) => {
            setTasks(prev => [newTask, ...prev]);
            setShowCreateForm(false);
          }}
        />
      )}
      
      <div className="card">
        <h4 className="font-semibold text-slate-900 mb-4">All Tasks</h4>
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No tasks assigned yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <ManagerTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Task Create Form
function TaskCreateForm({ officers, sites, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    site_id: '',
    priority: 'NORMAL',
    due_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.tasks.create(formData);
      onSuccess(response.data);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-slate-900">Create New Task</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              className="input"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Officer *</label>
            <select
              className="input select"
              value={formData.assigned_to}
              onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
              required
            >
              <option value="">Select officer...</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.first_name} {officer.last_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
            <select
              className="input select"
              value={formData.site_id}
              onChange={(e) => setFormData(prev => ({ ...prev, site_id: e.target.value }))}
            >
              <option value="">Any site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select
              className="input select"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="datetime-local"
              className="input"
              value={formData.due_date}
              onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
          <textarea
            className="input textarea"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows="4"
            required
          />
        </div>
        
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? <div className="spinner"></div> : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Manager Task Card
function ManagerTaskCard({ task }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT': return 'status-alert';
      case 'HIGH': return 'status-pending';
      case 'NORMAL': return 'status-info';
      case 'LOW': return 'status-info';
      default: return 'status-info';
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'status-active';
      case 'IN_PROGRESS': return 'status-pending';
      case 'PENDING': return 'status-info';
      default: return 'status-info';
    }
  };
  
  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold text-slate-900">{task.title}</h5>
            <span className={`status-badge ${getStatusColor(task.status)}`}>
              {task.status?.replace('_', ' ').toLowerCase()}
            </span>
            {task.priority !== 'NORMAL' && (
              <span className={`status-badge ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
            )}
          </div>
          
          <p className="text-slate-700 mb-3">{task.description}</p>
          
          <div className="flex items-center gap-4 text-sm text-slate-600">
            {task.assigned_to && (
              <span className="flex items-center gap-1">
                <UsersIcon className="w-4 h-4" />
                {task.assigned_to.first_name} {task.assigned_to.last_name}
              </span>
            )}
            {task.site && (
              <span className="flex items-center gap-1">
                <BuildingOfficeIcon className="w-4 h-4" />
                {task.site.name}
              </span>
            )}
            {task.due_date && (
              <span className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                Due {formatDateTime(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SITE DETAIL ────────────────────────────────────────────────────────────────
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
                <a href={`tel:${site.contact_phone}`} className="text-cyan-600 text-sm hover:underline">
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
function TeamManagement({ user }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await api.users.list();
        setOfficers(res.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTeam();
  }, []);

  const filtered = officers.filter((o) => {
    if (filterActive === 'active') return o.active !== false;
    if (filterActive === 'inactive') return o.active === false;
    return true;
  });

  const isSiaExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const days = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
    return days > 0 && days < 90;
  };

  const isSiaExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const roleLabels = {
    OFFICER: 'Officer',
    OPS_MANAGER: 'Ops Manager',
    FD: 'Field Director',
    COMPANY: 'Company Admin',
    SUPER_ADMIN: 'Super Admin',
  };

  const roleColors = {
    OFFICER: 'bg-blue-100 text-blue-800',
    OPS_MANAGER: 'bg-purple-100 text-purple-800',
    FD: 'bg-amber-100 text-amber-800',
    COMPANY: 'bg-slate-100 text-slate-800',
    SUPER_ADMIN: 'bg-red-100 text-red-800',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 text-sm">{filtered.length} {filtered.length === 1 ? 'member' : 'members'}</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary flex items-center gap-2 text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Invite Officer
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'active', 'inactive'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filterActive === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* SIA Warning Banner */}
      {officers.some((o) => isSiaExpiringSoon(o.sia_expiry_date) || isSiaExpired(o.sia_expiry_date)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
            <BellAlertIcon className="w-4 h-4" />
            SIA Licence Alert
          </div>
          <p className="text-amber-700 text-sm">
            {officers.filter((o) => isSiaExpired(o.sia_expiry_date)).length > 0 &&
              `${officers.filter((o) => isSiaExpired(o.sia_expiry_date)).length} expired. `}
            {officers.filter((o) => isSiaExpiringSoon(o.sia_expiry_date)).length > 0 &&
              `${officers.filter((o) => isSiaExpiringSoon(o.sia_expiry_date)).length} expiring within 90 days.`}
          </p>
        </div>
      )}

      {/* Team List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No team members found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((officer) => {
            const siaExpired = isSiaExpired(officer.sia_expiry_date);
            const siaExpiringSoon = isSiaExpiringSoon(officer.sia_expiry_date);
            const initials = `${(officer.first_name || '?')[0]}${(officer.last_name || '?')[0]}`.toUpperCase();
            return (
              <div
                key={officer.id}
                className={`card ${officer.active === false ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {initials}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">
                        {officer.first_name} {officer.last_name}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[officer.role] || roleColors.OFFICER}`}>
                        {roleLabels[officer.role] || officer.role}
                      </span>
                      {officer.active === false && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">{officer.email}</p>
                    {officer.phone && (
                      <p className="text-slate-500 text-sm">{officer.phone}</p>
                    )}
                    {/* SIA Licence */}
                    {officer.sia_licence_number && (
                      <div className={`mt-2 flex items-center gap-2 text-xs font-mono rounded px-2 py-1 inline-flex ${
                        siaExpired ? 'bg-red-50 text-red-700' :
                        siaExpiringSoon ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        <span>SIA {officer.sia_licence_number}</span>
                        {officer.sia_expiry_date && (
                          <span className="text-slate-400">•</span>
                        )}
                        {officer.sia_expiry_date && (
                          <span>
                            {siaExpired ? 'EXPIRED' : siaExpiringSoon ? 'Expiring ' : 'Exp '}
                            {new Date(officer.sia_expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Note */}
      {showAddForm && (
        <div className="card border-2 border-cyan-200 bg-cyan-50">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Invite Team Member</h3>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <p className="text-slate-600 text-sm mb-4">
            New officers are added via Clerk and assigned to your company in the database.
            Send them this link to sign up, then set their role in the Supabase dashboard.
          </p>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 font-mono text-sm text-slate-700 break-all">
            {window.location.origin}
          </div>
          <p className="text-xs text-slate-500 mt-2">After they sign up, assign their company_id and role in the users table.</p>
        </div>
      )}
    </div>
  );
}

// ── REPORTING ──────────────────────────────────────────────────────────────────
function Reporting({ user }) {
  const [logs, setLogs] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('7'); // days

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const from = new Date();
        from.setDate(from.getDate() - parseInt(dateRange));

        const [logsRes, sitesRes] = await Promise.all([
          api.logs.list({ from: from.toISOString(), limit: 500 }),
          api.sites.list(),
        ]);
        setLogs(logsRes.data || []);
        setSites(sitesRes.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  // Aggregate by log type
  const byType = logs.reduce((acc, log) => {
    acc[log.log_type] = (acc[log.log_type] || 0) + 1;
    return acc;
  }, {});

  // Aggregate by site
  const bySite = logs.reduce((acc, log) => {
    const name = log.site?.name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  // Aggregate by day
  const byDay = logs.reduce((acc, log) => {
    const day = new Date(log.occurred_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const topSites = Object.entries(bySite).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...Object.values(byType), 1);

  const typeColors = {
    PATROL: 'bg-blue-500',
    INCIDENT: 'bg-red-500',
    ALARM: 'bg-amber-500',
    ACCESS: 'bg-violet-500',
    VISITOR: 'bg-cyan-500',
    HANDOVER: 'bg-emerald-500',
    MAINTENANCE: 'bg-orange-500',
    VEHICLE: 'bg-slate-500',
    WELFARE: 'bg-pink-500',
    KEYHOLDING: 'bg-indigo-500',
    GENERAL: 'bg-slate-400',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm">{logs.length} logs in selected period</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-slate-900">{logs.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Total Logs</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">
            {logs.filter((l) => l.log_type === 'INCIDENT').length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Incidents</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-amber-500">
            {logs.filter((l) => l.log_type === 'ALARM').length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Alarms</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-500">
            {logs.filter((l) => l.log_type === 'PATROL').length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Patrols</p>
        </div>
      </div>

      {/* Log Types Bar Chart */}
      {topTypes.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Logs by Type</h3>
          <div className="space-y-3">
            {topTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 w-24 text-right flex-shrink-0">
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${typeColors[type] || 'bg-slate-400'}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Site */}
      {topSites.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Logs by Site</h3>
          <div className="space-y-3">
            {topSites.map(([siteName, count]) => (
              <div key={siteName} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0"></div>
                  <span className="text-sm text-slate-700 font-medium">{siteName}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {logs.length === 0 && !error && (
        <div className="card text-center py-12 text-slate-400">
          <ChartBarIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No logs in this period</p>
          <p className="text-xs mt-1">Try a wider date range</p>
        </div>
      )}
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
