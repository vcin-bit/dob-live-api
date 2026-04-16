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
import { OfficerApp } from './components/OfficerShell';
import { ManagerApp } from './components/ManagerShell';


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
