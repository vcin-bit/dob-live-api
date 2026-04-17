import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, useUser, useAuth } from '@clerk/clerk-react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from './lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from './lib/constants';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

import { PortalApp } from './components/Portal';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_c3BlY2lhbC1ib2JjYXQtNDguY2xlcmsuYWNjb3VudHMuZGV2JA';
import { OfficerApp } from './components/OfficerShell';
import { ManagerApp } from './components/ManagerShell';


class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb',padding:'1.5rem'}}>
          <div style={{textAlign:'center',maxWidth:'400px'}}>
            <div style={{fontSize:'1.125rem',fontWeight:700,marginBottom:'0.75rem'}}>Something went wrong</div>
            <p style={{color:'#64748b',fontSize:'0.875rem',marginBottom:'1.5rem'}}>{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} style={{padding:'0.75rem 1.5rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:600}}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/portal/*" element={<PortalApp />} />
        <Route path="*" element={
          <ClerkProvider publishableKey={clerkPubKey}>
            <SignedOut><AuthFlow /></SignedOut>
            <SignedIn><AuthenticatedApp /></SignedIn>
          </ClerkProvider>
        } />
      </Routes>
    </Router>
  );
}

// Auth flow for signed-out users
function AuthFlow() {
  const [mode, setMode] = useState('signin');

  const clerkAppearance = {
    variables: {
      colorPrimary: '#1a52a8',
      colorBackground: '#ffffff',
      colorText: '#0b1222',
      colorTextSecondary: '#64748b',
      colorInputBackground: '#f8fafc',
      colorInputText: '#0b1222',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '15px',
    },
    elements: {
      card: { boxShadow: 'none', border: 'none', padding: 0, background: 'transparent' },
      headerTitle: { display: 'none' },
      headerSubtitle: { display: 'none' },
      socialButtons: { display: 'none' },
      divider: { display: 'none' },
      footer: { display: 'none' },
      footerAction: { display: 'none' },
      identityPreview: { display: 'none' },
      alternativeMethods: { display: 'none' },
      formFieldLabel: { fontSize: '0.8125rem', fontWeight: 500, color: '#374151', marginBottom: '0.375rem' },
      formFieldInput: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.625rem 0.875rem', fontSize: '0.9375rem', width: '100%', boxSizing: 'border-box' },
      formButtonPrimary: { background: '#1a52a8', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, width: '100%' },
      formFieldAction: { fontSize: '0.8125rem', color: '#1a52a8' },
    },
  };

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.25rem',boxSizing:'border-box'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{fontSize:'2rem',fontWeight:800,letterSpacing:'-0.03em'}}>
            <span style={{color:'#1a52a8'}}>DOB</span>
            <span style={{color:'#0b1222'}}> Live</span>
          </div>
          <div style={{fontSize:'0.875rem',color:'#64748b',marginTop:'0.25rem',fontWeight:500}}>Security Management Platform</div>
        </div>

        {/* Card */}
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 1px 3px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.06)',padding:'2rem',boxSizing:'border-box',width:'100%',overflow:'hidden'}}>
          <div style={{fontSize:'1rem',fontWeight:700,color:'#0b1222',marginBottom:'1.5rem'}}>
            {mode === 'signin' ? 'Sign in' : 'Create your account'}
          </div>

          {mode === 'signin' ? (
            <SignIn appearance={clerkAppearance} />
          ) : (
            <SignUp appearance={clerkAppearance} />
          )}

          <div style={{borderTop:'1px solid #f1f5f9',marginTop:'1.25rem',paddingTop:'1rem',textAlign:'center',fontSize:'0.875rem',color:'#64748b'}}>
            {mode === 'signin' ? (
              <span>No account? <button onClick={() => setMode('signup')} style={{color:'#1a52a8',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>Create one</button></span>
            ) : (
              <span>Already have an account? <button onClick={() => setMode('signin')} style={{color:'#1a52a8',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>Sign in</button></span>
            )}
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:'1.5rem',fontSize:'0.75rem',color:'#94a3b8'}}>
          DOB Live · Secure Officer Management
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
        // Render free tier spins down - retry up to 3 times with delay
        let userData, lastErr;
        for (let i = 0; i < 3; i++) {
          try {
            userData = await api.users.me();
            break;
          } catch (err) {
            lastErr = err;
            if (i < 2) await new Promise(r => setTimeout(r, 2000));
          }
        }
        if (!userData) throw lastErr;
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
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623'}}>
      <div style={{textAlign:'center'}}>
        <div className="spinner" style={{borderTopColor:'#1a52a8',borderColor:'rgba(255,255,255,0.1)',width:'2rem',height:'2rem',margin:'0 auto 1rem'}} />
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.875rem'}}>Loading...</p>
      </div>
    </div>
  );
}

// Error screen
function ErrorScreen({ error, onRetry }) {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623',padding:'1.5rem'}}>
      <div style={{textAlign:'center',maxWidth:'360px'}}>
        <div style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.75rem'}}>Connection Error</div>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
          {error instanceof ApiError ? error.message : 'Unable to connect to DOB Live.'}
        </p>
        <button onClick={onRetry} style={{padding:'0.75rem 1.5rem',background:'var(--blue)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.9375rem',fontWeight:600,cursor:'pointer'}}>Try Again</button>
      </div>
    </div>
  );
}

// User not found screen
function UserNotFoundScreen() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623',padding:'1.5rem'}}>
      <div style={{textAlign:'center',maxWidth:'360px'}}>
        <div style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.75rem'}}>Account Setup Required</div>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>Your account exists but needs to be set up by your administrator. Contact your operations manager.</p>
        <button onClick={() => window.Clerk?.signOut()} style={{padding:'0.75rem 1.5rem',background:'#1a2235',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',fontSize:'0.9375rem',fontWeight:600,cursor:'pointer'}}>Sign Out</button>
      </div>
    </div>
  );
}

// Officer Application
export default App;
