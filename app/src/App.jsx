import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignedIn, SignedOut, useUser, useAuth, useSignIn, useSignUp } from '@clerk/clerk-react';
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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
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
  // Wake up Render on app load so it's ready when user signs in
  React.useEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/health').catch(() => {});
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/portal/*" element={<PortalApp />} />
        <Route path="*" element={
          <ClerkProvider
            publishableKey={clerkPubKey}
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
          >
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
  const [mode, setMode] = useState('signin'); // signin | signup | forgot | reset
  const [step, setStep] = useState('email'); // email | password | verify | sent | code
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  // Wait for Clerk to load on mobile
  if (!signInLoaded || !signUpLoaded) {
    return (
      <div style={{minHeight:'100vh',background:'#0b1222',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'2rem',fontWeight:800,marginBottom:'1.5rem'}}>
            <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
          </div>
          <div className="spinner" style={{borderTopColor:'#1a52a8',borderColor:'rgba(255,255,255,0.1)',width:'2rem',height:'2rem',margin:'0 auto'}} />
        </div>
      </div>
    );
  }

  function reset(m) {
    setMode(m); setStep('email');
    setEmail(''); setPassword(''); setCode('');
    setError(''); setInfo('');
  }

  // ── Sign In ────────────────────────────────────────────────────────────
  async function handleSignIn(e) {
    e.preventDefault();
    if (step === 'email') { setStep('password'); return; }
    if (!signInLoaded) return;
    setLoading(true); setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      } else {
        setError('Sign in incomplete. Please try again.');
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Incorrect email or password');
    } finally { setLoading(false); }
  }

  // ── Sign Up ────────────────────────────────────────────────────────────
  async function handleSignUp(e) {
    e.preventDefault();
    if (step === 'email') { setStep('password'); return; }
    if (!signUpLoaded) return;
    setLoading(true); setError('');
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep('verify');
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Could not create account');
    } finally { setLoading(false); }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || 'Verification failed');
    } finally { setLoading(false); }
  }

  // ── Password Reset ─────────────────────────────────────────────────────
  async function handleForgot(e) {
    e.preventDefault();
    if (!signInLoaded) return;
    setLoading(true); setError('');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setStep('code');
      setInfo('Check your email for a reset code');
    } catch (err) {
      const msg = err.errors?.[0]?.message || '';
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no account')) {
        setError('No account found for this email. Please sign up first, or contact your manager to invite you.');
      } else {
        setError(msg || 'Could not send reset email');
      }
    } finally { setLoading(false); }
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      } else {
        setError('Reset failed. Please try again.');
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || 'Reset failed');
    } finally { setLoading(false); }
  }

  // ── Styles ─────────────────────────────────────────────────────────────
  const inputStyle = {
    width:'100%', padding:'0.75rem 0.875rem', border:'1.5px solid #e2e8f0',
    borderRadius:'8px', fontSize:'1rem', outline:'none', boxSizing:'border-box',
    fontFamily:'inherit', color:'#0b1222', background:'#fff', transition:'border-color 0.15s',
  };
  const btnStyle = {
    width:'100%', padding:'0.875rem', background:'#1a52a8', color:'#fff',
    border:'none', borderRadius:'8px', fontSize:'1rem', fontWeight:700,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    marginTop:'0.25rem', fontFamily:'inherit',
  };
  const labelStyle = { display:'block', fontSize:'0.8125rem', fontWeight:600, color:'#374151', marginBottom:'0.375rem' };
  const fieldStyle = { marginBottom:'1rem' };

  const title = mode === 'forgot' ? 'Reset your password'
    : mode === 'signup' && step === 'verify' ? 'Check your email'
    : mode === 'signup' ? 'Create your account'
    : 'Sign in';

  return (
    <div style={{minHeight:'100vh',background:'#0b1222',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.25rem',boxSizing:'border-box'}}>
      <div style={{width:'100%',maxWidth:'380px'}}>

        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{fontSize:'2.25rem',fontWeight:800,letterSpacing:'-0.03em'}}>
            <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
          </div>
          <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.4)',marginTop:'0.25rem',fontWeight:500}}>
            Security Management Platform
          </div>
        </div>

        <div style={{background:'#fff',borderRadius:'12px',padding:'1.75rem',boxSizing:'border-box',width:'100%'}}>
          <div style={{fontSize:'1.0625rem',fontWeight:700,color:'#0b1222',marginBottom:'1.25rem'}}>{title}</div>

          {error && (
            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.875rem',color:'#dc2626'}}>{error}</div>
          )}
          {info && (
            <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.875rem',color:'#16a34a'}}>{info}</div>
          )}

          {/* SIGN IN */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}
                  placeholder="you@example.com" required autoComplete="email"
                  onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              {step === 'password' && (
                <div style={fieldStyle}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.375rem'}}>
                    <label style={{...labelStyle,marginBottom:0}}>Password</label>
                    <button type="button" onClick={() => { setMode('forgot'); setStep('email'); setError(''); }}
                      style={{fontSize:'0.8125rem',color:'#1a52a8',background:'none',border:'none',cursor:'pointer',fontWeight:500}}>
                      Forgot password?
                    </button>
                  </div>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle}
                    placeholder="Your password" required autoComplete="current-password" autoFocus
                    onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>
              )}
              <button type="submit" style={btnStyle} disabled={loading}>
                {loading ? 'Signing in...' : step === 'email' ? 'Continue →' : 'Sign in'}
              </button>
            </form>
          )}

          {/* SIGN UP */}
          {mode === 'signup' && step !== 'verify' && (
            <form onSubmit={handleSignUp}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}
                  placeholder="you@example.com" required
                  onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              {step === 'password' && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Choose a password</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle}
                    placeholder="At least 8 characters" required autoFocus
                    onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>
              )}
              <button type="submit" style={btnStyle} disabled={loading}>
                {loading ? 'Creating account...' : step === 'email' ? 'Continue →' : 'Create account'}
              </button>
            </form>
          )}

          {/* VERIFY EMAIL */}
          {mode === 'signup' && step === 'verify' && (
            <form onSubmit={handleVerify}>
              <p style={{fontSize:'0.875rem',color:'#64748b',marginBottom:'1rem'}}>
                We sent a code to <strong>{email}</strong>
              </p>
              <div style={fieldStyle}>
                <label style={labelStyle}>6-digit code</label>
                <input type="text" value={code} onChange={e=>setCode(e.target.value)} style={{...inputStyle,letterSpacing:'0.25em',fontSize:'1.25rem',textAlign:'center'}}
                  placeholder="000000" required maxLength={6} autoFocus
                  onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <button type="submit" style={btnStyle} disabled={loading}>{loading ? 'Verifying...' : 'Verify email'}</button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && step === 'email' && (
            <form onSubmit={handleForgot}>
              <p style={{fontSize:'0.875rem',color:'#64748b',marginBottom:'1rem'}}>
                Enter your email and we'll send a reset code.
              </p>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}
                  placeholder="you@example.com" required autoFocus
                  onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <button type="submit" style={btnStyle} disabled={loading}>{loading ? 'Sending...' : 'Send reset code'}</button>
            </form>
          )}

          {/* RESET PASSWORD */}
          {mode === 'forgot' && step === 'code' && (
            <form onSubmit={handleReset}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Reset code</label>
                <input type="text" value={code} onChange={e=>setCode(e.target.value)} style={{...inputStyle,letterSpacing:'0.25em',fontSize:'1.125rem',textAlign:'center'}}
                  placeholder="000000" required maxLength={6} autoFocus
                  onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>New password</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle}
                  placeholder="At least 8 characters" required
                  onFocus={e=>e.target.style.borderColor='#1a52a8'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <button type="submit" style={btnStyle} disabled={loading}>{loading ? 'Resetting...' : 'Reset password'}</button>
            </form>
          )}

          {/* Footer links */}
          <div style={{borderTop:'1px solid #f1f5f9',marginTop:'1.25rem',paddingTop:'1rem',textAlign:'center',fontSize:'0.875rem',color:'#64748b'}}>
            {mode === 'signin' && (
              <span>No account? <button onClick={() => reset('signup')} style={{color:'#1a52a8',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>Create one</button></span>
            )}
            {mode === 'signup' && step !== 'verify' && (
              <span>Have an account? <button onClick={() => reset('signin')} style={{color:'#1a52a8',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>Sign in</button></span>
            )}
            {mode === 'forgot' && (
              <button onClick={() => reset('signin')} style={{color:'#1a52a8',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>← Back to sign in</button>
            )}
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:'1.5rem',fontSize:'0.75rem',color:'rgba(255,255,255,0.2)'}}>
          © DOB Live · Secure Officer Management
        </div>
      </div>
    </div>
  );
}


// Main authenticated application
function AuthenticatedApp() {
  const { user } = useUser();
  const { signOut, getToken } = useAuth();

  // Make token getter available globally for api.js immediately
  window.__clerkGetToken = getToken;
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchUser() {
      setLoading(true);
      setError(null);

      // Try up to 6 times over ~30 seconds to handle Render cold starts
      for (let i = 0; i < 3; i++) {
        try {
          const res = await api.users.me();
          if (!cancelled) {
            setDbUser(res.data);
            setLoading(false);
          }
          return;
        } catch (err) {
          console.log(`Attempt ${i+1} failed:`, err.message);
          if (i < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!cancelled) {
        setError('Could not connect. Please try again.');
        setLoading(false);
      }
    }

    fetchUser();
    return () => { cancelled = true; };
  }, [user, attempt]);

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'1.5rem',fontWeight:800,marginBottom:'1.5rem'}}>
          <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
        </div>
        <div className="spinner" style={{borderTopColor:'#1a52a8',borderColor:'rgba(255,255,255,0.1)',width:'2rem',height:'2rem',margin:'0 auto 1rem'}}/>
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.875rem'}}>Loading...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623',padding:'1.5rem'}}>
      <div style={{textAlign:'center',maxWidth:'380px'}}>
        <div style={{fontSize:'1.5rem',fontWeight:800,marginBottom:'1.5rem'}}>
          <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
        </div>
        <div style={{background:'#1a2235',borderRadius:'12px',padding:'1.5rem'}}>
          <div style={{fontSize:'1rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem'}}>Server not responding</div>
          <p style={{color:'rgba(255,255,255,0.5)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            The server took too long to respond. Please try again.
          </p>
          <button onClick={() => setAttempt(a => a+1)} style={{width:'100%',padding:'0.75rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer',marginBottom:'0.75rem',fontSize:'0.9375rem'}}>
            Try Again
          </button>
          <button onClick={() => signOut()} style={{width:'100%',padding:'0.75rem',background:'transparent',color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',fontWeight:500,cursor:'pointer',fontSize:'0.875rem'}}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  if (!dbUser) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623',padding:'1.5rem'}}>
      <div style={{textAlign:'center',maxWidth:'380px'}}>
        <div style={{background:'#1a2235',borderRadius:'12px',padding:'1.5rem'}}>
          <div style={{fontSize:'1rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem'}}>Account not set up</div>
          <p style={{color:'rgba(255,255,255,0.5)',fontSize:'0.875rem',marginBottom:'1.5rem'}}>
            Your account needs to be configured by your administrator.
          </p>
          <button onClick={() => signOut()} style={{width:'100%',padding:'0.75rem',background:'#1a2235',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',fontWeight:600,cursor:'pointer'}}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  if (!dbUser || !dbUser.role) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623'}}>
      <div style={{textAlign:'center',color:'rgba(255,255,255,0.5)'}}>
        <p>Account not configured. Contact your administrator.</p>
        <button onClick={() => signOut()} style={{marginTop:'1rem',padding:'0.75rem 1.5rem',background:'#1a2235',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer'}}>Sign Out</button>
      </div>
    </div>
  );
  if (dbUser.role === 'OFFICER') return <OfficerApp user={dbUser} />;
  return <ManagerApp user={dbUser} />;
}


// Loading screen
function LoadingScreen() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1623'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'1.5rem',fontWeight:800,marginBottom:'1.5rem'}}>
          <span style={{color:'#1a52a8'}}>DOB</span><span style={{color:'#fff'}}> Live</span>
        </div>
        <div className="spinner" style={{borderTopColor:'#1a52a8',borderColor:'rgba(255,255,255,0.1)',width:'2rem',height:'2rem',margin:'0 auto 1rem'}} />
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.875rem'}}>Connecting...</p>
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
