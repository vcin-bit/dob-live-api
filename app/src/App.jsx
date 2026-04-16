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
        <SignedOut><AuthFlow /></SignedOut>
        <SignedIn><AuthenticatedApp /></SignedIn>
      </Router>
    </ClerkProvider>
  );
}

// Auth flow for signed-out users
function AuthFlow() {
  const [mode, setMode] = useState('signin');
  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="wordmark"><span className="dob">DOB</span><span className="live"> Live</span></div>
          <div className="sub">Security Management Platform</div>
        </div>
        <div className="auth-card">
          <h2 style={{fontSize:'1rem',fontWeight:600,marginBottom:'1.25rem',color:'var(--text)'}}>
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
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditSite(site); setShowForm(true); }}>Edit</button>
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
function TeamManagement({ user }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.users.list();
        setOfficers(res.data || []);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const roleLabels = { OFFICER:'Officer', OPS_MANAGER:'Ops Manager', FD:'Field Director', COMPANY:'Admin', SUPER_ADMIN:'Super Admin' };
  const roleBadge  = { OFFICER:'badge-neutral', OPS_MANAGER:'badge-blue', FD:'badge-navy', COMPANY:'badge-navy', SUPER_ADMIN:'badge-danger' };

  const isSiaExpired      = d => d && new Date(d) < new Date();
  const isSiaExpiringSoon = d => { if (!d) return false; const days = (new Date(d)-new Date())/(86400000); return days > 0 && days < 90; };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Team</div>
        <span style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{officers.length} members</span>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>SIA Licence</th><th>SIA Expiry</th><th>Status</th></tr>
            </thead>
            <tbody>
              {officers.map(o => (
                <tr key={o.id}>
                  <td style={{fontWeight:500}}>{o.first_name} {o.last_name}</td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{o.email}</td>
                  <td><span className={`badge ${roleBadge[o.role]||'badge-neutral'}`}>{roleLabels[o.role]||o.role}</span></td>
                  <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{o.sia_licence_number || '—'}</td>
                  <td style={{fontSize:'0.8125rem'}}>
                    {o.sia_expiry_date ? (
                      <span style={{color: isSiaExpired(o.sia_expiry_date) ? 'var(--danger)' : isSiaExpiringSoon(o.sia_expiry_date) ? 'var(--warning)' : 'var(--text-2)'}}>
                        {new Date(o.sia_expiry_date).toLocaleDateString('en-GB')}
                        {isSiaExpired(o.sia_expiry_date) && ' (Expired)'}
                        {isSiaExpiringSoon(o.sia_expiry_date) && ' (Soon)'}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${o.active !== false ? 'badge-success' : 'badge-neutral'}`}>
                      {o.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="card" style={{marginTop:'1.25rem',background:'var(--surface-2)'}}>
          <div style={{fontSize:'0.875rem',fontWeight:500,marginBottom:'0.375rem'}}>Adding Team Members</div>
          <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>
            New officers sign up at <strong>{window.location.origin}</strong> using their work email.
            Once registered, update their <code>role</code> and <code>company_id</code> in the Supabase users table.
          </div>
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


function OfficerNavigation() {
  const location = useLocation();
  const nav = [
    { to: '/',      icon: HomeIcon,                   label: 'Home' },
    { to: '/log',   icon: PlusIcon,                   label: 'Log Entry' },
    { to: '/logs',  icon: ClipboardDocumentListIcon,  label: 'History' },
    { to: '/tasks', icon: ClipboardDocumentListIcon,  label: 'Tasks' },
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
