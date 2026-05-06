import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useAuth, useSignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { api } from '../lib/api';

const SIA_TYPES = ['Security Guarding','Door Supervisor','CCTV Operator','Close Protection','Vehicle Immobiliser','Key Holding'];

export function HRPortalApp() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', '/manifest-hr.json');
    document.title = 'DOB Live — Personnel Portal';
    return () => { if (link) link.setAttribute('href', '/manifest.json'); document.title = 'DOB Live'; };
  }, []);

  return (
    <>
      <SignedOut><HRLogin /></SignedOut>
      <SignedIn><HRAuthenticated /></SignedIn>
    </>
  );
}

// ── Login ───────────────────────────────────────────────────────────────────
function HRLogin() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustCode, setTrustCode] = useState('');

  if (!isLoaded) return <Spinner />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 'email') { setStep('password'); return; }
    if (step === 'trust') { return handleTrustVerify(e); }
    setLoading(true); setError('');
    try {
      let result = await signIn.create({ identifier: email, password });
      if (result.status === 'needs_first_factor') {
        result = await signIn.attemptFirstFactor({ strategy: 'password', password });
      }
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else if (result.status === 'needs_second_factor' || result.status === 'needs_client_trust') {
        const emailFactor = result.supportedSecondFactors?.find(f => f.strategy === 'email_code');
        if (emailFactor) {
          await signIn.prepareSecondFactor({ strategy: 'email_code' });
          setStep('trust'); setTrustCode('');
        } else { setError('Verification required but no email code method available.'); }
      } else setError('Sign in failed. Please try again.');
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Incorrect email or password');
    } finally { setLoading(false); }
  }

  async function handleTrustVerify(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await signIn.attemptSecondFactor({ strategy: 'email_code', code: trustCode });
      if (result.status === 'complete') await setActive({ session: result.createdSessionId });
      else setError('Verification failed. Please try again.');
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid verification code');
    } finally { setLoading(false); }
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg, #0b1a3e 0%, #1a3a7a 50%, #0b1a3e 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem',boxSizing:'border-box'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'2.5rem'}}>
          <div style={{width:'56px',height:'56px',background:'rgba(255,255,255,0.1)',borderRadius:'14px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem',border:'1px solid rgba(255,255,255,0.15)'}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <div style={{fontSize:'1.625rem',fontWeight:800,color:'#fff',letterSpacing:'-0.02em'}}>
            <span style={{color:'#60a5fa'}}>DOB</span> Live
          </div>
          <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.5)',marginTop:'0.375rem',fontWeight:500}}>Personnel Portal</div>
        </div>

        <div style={{background:'#fff',borderRadius:'16px',padding:'2rem',boxShadow:'0 25px 50px rgba(0,0,0,0.25)'}}>
          <div style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',marginBottom:'0.25rem'}}>Welcome back</div>
          <div style={{fontSize:'0.8125rem',color:'#9ca3af',marginBottom:'1.5rem'}}>Sign in with your DOB Live credentials</div>

          {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{error}</div>}

          <form onSubmit={handleSubmit}>
            {step !== 'trust' && (
              <>
                <div style={{marginBottom:'1rem'}}>
                  <label style={S.label}>Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" style={S.input} />
                </div>
                {step === 'password' && (
                  <div style={{marginBottom:'1rem'}}>
                    <label style={S.label}>Password</label>
                    <div style={{position:'relative'}}>
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required autoFocus autoComplete="current-password" style={{...S.input, paddingRight:'3.5rem'}} />
                      <button type="button" onClick={() => setShowPw(!showPw)} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer',fontWeight:500}}>{showPw?'Hide':'Show'}</button>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading} style={{...S.btn, opacity:loading?0.7:1, cursor:loading?'wait':'pointer'}}>
                  {loading ? 'Signing in...' : step === 'email' ? 'Continue' : 'Sign In'}
                </button>
              </>
            )}
            {step === 'trust' && (
              <>
                <p style={{fontSize:'0.8125rem',color:'#6b7280',marginBottom:'1rem'}}>We sent a verification code to <strong>{email}</strong></p>
                <div style={{marginBottom:'1rem'}}>
                  <label style={S.label}>6-digit code</label>
                  <input type="text" inputMode="numeric" value={trustCode} onChange={e => setTrustCode(e.target.value.replace(/\D/g,''))} placeholder="000000" required maxLength={6} autoFocus style={{...S.input,letterSpacing:'0.25em',fontSize:'1.25rem',textAlign:'center'}} />
                </div>
                <button type="submit" disabled={loading || trustCode.length !== 6} style={{...S.btn, opacity:loading||trustCode.length!==6?0.7:1, cursor:loading?'wait':'pointer'}}>
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
                <button type="button" onClick={() => { setStep('password'); setTrustCode(''); setError(''); }} style={{display:'block',margin:'0.75rem auto 0',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer'}}>Back to sign in</button>
              </>
            )}
          </form>
          {step === 'password' && <button onClick={() => { setStep('email'); setPassword(''); setError(''); }} style={{display:'block',margin:'1rem auto 0',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer'}}>Use a different email</button>}
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.75rem',marginTop:'1.5rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.6875rem',color:'rgba(255,255,255,0.35)'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            256-bit encryption
          </div>
          <div style={{width:'1px',height:'10px',background:'rgba(255,255,255,0.15)'}} />
          <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.35)'}}>GDPR Compliant</div>
          <div style={{width:'1px',height:'10px',background:'rgba(255,255,255,0.15)'}} />
          <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.35)'}}>UK Data Centres</div>
        </div>
      </div>
    </div>
  );
}

// ── Authenticated App ───────────────────────────────────────────────────────
function HRAuthenticated() {
  const { getToken, signOut } = useAuth();
  window.__clerkGetToken = getToken;

  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hr, setHr] = useState(null);
  const [tab, setTab] = useState('home');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [sessionExpiry] = useState(Date.now() + 15 * 60 * 1000);
  const [timeLeft, setTimeLeft] = useState(15);

  const [form, setForm] = useState({
    nok_name:'', nok_relationship:'', nok_phone:'',
    address_line_1:'', address_line_2:'', city:'', postcode:'',
    date_of_birth:'', ni_number:'', personal_email:'',
    bank_name:'', bank_sort_code:'', bank_account_number:'', bank_account_holder:'',
    employment_status:'', utr_number:'',
    company_name:'', company_address:'', company_vat_number:'', company_reg_number:'',
  });
  const [docs, setDocs] = useState({ sia_front:null, sia_back:null, dbs_certificate:null });
  const [uploading, setUploading] = useState('');
  const fileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState('');
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [invoiceShifts, setInvoiceShifts] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');

  // Session timer
  useEffect(() => {
    const t = setInterval(() => {
      const mins = Math.max(0, Math.ceil((sessionExpiry - Date.now()) / 60000));
      setTimeLeft(mins);
      if (mins <= 0) signOut();
    }, 30000);
    return () => clearInterval(t);
  }, [sessionExpiry]);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const userRes = await api.users.me();
        setDbUser(userRes.data);
        const hrRes = await api.hr.get();
        if (hrRes.data) {
          setHr(hrRes.data);
          setForm({
            nok_name: hrRes.data.nok_name||'', nok_relationship: hrRes.data.nok_relationship||'', nok_phone: hrRes.data.nok_phone||'',
            address_line_1: hrRes.data.address_line_1||'', address_line_2: hrRes.data.address_line_2||'', city: hrRes.data.city||'', postcode: hrRes.data.postcode||'',
            date_of_birth: hrRes.data.date_of_birth ? hrRes.data.date_of_birth.split('T')[0] : '', ni_number: hrRes.data.ni_number||'', personal_email: hrRes.data.personal_email||'',
            bank_name: hrRes.data.bank_name||'', bank_sort_code: hrRes.data.bank_sort_code||'', bank_account_number: hrRes.data.bank_account_number||'', bank_account_holder: hrRes.data.bank_account_holder||'',
            employment_status: hrRes.data.employment_status||'', utr_number: hrRes.data.utr_number||'',
            company_name: hrRes.data.company_name||'', company_address: hrRes.data.company_address||'',
            company_vat_number: hrRes.data.company_vat_number||'', company_reg_number: hrRes.data.company_reg_number||'',
          });
          setDocs({ sia_front: hrRes.data.sia_front_path||null, sia_back: hrRes.data.sia_back_path||null, dbs_certificate: hrRes.data.dbs_certificate_path||null });
          // If GDPR already accepted, skip welcome
          if (hrRes.data.gdpr_consent) setTab('home');
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  // Show welcome screen for first-time users
  const isFirstTime = !hr?.gdpr_consent;

  async function handleUpload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !uploadTarget) return;
    setUploading(uploadTarget);
    try {
      await api.hr.uploadDoc(uploadTarget, file);
      setDocs(prev => ({ ...prev, [uploadTarget]: 'uploaded' }));
      setSuccess('Document uploaded'); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setUploading(''); setUploadTarget(''); }
  }

  async function viewDoc(docType) {
    try { const res = await api.hr.getDocUrl(docType); window.open(res.url, '_blank'); }
    catch { alert('Could not load document'); }
  }

  async function deleteDoc(docType) {
    if (!confirm('Remove this document?')) return;
    try { await api.hr.deleteDoc(docType); setDocs(prev => ({ ...prev, [docType]: null })); }
    catch (err) { setError(err.message); }
  }

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.hr.save({ ...form, gdpr_consent: true, gdpr_consent_at: hr?.gdpr_consent_at || new Date().toISOString() });
      setHr(res.data); setSuccess('Saved successfully'); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function acceptGdpr() {
    setSaving(true);
    try {
      const res = await api.hr.save({ ...form, gdpr_consent: true, gdpr_consent_at: new Date().toISOString() });
      setHr(res.data); setTab('home');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <Spinner />;

  // ── Welcome / GDPR Screen ────────────────────────────────────────────────
  if (isFirstTime) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg, #0b1a3e 0%, #1a3a7a 50%, #0b1a3e 100%)'}}>
      <div style={{maxWidth:'560px',margin:'0 auto',padding:'2rem 1.25rem 4rem'}}>
        {/* Welcome header */}
        <div style={{textAlign:'center',padding:'2rem 0 1.5rem'}}>
          {dbUser?.logo_url && <img src={dbUser.logo_url} alt="Company" style={{maxHeight:'48px',maxWidth:'200px',objectFit:'contain',marginBottom:'1rem'}} />}
          <div style={{fontSize:'1.75rem',fontWeight:800,color:'#fff',lineHeight:1.3}}>
            Welcome to the team{dbUser?.first_name ? `, ${dbUser.first_name}` : ''}
          </div>
          <div style={{fontSize:'0.9375rem',color:'rgba(255,255,255,0.55)',marginTop:'0.5rem',lineHeight:1.5}}>
            We're delighted to have you on board. Before you get started, please take a moment to review our data protection commitments to you.
          </div>
        </div>

        {/* Security features */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1.5rem'}}>
          {[
            { icon: '🔒', title: 'End-to-End Encryption', desc: 'Your personal data is encrypted at rest and in transit using industry-standard 256-bit encryption.' },
            { icon: '🏛️', title: 'UK Data Residency', desc: 'All data is stored within UK-based data centres, fully compliant with UK GDPR regulations.' },
            { icon: '👤', title: 'Access Controls', desc: 'Only authorised personnel within your company can access your records. You control what you share.' },
            { icon: '🗑️', title: 'Right to Erasure', desc: 'You can request deletion of your personal data at any time. We will action all requests promptly.' },
          ].map((f, i) => (
            <div key={i} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',padding:'1rem'}}>
              <div style={{fontSize:'1.5rem',marginBottom:'0.5rem'}}>{f.icon}</div>
              <div style={{fontSize:'0.8125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>{f.title}</div>
              <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.45)',lineHeight:1.5}}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Privacy Policy */}
        <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',padding:'1.25rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.75rem'}}>Data Processing Agreement</div>
          <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.55)',lineHeight:1.7,maxHeight:'200px',overflowY:'auto',paddingRight:'0.5rem'}}>
            <p style={{margin:'0 0 0.75rem'}}>By using this portal, you consent to your employer processing the personal data you provide for the following purposes:</p>
            <p style={{margin:'0 0 0.5rem'}}><strong style={{color:'rgba(255,255,255,0.7)'}}>Employment Administration</strong> — Managing your employment records, contact details, and emergency contacts to ensure your safety and welfare during duty.</p>
            <p style={{margin:'0 0 0.5rem'}}><strong style={{color:'rgba(255,255,255,0.7)'}}>Payroll & Financial</strong> — Processing your National Insurance number for payroll purposes as required by HMRC.</p>
            <p style={{margin:'0 0 0.5rem'}}><strong style={{color:'rgba(255,255,255,0.7)'}}>Regulatory Compliance</strong> — Verifying and storing copies of your SIA licence and DBS certificate as required by the Private Security Industry Act 2001 and BS7858 vetting standards.</p>
            <p style={{margin:'0 0 0.5rem'}}><strong style={{color:'rgba(255,255,255,0.7)'}}>Emergency Procedures</strong> — Holding next of kin and emergency contact information to be used in the event of an incident during your duties.</p>
            <p style={{margin:'0 0 0.75rem'}}><strong style={{color:'rgba(255,255,255,0.7)'}}>Data Retention</strong> — Your data will be retained for the duration of your employment plus 6 years in line with HMRC requirements. Non-statutory records can be deleted earlier upon your request.</p>
            <p style={{margin:0}}><strong style={{color:'rgba(255,255,255,0.7)'}}>Your Rights</strong> — Under UK GDPR, you have the right to access, rectify, or erase your personal data at any time. To exercise these rights, contact your line manager or data controller. All requests will be actioned within 30 days.</p>
          </div>
        </div>

        {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#ef4444'}}>{error}</div>}

        <button onClick={acceptGdpr} disabled={saving}
          style={{width:'100%',padding:'1rem',background:'#fff',color:'#0b1a3e',border:'none',borderRadius:'12px',fontSize:'1rem',fontWeight:700,cursor:'pointer',opacity:saving?0.7:1,marginBottom:'0.75rem'}}>
          {saving ? 'Processing...' : 'I Accept — Continue to My Portal'}
        </button>
        <div style={{textAlign:'center',fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)'}}>
          By continuing, you confirm you have read and understood the data processing agreement above.
        </div>
      </div>
    </div>
  );

  // ── Main Portal ──────────────────────────────────────────────────────────
  const tabs = [
    { key:'home', label:'Home' },
    { key:'personal', label:'Personal' },
    { key:'nok', label:'Next of Kin' },
    { key:'documents', label:'Documents' },
    { key:'licence', label:'Licence' },
    { key:'hours', label:'Hours' },
    { key:'updates', label:'Updates' },
    { key:'training', label:'Training' },
    { key:'resources', label:'Resources' },
    { key:'perks', label:'Perks' },
  ];

  const completionItems = [
    { label:'Employment status', done: !!hr?.employment_status },
    { label:'Next of kin', done: !!hr?.nok_name },
    { label:'Address', done: !!hr?.address_line_1 },
    { label:'Date of birth', done: !!hr?.date_of_birth },
    { label:'NI number', done: !!hr?.ni_number },
    { label:'Bank details', done: !!hr?.bank_account_holder },
    { label:'SIA licence (front)', done: !!docs.sia_front },
    { label:'SIA licence (back)', done: !!docs.sia_back },
    { label:'DBS certificate', done: !!docs.dbs_certificate },
  ];
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      {/* Header */}
      <div style={{background:'#0b1a3e',color:'#fff',padding:'0 1.25rem'}}>
        <div style={{maxWidth:'720px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:'56px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
            {dbUser?.logo_url && <img src={dbUser.logo_url} alt="" style={{maxHeight:'28px',maxWidth:'100px',objectFit:'contain'}} />}
            <div>
              <div style={{fontSize:'0.9375rem',fontWeight:700}}>Personnel Portal</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'0.875rem'}}>
            <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)'}}>Session {timeLeft}m</div>
            <button onClick={() => signOut()} style={{padding:'0.375rem 0.75rem',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'rgba(255,255,255,0.7)',fontSize:'0.6875rem',fontWeight:600,cursor:'pointer'}}>Sign Out</button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:10,overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <div style={{maxWidth:'720px',margin:'0 auto',display:'flex',gap:0,padding:'0 1.25rem',minWidth:'max-content'}}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{padding:'0.875rem 0.75rem',background:'none',border:'none',borderBottom: tab===t.key ? '2px solid #1a52a8' : '2px solid transparent',
                color: tab===t.key ? '#1a52a8' : '#6b7280',fontSize:'0.75rem',fontWeight: tab===t.key ? 700 : 500,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:'720px',margin:'0 auto',padding:'1.5rem 1.25rem 4rem'}}>
        {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{error}</div>}
        {success && <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#16a34a'}}>{success}</div>}

        {/* ── HOME TAB ──────────────────────────────────────────────────── */}
        {tab === 'home' && (
          <>
            {/* Welcome banner */}
            <div style={{background:'linear-gradient(135deg, #0b1a3e, #1a3a7a)',borderRadius:'14px',padding:'1.75rem',marginBottom:'1.25rem',color:'#fff'}}>
              <div style={{fontSize:'1.25rem',fontWeight:700,marginBottom:'0.25rem'}}>
                {getGreeting()}, {dbUser?.first_name || 'Officer'}
              </div>
              <div style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.55)'}}>
                Welcome to your personnel portal. Keep your details up to date to ensure your safety and compliance.
              </div>
            </div>

            {/* Profile completion */}
            <div style={S.section}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
                <div style={{fontSize:'0.875rem',fontWeight:700,color:'#111827'}}>Profile Completion</div>
                <div style={{fontSize:'0.875rem',fontWeight:700,color: completionPct === 100 ? '#16a34a' : '#1a52a8'}}>{completionPct}%</div>
              </div>
              {/* Progress bar */}
              <div style={{height:'6px',background:'#e5e7eb',borderRadius:'3px',marginBottom:'1rem',overflow:'hidden'}}>
                <div style={{height:'100%',background: completionPct===100 ? '#16a34a' : 'linear-gradient(90deg, #1a52a8, #3b82f6)',borderRadius:'3px',width:`${completionPct}%`,transition:'width 0.3s'}} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                {completionItems.map((item, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',color: item.done ? '#16a34a' : '#9ca3af'}}>
                    <div style={{width:18,height:18,borderRadius:'50%',background: item.done ? '#dcfce7' : '#f3f4f6',border: item.done ? '1.5px solid #86efac' : '1.5px solid #d1d5db',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {item.done && <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{color: item.done ? '#374151' : '#9ca3af'}}>{item.label}</span>
                  </div>
                ))}
              </div>
              {completionPct < 100 && (
                <button onClick={() => setTab('personal')} style={{width:'100%',padding:'0.75rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.8125rem',fontWeight:700,cursor:'pointer',marginTop:'1rem'}}>
                  Complete Your Profile
                </button>
              )}
            </div>

            {/* Expiry Dates */}
            {(() => {
              const expiryItems = [
                { label: 'SIA Licence', date: dbUser?.sia_expiry_date, type: dbUser?.sia_licence_type },
                ...(dbUser?.sia_expiry_date_2 ? [{ label: 'SIA Licence (2nd)', date: dbUser.sia_expiry_date_2, type: dbUser.sia_licence_type_2 }] : []),
                ...(dbUser?.bs7858_expiry_date ? [{ label: 'BS7858 Vetting', date: dbUser.bs7858_expiry_date }] : []),
              ].filter(e => e.date);
              if (expiryItems.length === 0) return null;
              const now = new Date();
              const threeMonths = new Date(); threeMonths.setMonth(threeMonths.getMonth() + 3);
              return (
                <div style={S.section}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
                    <div style={{fontSize:'0.875rem',fontWeight:700,color:'#111827'}}>Expiry Dates</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
                    {expiryItems.map((item, i) => {
                      const exp = new Date(item.date);
                      const expired = exp < now;
                      const expiringSoon = !expired && exp < threeMonths;
                      const daysLeft = Math.ceil((exp - now) / 86400000);
                      const bg = expired ? '#fef2f2' : expiringSoon ? '#fffbeb' : '#f0fdf4';
                      const border = expired ? '#fca5a5' : expiringSoon ? '#fde68a' : '#86efac';
                      const textColor = expired ? '#dc2626' : expiringSoon ? '#d97706' : '#16a34a';
                      const statusText = expired ? 'EXPIRED' : expiringSoon ? `Expires in ${daysLeft} day${daysLeft!==1?'s':''}` : 'Valid';
                      return (
                        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.875rem',background:bg,border:`1px solid ${border}`,borderRadius:'10px'}}>
                          <div>
                            <div style={{fontSize:'0.875rem',fontWeight:600,color:'#111827'}}>{item.label}</div>
                            <div style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.125rem'}}>
                              {item.type && <>{item.type} · </>}
                              Expires {exp.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                            </div>
                          </div>
                          <div style={{padding:'0.25rem 0.625rem',background: expired ? '#dc2626' : expiringSoon ? '#d97706' : '#16a34a',borderRadius:'6px',fontSize:'0.6875rem',fontWeight:700,color:'#fff'}}>
                            {statusText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Quick actions */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1.25rem'}}>
              {[
                { label:'Personal Details', desc:'Address, DOB, NI number', tab:'personal', color:'#1a52a8' },
                { label:'Next of Kin', desc:'Emergency contact details', tab:'nok', color:'#dc2626' },
                { label:'Documents', desc:'SIA licence, DBS certificate', tab:'documents', color:'#7c3aed' },
                { label:'Licence Details', desc:'SIA type, number, expiry', tab:'licence', color:'#0891b2' },
                { label:'Data & Privacy', desc:'GDPR consent, your rights', tab:'privacy', color:'#059669' },
              ].map((a, i) => (
                <button key={i} onClick={() => setTab(a.tab)}
                  style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'1rem',textAlign:'left',cursor:'pointer',transition:'box-shadow 0.15s'}}>
                  <div style={{fontSize:'0.8125rem',fontWeight:700,color:a.color,marginBottom:'0.25rem'}}>{a.label}</div>
                  <div style={{fontSize:'0.6875rem',color:'#9ca3af',lineHeight:1.4}}>{a.desc}</div>
                </button>
              ))}
            </div>

            {/* Info card */}
            <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'10px',padding:'1rem',fontSize:'0.8125rem',color:'#92400e',lineHeight:1.5}}>
              <div style={{fontWeight:700,marginBottom:'0.25rem'}}>Keep your details current</div>
              Your personal information is used to verify your identity, manage your SIA compliance, and contact your next of kin in an emergency. Keeping this up to date is a requirement of your employment.
            </div>
          </>
        )}

        {/* ── PERSONAL TAB ────────────────────────────────────────────── */}
        {tab === 'personal' && (
          <>
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Personal Details</h2>
              <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0,lineHeight:1.5}}>Your information is encrypted and only accessible by authorised personnel.</p>
            </div>

            {/* Completed summary view */}
            {hr?.address_line_1 && hr?.date_of_birth && hr?.ni_number && hr?.bank_account_holder && !editing ? (
              <>
                <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#16a34a',lineHeight:1.5,marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <strong>Complete</strong> — Your personal details are on file.
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Employment Status</div>
                  <div style={S.readValue}>
                    {hr.employment_status === 'employed' ? 'Employed (PAYE)' : hr.employment_status === 'self_employed' ? 'Self-Employed' : hr.employment_status === 'ltd_company' ? 'Subcontractor (Ltd Company)' : '—'}
                  </div>
                  {hr.employment_status === 'self_employed' && hr.utr_number && (
                    <div style={{marginTop:'0.5rem'}}><div style={S.readLabel}>UTR Number</div><div style={{...S.readValue,fontFamily:'monospace'}}>••••••{hr.utr_number.slice(-4)}</div></div>
                  )}
                  {hr.employment_status === 'ltd_company' && hr.company_name && (
                    <div style={{marginTop:'0.5rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                      <div><div style={S.readLabel}>Company</div><div style={S.readValue}>{hr.company_name}</div></div>
                      {hr.company_reg_number && <div><div style={S.readLabel}>Company No.</div><div style={S.readValue}>{hr.company_reg_number}</div></div>}
                    </div>
                  )}
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Address</div>
                  <div style={{fontSize:'0.875rem',color:'#374151',lineHeight:1.6}}>
                    {hr.address_line_1}{hr.address_line_2 ? `, ${hr.address_line_2}` : ''}<br/>
                    {hr.city}{hr.postcode ? `, ${hr.postcode}` : ''}
                  </div>
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Personal Information</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                    <div><div style={S.readLabel}>Date of Birth</div><div style={S.readValue}>{new Date(hr.date_of_birth).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
                    <div><div style={S.readLabel}>NI Number</div><div style={{...S.readValue,fontFamily:'monospace'}}>••••••••••</div></div>
                    <div style={{gridColumn:'1 / -1'}}><div style={S.readLabel}>Personal Email</div><div style={S.readValue}>{hr.personal_email || '—'}</div></div>
                  </div>
                </div>

                {hr.bank_account_holder && (
                  <div style={S.section}>
                    <div style={S.sectionTitle}>Bank Details</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                      <div style={{gridColumn:'1 / -1'}}><div style={S.readLabel}>Account Holder</div><div style={S.readValue}>{hr.bank_account_holder}</div></div>
                      <div><div style={S.readLabel}>Bank</div><div style={S.readValue}>{hr.bank_name || '—'}</div></div>
                      <div><div style={S.readLabel}>Sort Code</div><div style={{...S.readValue,fontFamily:'monospace'}}>{hr.bank_sort_code || '—'}</div></div>
                      <div><div style={S.readLabel}>Account Number</div><div style={{...S.readValue,fontFamily:'monospace'}}>••••{hr.bank_account_number?.slice(-4) || '—'}</div></div>
                    </div>
                  </div>
                )}

                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button onClick={() => setEditing(true)} style={{flex:1,padding:'0.875rem',background:'#fff',color:'#6b7280',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
                    Edit Details
                  </button>
                  <button onClick={() => setTab('nok')} style={{flex:2,padding:'0.875rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.875rem',fontWeight:700,cursor:'pointer'}}>
                    Continue to Next of Kin →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#1e40af',lineHeight:1.5,marginBottom:'1rem'}}>
                  <strong>Why we need this:</strong> Your address is required for payroll, tax correspondence, and in case emergency services need to attend your home address following a serious incident on duty. Your date of birth and NI number are legal requirements for HMRC payroll processing.
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Employment Status</div>
                  <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.75rem',lineHeight:1.5}}>
                    Please select your employment arrangement. This determines how you are paid and what tax information we require.
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                    {[
                      { value:'employed', label:'Employed (PAYE)', desc:'You are paid through our payroll with tax and NI deducted at source.' },
                      { value:'self_employed', label:'Self-Employed', desc:'You invoice for your services and manage your own tax via Self Assessment.' },
                      { value:'ltd_company', label:'Subcontractor (Ltd Company)', desc:'You operate through a limited company and invoice us as a business.' },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => f('employment_status', opt.value)}
                        style={{textAlign:'left',padding:'0.875rem',background: form.employment_status===opt.value ? '#eff6ff' : '#fff',
                          border: form.employment_status===opt.value ? '2px solid #1a52a8' : '1.5px solid #e5e7eb',
                          borderRadius:'10px',cursor:'pointer',transition:'all 0.15s'}}>
                        <div style={{fontSize:'0.875rem',fontWeight:700,color: form.employment_status===opt.value ? '#1a52a8' : '#111827',marginBottom:'0.125rem'}}>{opt.label}</div>
                        <div style={{fontSize:'0.75rem',color:'#6b7280',lineHeight:1.4}}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Self-employed: UTR number */}
                {form.employment_status === 'self_employed' && (
                  <div style={S.section}>
                    <div style={S.sectionTitle}>Self-Employment Details</div>
                    <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.75rem',lineHeight:1.5}}>
                      Your Unique Taxpayer Reference (UTR) is required for CIS verification and our records.
                    </div>
                    <div>
                      <label style={S.fieldLabel}>UTR Number</label>
                      <input value={form.utr_number} onChange={e => f('utr_number', e.target.value.replace(/\D/g,''))} placeholder="10-digit number" maxLength={10} style={{...S.fieldInput, fontFamily:'monospace', letterSpacing:'0.05em'}} />
                    </div>
                  </div>
                )}

                {/* Ltd company: company details */}
                {form.employment_status === 'ltd_company' && (
                  <div style={S.section}>
                    <div style={S.sectionTitle}>Company Details</div>
                    <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.75rem',lineHeight:1.5}}>
                      We need your company information for invoicing and compliance purposes.
                    </div>
                    <div style={{marginBottom:'0.75rem'}}>
                      <label style={S.fieldLabel}>Company Name</label>
                      <input value={form.company_name} onChange={e => f('company_name', e.target.value)} placeholder="e.g. Smith Security Ltd" style={S.fieldInput} />
                    </div>
                    <div style={{marginBottom:'0.75rem'}}>
                      <label style={S.fieldLabel}>Registered Address</label>
                      <input value={form.company_address} onChange={e => f('company_address', e.target.value)} placeholder="Full registered address" style={S.fieldInput} />
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                      <div>
                        <label style={S.fieldLabel}>Company Number</label>
                        <input value={form.company_reg_number} onChange={e => f('company_reg_number', e.target.value)} placeholder="e.g. 12345678" maxLength={8} style={{...S.fieldInput, fontFamily:'monospace'}} />
                      </div>
                      <div>
                        <label style={S.fieldLabel}>VAT Number (if registered)</label>
                        <input value={form.company_vat_number} onChange={e => f('company_vat_number', e.target.value)} placeholder="GB 123 4567 89" style={{...S.fieldInput, fontFamily:'monospace'}} />
                      </div>
                    </div>
                  </div>
                )}

                <div style={S.section}>
                  <div style={S.sectionTitle}>Address</div>
                  <div style={{marginBottom:'0.75rem'}}>
                    <label style={S.fieldLabel}>Address Line 1</label>
                    <input value={form.address_line_1} onChange={e => f('address_line_1', e.target.value)} style={S.fieldInput} />
                  </div>
                  <div style={{marginBottom:'0.75rem'}}>
                    <label style={S.fieldLabel}>Address Line 2</label>
                    <input value={form.address_line_2} onChange={e => f('address_line_2', e.target.value)} style={S.fieldInput} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'0.75rem'}}>
                    <div><label style={S.fieldLabel}>City / Town</label><input value={form.city} onChange={e => f('city', e.target.value)} style={S.fieldInput} /></div>
                    <div><label style={S.fieldLabel}>Postcode</label><input value={form.postcode} onChange={e => f('postcode', e.target.value)} placeholder="AB1 2CD" style={S.fieldInput} /></div>
                  </div>
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Personal Information</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                    <div>
                      <label style={S.fieldLabel}>Date of Birth</label>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.375rem'}}>
                        <select value={form.date_of_birth ? parseInt(form.date_of_birth.split('-')[2]) : ''} onChange={e => {
                          const parts = (form.date_of_birth || '--').split('-');
                          f('date_of_birth', `${parts[0]||'2000'}-${parts[1]||'01'}-${String(e.target.value).padStart(2,'0')}`);
                        }} style={S.fieldInput}>
                          <option value="">Day</option>
                          {Array.from({length:31},(_,i)=>i+1).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={form.date_of_birth ? parseInt(form.date_of_birth.split('-')[1]) : ''} onChange={e => {
                          const parts = (form.date_of_birth || '--').split('-');
                          f('date_of_birth', `${parts[0]||'2000'}-${String(e.target.value).padStart(2,'0')}-${parts[2]||'01'}`);
                        }} style={S.fieldInput}>
                          <option value="">Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                        <select value={form.date_of_birth ? parseInt(form.date_of_birth.split('-')[0]) : ''} onChange={e => {
                          const parts = (form.date_of_birth || '--').split('-');
                          f('date_of_birth', `${e.target.value}-${parts[1]||'01'}-${parts[2]||'01'}`);
                        }} style={S.fieldInput}>
                          <option value="">Year</option>
                          {Array.from({length:60},(_,i)=>new Date().getFullYear()-16-i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={S.fieldLabel}>NI Number</label>
                      <input value={form.ni_number} onChange={e => f('ni_number', e.target.value.toUpperCase())} placeholder="AB 12 34 56 C" maxLength={13} style={{...S.fieldInput, fontFamily:'monospace', letterSpacing:'0.05em'}} />
                    </div>
                    <div style={{gridColumn:'1 / -1'}}>
                      <label style={S.fieldLabel}>Personal Email Address</label>
                      <input type="email" value={form.personal_email} onChange={e => f('personal_email', e.target.value)} placeholder="you@example.com" style={S.fieldInput} />
                      <div style={{fontSize:'0.6875rem',color:'#9ca3af',marginTop:'0.375rem'}}>Used to send you copies of invoices and important correspondence.</div>
                    </div>
                  </div>
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Bank Details</div>
                  <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.75rem',lineHeight:1.5}}>
                    Required for salary payments or invoice settlement. Please enter details exactly as they appear on your bank statement.
                  </div>
                  <div style={{marginBottom:'0.75rem'}}>
                    <label style={S.fieldLabel}>Account Holder Name (as it appears on your bank statement)</label>
                    <input value={form.bank_account_holder} onChange={e => f('bank_account_holder', e.target.value)} placeholder="e.g. Mr J Smith" style={S.fieldInput} />
                  </div>
                  <div style={{marginBottom:'0.75rem'}}>
                    <label style={S.fieldLabel}>Bank Name</label>
                    <input value={form.bank_name} onChange={e => f('bank_name', e.target.value)} placeholder="e.g. Barclays, Lloyds, Monzo" style={S.fieldInput} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                    <div>
                      <label style={S.fieldLabel}>Sort Code</label>
                      <input value={form.bank_sort_code} onChange={e => f('bank_sort_code', e.target.value)} placeholder="00-00-00" maxLength={8} style={{...S.fieldInput, fontFamily:'monospace', letterSpacing:'0.05em'}} />
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Account Number</label>
                      <input value={form.bank_account_number} onChange={e => f('bank_account_number', e.target.value)} placeholder="12345678" maxLength={8} style={{...S.fieldInput, fontFamily:'monospace', letterSpacing:'0.05em'}} />
                    </div>
                  </div>
                  <div style={{fontSize:'0.6875rem',color:'#9ca3af',marginTop:'0.5rem',display:'flex',alignItems:'center',gap:'0.375rem'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Encrypted at rest. Only accessible by authorised administrators.
                  </div>
                </div>

                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button onClick={() => { setEditing(false); setTab('home'); }} style={{flex:1,padding:'0.875rem',background:'#fff',color:'#6b7280',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
                    Back
                  </button>
                  <button onClick={async () => { await save(); setEditing(false); setTab('nok'); }} disabled={saving} style={{flex:2,...S.btn, opacity:saving?0.7:1,marginTop:0}}>
                    {saving ? 'Saving...' : 'Save & Continue →'}
                  </button>
                </div>
                <div style={{textAlign:'center',marginTop:'0.75rem'}}>
                  <span style={{fontSize:'0.6875rem',color:'#9ca3af'}}>Step 1 of 3 — Next: Emergency Contact</span>
                </div>
              </>
            )}
          </>
        )}

        {/* ── NEXT OF KIN TAB ──────────────────────────────────────── */}
        {tab === 'nok' && (
          <>
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Next of Kin</h2>
              <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0,lineHeight:1.5}}>Your emergency contact will be notified in the event of a serious incident during your duties.</p>
            </div>

            {/* Completed summary view */}
            {hr?.nok_name && hr?.nok_phone && !editing ? (
              <>
                <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#16a34a',lineHeight:1.5,marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <strong>Complete</strong> — Your emergency contact is on file.
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Emergency Contact</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                    <div><div style={S.readLabel}>Name</div><div style={S.readValue}>{hr.nok_name}</div></div>
                    <div><div style={S.readLabel}>Relationship</div><div style={S.readValue}>{hr.nok_relationship || '—'}</div></div>
                    <div><div style={S.readLabel}>Phone</div><div style={S.readValue}>{hr.nok_phone}</div></div>
                  </div>
                </div>

                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button onClick={() => setEditing(true)} style={{flex:1,padding:'0.875rem',background:'#fff',color:'#6b7280',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
                    Edit Details
                  </button>
                  <button onClick={() => setTab('documents')} style={{flex:2,padding:'0.875rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.875rem',fontWeight:700,cursor:'pointer'}}>
                    Continue to Documents →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#92400e',lineHeight:1.5,marginBottom:'1rem'}}>
                  <strong>Why we need this:</strong> As a lone worker, your safety is our priority. If you are involved in a serious incident during your duties, our national command centre will contact your next of kin immediately. Without this information, we cannot notify your family in an emergency.
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>Emergency Contact</div>
                  <div style={{marginBottom:'0.75rem'}}>
                    <label style={S.fieldLabel}>Full Name</label>
                    <input value={form.nok_name} onChange={e => f('nok_name', e.target.value)} placeholder="e.g. Jane Smith" style={S.fieldInput} />
                  </div>
                  <div style={{marginBottom:'0.75rem'}}>
                    <label style={S.fieldLabel}>Relationship</label>
                    <select value={form.nok_relationship} onChange={e => f('nok_relationship', e.target.value)} style={S.fieldInput}>
                      <option value="">Select...</option>
                      {['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.fieldLabel}>Phone Number</label>
                    <input value={form.nok_phone} onChange={e => f('nok_phone', e.target.value)} placeholder="+44 7700 000000" style={S.fieldInput} />
                  </div>
                </div>

                <div style={{display:'flex',gap:'0.75rem'}}>
                  <button onClick={() => { setEditing(false); setTab('personal'); }} style={{flex:1,padding:'0.875rem',background:'#fff',color:'#6b7280',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
                    ← Back
                  </button>
                  <button onClick={async () => { await save(); setEditing(false); setTab('documents'); }} disabled={saving} style={{flex:2,...S.btn, opacity:saving?0.7:1,marginTop:0}}>
                    {saving ? 'Saving...' : 'Save & Continue →'}
                  </button>
                </div>
                <div style={{textAlign:'center',marginTop:'0.75rem'}}>
                  <span style={{fontSize:'0.6875rem',color:'#9ca3af'}}>Step 2 of 3 — Next: Documents</span>
                </div>
              </>
            )}
          </>
        )}

        {/* ── DOCUMENTS TAB ───────────────────────────────────────────── */}
        {tab === 'documents' && (
          <>
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Documents</h2>
              <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0,lineHeight:1.5}}>Upload your identification documents. These are stored in a private vault with time-limited access.</p>
            </div>

            <div style={{background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#5b21b6',lineHeight:1.5,marginBottom:'1rem'}}>
              <strong>Why we need this:</strong> Under the Private Security Industry Act 2001, your employer must hold a verified copy of your SIA licence. Your DBS certificate confirms you have been vetted to BS7858 standards. These documents are stored in a secure, encrypted vault and are only accessible to authorised compliance staff.
            </div>

            {createPortal(
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={handleUpload} />,
              document.body
            )}

            {[
              { key:'sia_front', label:'SIA Licence — Front', desc:'Clear photo of the front of your SIA badge showing your name, licence number, and type.', icon:'🪪' },
              { key:'sia_back', label:'SIA Licence — Back', desc:'Photo of the back of your SIA badge showing the barcode and expiry date.', icon:'🪪' },
              { key:'dbs_certificate', label:'DBS Certificate', desc:'Scan or photo of your Disclosure and Barring Service certificate.', icon:'📄' },
            ].map(doc => (
              <div key={doc.key} style={{...S.section, display:'flex',alignItems:'flex-start',gap:'1rem'}}>
                <div style={{width:'44px',height:'44px',background: docs[doc.key] ? '#dcfce7' : '#f3f4f6',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.25rem',flexShrink:0,border: docs[doc.key] ? '1px solid #86efac' : '1px solid #e5e7eb'}}>
                  {docs[doc.key] ? <svg width="20" height="20" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : doc.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'0.875rem',fontWeight:700,color:'#111827',marginBottom:'0.125rem'}}>{doc.label}</div>
                  <div style={{fontSize:'0.75rem',color: docs[doc.key] ? '#16a34a' : '#9ca3af',marginBottom:'0.625rem',lineHeight:1.4}}>
                    {docs[doc.key] ? 'Uploaded and stored securely' : doc.desc}
                  </div>
                  <div style={{display:'flex',gap:'0.375rem'}}>
                    {docs[doc.key] && (
                      <>
                        <button onClick={() => viewDoc(doc.key)} style={S.docBtn}>View</button>
                        <button onClick={() => deleteDoc(doc.key)} style={{...S.docBtn, color:'#dc2626', borderColor:'#fecaca'}}>Remove</button>
                      </>
                    )}
                    <button onClick={() => { setUploadTarget(doc.key); fileRef.current?.click(); }} disabled={uploading===doc.key}
                      style={{...S.docBtn, background: docs[doc.key] ? '#fff' : '#1a52a8', color: docs[doc.key] ? '#374151' : '#fff', borderColor: docs[doc.key] ? '#d1d5db' : '#1a52a8'}}>
                      {uploading===doc.key ? 'Uploading...' : docs[doc.key] ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div style={{display:'flex',gap:'0.75rem',marginTop:'1rem'}}>
              <button onClick={() => setTab('nok')} style={{flex:1,padding:'0.875rem',background:'#fff',color:'#6b7280',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
                ← Back
              </button>
              <button onClick={() => setTab('home')} style={{flex:2,padding:'0.875rem',background:'#16a34a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.875rem',fontWeight:700,cursor:'pointer'}}>
                Done — Return to Home
              </button>
            </div>
            <div style={{textAlign:'center',marginTop:'0.75rem'}}>
              <span style={{fontSize:'0.6875rem',color:'#9ca3af'}}>Step 3 of 3 — Upload your documents to complete your profile</span>
            </div>
          </>
        )}

        {/* ── LICENCE TAB ─────────────────────────────────────────────── */}
        {tab === 'licence' && (
          <>
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Licence Details</h2>
              <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0}}>Your SIA licence information as held by your employer. Contact your manager to update.</p>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Primary SIA Licence</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                <div>
                  <div style={S.readLabel}>Licence Type</div>
                  <div style={S.readValue}>{dbUser?.sia_licence_type || 'Not set'}</div>
                </div>
                <div>
                  <div style={S.readLabel}>Licence Number</div>
                  <div style={{...S.readValue, fontFamily:'monospace', letterSpacing:'0.05em'}}>{dbUser?.sia_licence_number || 'Not set'}</div>
                </div>
                <div>
                  <div style={S.readLabel}>Expiry Date</div>
                  <div style={{...S.readValue, color: dbUser?.sia_expiry_date && new Date(dbUser.sia_expiry_date) < new Date() ? '#dc2626' : '#111827'}}>
                    {dbUser?.sia_expiry_date ? new Date(dbUser.sia_expiry_date).toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'}) : 'Not set'}
                    {dbUser?.sia_expiry_date && new Date(dbUser.sia_expiry_date) < new Date() && <span style={{marginLeft:'0.5rem',fontSize:'0.6875rem',fontWeight:700,color:'#dc2626',background:'#fef2f2',padding:'2px 6px',borderRadius:'4px'}}>EXPIRED</span>}
                  </div>
                </div>
                <div>
                  <div style={S.readLabel}>Status</div>
                  <div style={S.readValue}>
                    {dbUser?.sia_expiry_date ? (
                      new Date(dbUser.sia_expiry_date) > new Date()
                        ? <span style={{color:'#16a34a',fontWeight:600}}>Valid</span>
                        : <span style={{color:'#dc2626',fontWeight:600}}>Expired</span>
                    ) : <span style={{color:'#9ca3af'}}>Unknown</span>}
                  </div>
                </div>
              </div>
            </div>

            {dbUser?.sia_licence_type_2 && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Second SIA Licence</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                  <div><div style={S.readLabel}>Licence Type</div><div style={S.readValue}>{dbUser.sia_licence_type_2}</div></div>
                  <div><div style={S.readLabel}>Licence Number</div><div style={{...S.readValue, fontFamily:'monospace'}}>{dbUser.sia_licence_number_2 || 'Not set'}</div></div>
                  <div><div style={S.readLabel}>Expiry Date</div><div style={S.readValue}>{dbUser.sia_expiry_date_2 ? new Date(dbUser.sia_expiry_date_2).toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'}) : 'Not set'}</div></div>
                </div>
              </div>
            )}

            {dbUser?.bs7858_expiry_date && (
              <div style={S.section}>
                <div style={S.sectionTitle}>BS7858 Vetting</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                  <div><div style={S.readLabel}>Clearance Date</div><div style={S.readValue}>{dbUser.bs7858_clearance_date ? new Date(dbUser.bs7858_clearance_date).toLocaleDateString('en-GB') : 'Not set'}</div></div>
                  <div><div style={S.readLabel}>Expiry Date</div><div style={S.readValue}>{new Date(dbUser.bs7858_expiry_date).toLocaleDateString('en-GB')}</div></div>
                </div>
              </div>
            )}

            <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#1e40af',lineHeight:1.5}}>
              Licence details are managed by your employer. If any information is incorrect, please contact your line manager or operations team.
            </div>
          </>
        )}

        {/* ── HOURS TAB ──────────────────────────────────────────────── */}
        {tab === 'hours' && (
          <HoursTab
            hr={hr} dbUser={dbUser} form={form}
            shifts={shifts} setShifts={setShifts}
            shiftsLoading={shiftsLoading} setShiftsLoading={setShiftsLoading}
            invoiceShifts={invoiceShifts} setInvoiceShifts={setInvoiceShifts}
            showInvoice={showInvoice} setShowInvoice={setShowInvoice}
            invoiceRef={invoiceRef} setInvoiceRef={setInvoiceRef}
          />
        )}

        {/* ── UPDATES TAB ────────────────────────────────────────────── */}
        {tab === 'updates' && <HRUpdatesTab />}

        {/* ── TRAINING TAB ───────────────────────────────────────────── */}
        {tab === 'training' && (
          <div style={{padding:'2rem',textAlign:'center'}}>
            <div style={{fontSize:'2.5rem',marginBottom:'1rem'}}>🎓</div>
            <h2 style={{fontSize:'1.25rem',fontWeight:700,color:'#111827',margin:'0 0 0.5rem'}}>Training & Development</h2>
            <p style={{fontSize:'0.875rem',color:'#6b7280',lineHeight:1.6,maxWidth:'400px',margin:'0 auto 1.5rem'}}>
              Courses, certifications, and professional development resources for security professionals. Coming soon.
            </p>
            <div style={{display:'inline-block',padding:'0.5rem 1.25rem',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'20px',fontSize:'0.8125rem',fontWeight:600,color:'#1a52a8'}}>
              Coming Soon
            </div>
          </div>
        )}

        {/* ── RESOURCES TAB ──────────────────────────────────────────── */}
        {tab === 'resources' && (
          <div style={{padding:'2rem',textAlign:'center'}}>
            <div style={{fontSize:'2.5rem',marginBottom:'1rem'}}>📚</div>
            <h2 style={{fontSize:'1.25rem',fontWeight:700,color:'#111827',margin:'0 0 0.5rem'}}>Officer Resources</h2>
            <p style={{fontSize:'0.875rem',color:'#6b7280',lineHeight:1.6,maxWidth:'400px',margin:'0 auto 1.5rem'}}>
              Useful links, guides, and reference materials for officers. Coming soon.
            </p>
            <div style={{display:'inline-block',padding:'0.5rem 1.25rem',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'20px',fontSize:'0.8125rem',fontWeight:600,color:'#1a52a8'}}>
              Coming Soon
            </div>
          </div>
        )}

        {/* ── PERKS TAB ──────────────────────────────────────────────── */}
        {tab === 'perks' && (
          <div style={{padding:'2rem',textAlign:'center'}}>
            <div style={{fontSize:'2.5rem',marginBottom:'1rem'}}>🎁</div>
            <h2 style={{fontSize:'1.25rem',fontWeight:700,color:'#111827',margin:'0 0 0.5rem'}}>Officer Perks & Discounts</h2>
            <p style={{fontSize:'0.875rem',color:'#6b7280',lineHeight:1.6,maxWidth:'400px',margin:'0 auto 1.5rem'}}>
              Exclusive discounts on food, fitness, entertainment, fuel, and more — all for security professionals. Coming soon.
            </p>
            <div style={{display:'inline-block',padding:'0.5rem 1.25rem',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'20px',fontSize:'0.8125rem',fontWeight:600,color:'#1a52a8'}}>
              Coming Soon
            </div>
          </div>
        )}

        {/* ── PRIVACY TAB ─────────────────────────────────────────────── */}
        {tab === 'privacy' && (
          <>
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Data & Privacy</h2>
              <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0}}>Your rights under UK GDPR and how we protect your data.</p>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Consent Status</div>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.5rem'}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div style={{fontSize:'0.875rem',fontWeight:600,color:'#16a34a'}}>Data processing consent given</div>
                  {hr?.gdpr_consent_at && <div style={{fontSize:'0.75rem',color:'#9ca3af'}}>Recorded on {new Date(hr.gdpr_consent_at).toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'})}</div>}
                </div>
              </div>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Your Rights</div>
              {[
                { title:'Right of Access', desc:'You can request a copy of all personal data we hold about you at any time.' },
                { title:'Right to Rectification', desc:'If any of your data is inaccurate, you can update it here or request a correction from your employer.' },
                { title:'Right to Erasure', desc:'You can request deletion of your personal data. Statutory records (required by HMRC/SIA) may need to be retained.' },
                { title:'Right to Data Portability', desc:'You can request your data in a machine-readable format to transfer to another employer.' },
                { title:'Right to Object', desc:'You can object to the processing of your data in certain circumstances.' },
              ].map((r, i) => (
                <div key={i} style={{padding:'0.75rem 0',borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none'}}>
                  <div style={{fontSize:'0.8125rem',fontWeight:600,color:'#111827',marginBottom:'0.125rem'}}>{r.title}</div>
                  <div style={{fontSize:'0.75rem',color:'#6b7280',lineHeight:1.5}}>{r.desc}</div>
                </div>
              ))}
            </div>

            <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#475569',lineHeight:1.5}}>
              To exercise any of these rights or raise a concern, contact your line manager or email your company's data controller. All requests will be actioned within 30 calendar days.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HoursTab({ hr, dbUser, form, shifts, setShifts, shiftsLoading, setShiftsLoading, invoiceShifts, setInvoiceShifts, showInvoice, setShowInvoice, invoiceRef, setInvoiceRef }) {
  const isSelfEmployed = hr?.employment_status === 'self_employed' || hr?.employment_status === 'ltd_company';
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  const [shiftsError, setShiftsError] = useState('');
  useEffect(() => {
    setShiftsLoading(true); setShiftsError('');
    api.shifts.list({ status: 'COMPLETED' })
      .then(res => setShifts(res.data || []))
      .catch(err => { console.error('Shifts load failed:', err); setShiftsError(err.message || 'Failed to load shifts'); })
      .finally(() => setShiftsLoading(false));
  }, []);

  function getHours(shift) {
    const start = shift.checked_in_at || shift.start_time;
    const end = shift.checked_out_at || shift.end_time;
    if (!start || !end) return 0;
    return Math.round(((new Date(end) - new Date(start)) / 3600000) * 100) / 100;
  }

  function toggleInvoiceShift(shiftId) {
    setInvoiceShifts(prev => prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]);
  }

  // Filter shifts by selected month
  const monthShifts = shifts.filter(s => {
    const d = new Date(s.start_time);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === selectedMonth;
  });

  // Get available months from shifts
  const availableMonths = [...new Set(shifts.map(s => {
    const d = new Date(s.start_time);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }))].sort().reverse();

  const selectedShifts = monthShifts;
  const totalHours = selectedShifts.reduce((sum, s) => sum + getHours(s), 0);
  const totalAmount = selectedShifts.reduce((sum, s) => sum + (getHours(s) * (s.pay_rate || 0)), 0);

  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [declAccepted, setDeclAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function sendInvoice(ref) {
    setInvoiceSending(true);
    try {
      const invoiceData = {
        invoiceRef: ref,
        month: formatMonth(selectedMonth),
        shifts: selectedShifts.map(s => ({
          date: new Date(s.start_time).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
          site: s.site?.name || '—',
          times: `${new Date(s.checked_in_at||s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}–${new Date(s.checked_out_at||s.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}`,
          hours: getHours(s).toFixed(2),
          rate: (s.pay_rate || 0).toFixed(2),
          amount: (getHours(s) * (s.pay_rate || 0)).toFixed(2),
        })),
        contractor: {
          name: hr?.employment_status === 'ltd_company' ? (form.company_name || `${dbUser?.first_name} ${dbUser?.last_name}`) : `${dbUser?.first_name} ${dbUser?.last_name}`,
          address: hr?.employment_status === 'ltd_company' ? form.company_address : [hr?.address_line_1, hr?.city, hr?.postcode].filter(Boolean).join(', '),
          company_reg: form.company_reg_number || null,
          vat: form.company_vat_number || null,
          utr: form.utr_number || hr?.utr_number || null,
          sia_number: dbUser?.sia_licence_number || null,
          sia_type: dbUser?.sia_licence_type || null,
          sia_expiry: dbUser?.sia_expiry_date ? new Date(dbUser.sia_expiry_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : null,
          is_ltd: hr?.employment_status === 'ltd_company',
          bank_name: form.bank_name || hr?.bank_name || null,
          bank_sort_code: form.bank_sort_code || hr?.bank_sort_code || null,
          bank_account_number: form.bank_account_number || hr?.bank_account_number || null,
          bank_account_holder: form.bank_account_holder || hr?.bank_account_holder || null,
        },
        totals: {
          hours: totalHours.toFixed(2),
          subtotal: totalAmount.toFixed(2),
          vat: (hr?.employment_status === 'ltd_company' && form.company_vat_number) ? (totalAmount * 0.2).toFixed(2) : null,
          total: (hr?.employment_status === 'ltd_company' && form.company_vat_number) ? (totalAmount * 1.2).toFixed(2) : totalAmount.toFixed(2),
        },
      };
      const res = await api.hr.sendInvoice(invoiceData);
      if (res.emailSent) setInvoiceSent(true);
      else alert('Invoice generated but email could not be sent. Please use Print to save as PDF.');
    } catch (err) { alert('Failed to send invoice: ' + err.message); }
    finally { setInvoiceSending(false); }
  }

  if (showInvoice) {
    const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
    const ref = invoiceRef || `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    if (!invoiceRef) setInvoiceRef(ref);

    return (
      <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
          <button onClick={() => { setShowInvoice(false); setInvoiceSent(false); }} style={{padding:'0.5rem 0.75rem',background:'#fff',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'0.8125rem',fontWeight:600,color:'#374151',cursor:'pointer'}}>← Back</button>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button onClick={() => window.print()} style={{padding:'0.5rem 0.75rem',background:'#fff',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'0.8125rem',fontWeight:600,color:'#374151',cursor:'pointer'}}>Print / PDF</button>
            {invoiceSent ? (
              <div style={{padding:'0.5rem 0.75rem',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'6px',fontSize:'0.8125rem',fontWeight:600,color:'#16a34a',display:'flex',alignItems:'center',gap:'0.375rem'}}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Sent to Accounts
              </div>
            ) : (
              <button onClick={() => sendInvoice(ref)} disabled={invoiceSending || !declAccepted || !termsAccepted}
                style={{padding:'0.5rem 0.75rem',background:'#1a52a8',border:'none',borderRadius:'6px',fontSize:'0.8125rem',fontWeight:600,color:'#fff',cursor:'pointer',opacity:(invoiceSending || !declAccepted || !termsAccepted)?0.5:1}}>
                {invoiceSending ? 'Sending...' : !declAccepted || !termsAccepted ? 'Accept declaration to send' : 'Email to Accounts'}
              </button>
            )}
          </div>
        </div>

        {/* Professional Invoice */}
        <div id="invoice-print" style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'2rem',fontSize:'0.875rem',color:'#111827'}}>
          {/* Header */}
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2rem'}}>
            <div>
              <div style={{fontSize:'1.5rem',fontWeight:800,color:'#0b1a3e',marginBottom:'0.25rem'}}>INVOICE</div>
              <div style={{fontSize:'0.8125rem',color:'#6b7280'}}>Ref: {ref}</div>
              <div style={{fontSize:'0.8125rem',color:'#6b7280'}}>Date: {today}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,fontSize:'1rem',color:'#0b1a3e'}}>{hr?.employment_status === 'ltd_company' ? (form.company_name || 'Company Name') : `${dbUser?.first_name || ''} ${dbUser?.last_name || ''}`}</div>
              {hr?.address_line_1 && <div style={{fontSize:'0.8125rem',color:'#374151',marginTop:'0.375rem',lineHeight:1.5}}>
                {hr.address_line_1}<br/>
                {hr.address_line_2 && <>{hr.address_line_2}<br/></>}
                {hr.city && <>{hr.city}<br/></>}
                {hr.postcode}
              </div>}
              {hr?.employment_status === 'ltd_company' && form.company_reg_number && <div style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.375rem'}}>Company No: {form.company_reg_number}</div>}
              {hr?.employment_status === 'ltd_company' && form.company_vat_number && <div style={{fontSize:'0.75rem',color:'#6b7280'}}>VAT Reg: {form.company_vat_number}</div>}
              {hr?.personal_email && <div style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.25rem'}}>{hr.personal_email}</div>}
            </div>
          </div>

          {/* Contractor details */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1.5rem',padding:'0.875rem',background:'#f8fafc',borderRadius:'8px',fontSize:'0.8125rem'}}>
            <div>
              <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.375rem'}}>Contractor Details</div>
              <div style={{color:'#374151'}}><strong>UTR:</strong> {form.utr_number || hr?.utr_number || '—'}</div>
              <div style={{color:'#374151'}}><strong>SIA Licence:</strong> {dbUser?.sia_licence_number || '—'}</div>
              <div style={{color:'#374151'}}><strong>SIA Expiry:</strong> {dbUser?.sia_expiry_date ? new Date(dbUser.sia_expiry_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</div>
              <div style={{color:'#374151'}}><strong>SIA Type:</strong> {dbUser?.sia_licence_type || '—'}</div>
            </div>
            <div>
              <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.375rem'}}>Bill To</div>
              <div style={{fontWeight:600,color:'#111827'}}>Risk Secured Ltd</div>
              <div style={{color:'#6b7280'}}>128 City Road</div>
              <div style={{color:'#6b7280'}}>London EC1V 2NX</div>
            </div>
          </div>

          {/* Line items */}
          <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'1.5rem'}}>
            <thead>
              <tr style={{borderBottom:'2px solid #e5e7eb'}}>
                <th style={{textAlign:'left',padding:'0.5rem 0',fontSize:'0.7rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Date</th>
                <th style={{textAlign:'left',padding:'0.5rem 0',fontSize:'0.7rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Site</th>
                <th style={{textAlign:'center',padding:'0.5rem 0',fontSize:'0.7rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>From–To</th>
                <th style={{textAlign:'right',padding:'0.5rem 0',fontSize:'0.7rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Hours</th>
                <th style={{textAlign:'right',padding:'0.5rem 0',fontSize:'0.7rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Rate</th>
                <th style={{textAlign:'right',padding:'0.5rem 0',fontSize:'0.7rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedShifts.map(s => {
                const hrs = getHours(s);
                const rate = s.pay_rate || 0;
                return (
                  <tr key={s.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={{padding:'0.5rem 0'}}>{new Date(s.start_time).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    <td style={{padding:'0.5rem 0'}}>{s.site?.name || '—'}</td>
                    <td style={{padding:'0.5rem 0',textAlign:'center',fontSize:'0.8125rem'}}>{new Date(s.checked_in_at||s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}–{new Date(s.checked_out_at||s.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</td>
                    <td style={{padding:'0.5rem 0',textAlign:'right'}}>{hrs.toFixed(2)}</td>
                    <td style={{padding:'0.5rem 0',textAlign:'right'}}>£{rate.toFixed(2)}</td>
                    <td style={{padding:'0.5rem 0',textAlign:'right',fontWeight:600}}>£{(hrs * rate).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{borderTop:'2px solid #0b1a3e',paddingTop:'0.75rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'0.8125rem',color:'#6b7280'}}>Total Hours: {totalHours.toFixed(2)}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'0.75rem',color:'#6b7280'}}>Subtotal</div>
              <div style={{fontSize:'1.5rem',fontWeight:800,color:'#0b1a3e'}}>£{totalAmount.toFixed(2)}</div>
              {hr?.employment_status === 'ltd_company' && form.company_vat_number && (
                <>
                  <div style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.25rem'}}>VAT (20%): £{(totalAmount * 0.2).toFixed(2)}</div>
                  <div style={{fontSize:'1.125rem',fontWeight:700,color:'#0b1a3e'}}>Total Inc. VAT: £{(totalAmount * 1.2).toFixed(2)}</div>
                </>
              )}
            </div>
          </div>

          {/* Self-employment declaration */}
          <div style={{marginTop:'1.5rem',padding:'1rem',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'8px',fontSize:'0.75rem',color:'#92400e',lineHeight:1.6}}>
            <div style={{fontWeight:700,marginBottom:'0.5rem',fontSize:'0.8125rem'}}>Self-Employment Declaration</div>
            <p style={{margin:'0 0 0.5rem'}}>I confirm that I am {hr?.employment_status === 'ltd_company' ? 'operating through a limited company' : 'self-employed'} for the purposes of this engagement and that this is not a contract of employment. I acknowledge that:</p>
            <ul style={{margin:'0 0 0.75rem',paddingLeft:'1.25rem'}}>
              <li>I am responsible for the payment of my own Income Tax and National Insurance Contributions in accordance with the Income Tax (Earnings and Pensions) Act 2003 and the Social Security Contributions and Benefits Act 1992.</li>
              <li>I am not entitled to employment rights including, but not limited to, statutory sick pay, holiday pay, or pension contributions under the Employment Rights Act 1996.</li>
              <li>I am responsible for registering with HMRC for Self Assessment and submitting my own tax returns by the statutory deadlines.</li>
              <li>I hold a valid SIA licence as required under the Private Security Industry Act 2001 and will notify the engaging company immediately if my licence is revoked, suspended, or expires.</li>
              {hr?.employment_status === 'ltd_company' && <li>My company is registered with Companies House and I am responsible for meeting all obligations under the Companies Act 2006 including filing annual accounts and confirmation statements.</li>}
            </ul>

            <div style={{borderTop:'1px solid #fde68a',paddingTop:'0.75rem',display:'flex',flexDirection:'column',gap:'0.625rem'}}>
              <label style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',cursor:'pointer'}}>
                <input type="checkbox" checked={declAccepted} onChange={e => setDeclAccepted(e.target.checked)}
                  style={{width:'18px',height:'18px',accentColor:'#1a52a8',cursor:'pointer',flexShrink:0,marginTop:'1px'}} />
                <span style={{color:'#374151',fontWeight:600}}>I confirm the above self-employment declaration is true and accurate, and I accept full responsibility for my own tax affairs.</span>
              </label>
              <label style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',cursor:'pointer'}}>
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                  style={{width:'18px',height:'18px',accentColor:'#1a52a8',cursor:'pointer',flexShrink:0,marginTop:'1px'}} />
                <span style={{color:'#374151',fontWeight:600}}>I accept Risk Secured Ltd's Terms & Conditions of engagement.</span>
              </label>
            </div>

            {declAccepted && termsAccepted && (
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginTop:'0.75rem',paddingTop:'0.5rem',borderTop:'1px solid #fde68a'}}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{fontWeight:600,color:'#374151'}}>Signed electronically by {dbUser?.first_name} {dbUser?.last_name} on {today}</span>
              </div>
            )}
          </div>

          {/* Bank details */}
          {(form.bank_account_holder || hr?.bank_account_holder) && (
            <div style={{marginTop:'1rem',padding:'0.875rem',background:'#f8fafc',borderRadius:'8px',fontSize:'0.8125rem',color:'#374151'}}>
              <div style={{fontWeight:600,marginBottom:'0.5rem'}}>Bank Details for Payment</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.25rem 1rem',fontSize:'0.8125rem'}}>
                <div><span style={{color:'#6b7280'}}>Account Holder:</span> {form.bank_account_holder || hr?.bank_account_holder}</div>
                <div><span style={{color:'#6b7280'}}>Bank:</span> {form.bank_name || hr?.bank_name || '—'}</div>
                <div><span style={{color:'#6b7280'}}>Sort Code:</span> <span style={{fontFamily:'monospace'}}>{form.bank_sort_code || hr?.bank_sort_code || '—'}</span></div>
                <div><span style={{color:'#6b7280'}}>Account No:</span> <span style={{fontFamily:'monospace'}}>{form.bank_account_number || hr?.bank_account_number || '—'}</span></div>
              </div>
            </div>
          )}

          {/* Payment terms */}
          <div style={{marginTop:'0.75rem',padding:'0.875rem',background:'#f8fafc',borderRadius:'8px',fontSize:'0.8125rem',color:'#6b7280'}}>
            <div style={{fontWeight:600,color:'#374151',marginBottom:'0.25rem'}}>Payment Terms</div>
            Payment due within 30 days of invoice date. Please reference invoice number {ref} with payment.
          </div>
        </div>
      </>
    );
  }

  // Format month for display
  function formatMonth(ym) {
    const [y, m] = ym.split('-');
    return new Date(y, m-1).toLocaleDateString('en-GB', { month:'long', year:'numeric' });
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.25rem'}}>
        <div>
          <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Hours Worked</h2>
          <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0,lineHeight:1.5}}>Your completed shifts by month.</p>
        </div>
        {!shiftsLoading && availableMonths.length > 0 && (
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{padding:'0.5rem 0.75rem',border:'1.5px solid #d1d5db',borderRadius:'8px',fontSize:'0.8125rem',fontWeight:600,color:'#111827',background:'#fff',cursor:'pointer'}}>
            {availableMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        )}
      </div>

      {shiftsLoading && <div style={{padding:'2rem',textAlign:'center',color:'#9ca3af'}}>Loading shifts...</div>}

      {shiftsError && (
        <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{shiftsError}</div>
      )}

      {!shiftsLoading && !shiftsError && shifts.length === 0 && (
        <div style={{padding:'2rem',textAlign:'center',background:'#f9fafb',borderRadius:'10px',border:'1px dashed #d1d5db'}}>
          <div style={{fontSize:'0.875rem',color:'#9ca3af'}}>No completed shifts found.</div>
        </div>
      )}

      {!shiftsLoading && shifts.length > 0 && (
        <>
          {isSelfEmployed && (
            <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'8px',padding:'0.875rem',fontSize:'0.8125rem',color:'#1e40af',lineHeight:1.5,marginBottom:'1rem'}}>
              Showing shifts for <strong>{formatMonth(selectedMonth)}</strong>. Tap "Generate Invoice" to create an invoice for this month.
            </div>
          )}

          {monthShifts.length === 0 ? (
            <div style={{padding:'2rem',textAlign:'center',background:'#f9fafb',borderRadius:'10px',border:'1px dashed #d1d5db',marginBottom:'1rem'}}>
              <div style={{fontSize:'0.875rem',color:'#9ca3af'}}>No shifts for {formatMonth(selectedMonth)}.</div>
            </div>
          ) : (
            <>
              {/* Shift list */}
              <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',overflow:'hidden',marginBottom:'1rem'}}>
                {/* Header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 80px 60px 55px 65px',gap:'0.5rem',padding:'0.625rem 1rem',background:'#f8fafc',borderBottom:'1px solid #e5e7eb',fontSize:'0.6875rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  <div>Date / Site</div>
                  <div style={{textAlign:'center'}}>From–To</div>
                  <div style={{textAlign:'right'}}>Hours</div>
                  <div style={{textAlign:'right'}}>Rate</div>
                  <div style={{textAlign:'right'}}>Total</div>
                </div>
                {monthShifts.map((s, i) => {
                  const hrs = getHours(s);
                  const rate = s.pay_rate || 0;
                  return (
                    <div key={s.id} style={{display:'grid',gridTemplateColumns:'1fr 80px 60px 55px 65px',gap:'0.5rem',alignItems:'center',padding:'0.75rem 1rem',borderBottom: i < monthShifts.length-1 ? '1px solid #f1f5f9' : 'none'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:'0.8125rem',fontWeight:600,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.site?.name || 'Site'}</div>
                        <div style={{fontSize:'0.6875rem',color:'#6b7280'}}>{new Date(s.start_time).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'})}</div>
                      </div>
                      <div style={{textAlign:'center',fontSize:'0.75rem',color:'#374151'}}>
                        {new Date(s.checked_in_at || s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}–{new Date(s.checked_out_at || s.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
                      </div>
                      <div style={{textAlign:'right',fontSize:'0.8125rem',fontWeight:600,color:'#111827'}}>{hrs.toFixed(1)}</div>
                      <div style={{textAlign:'right',fontSize:'0.75rem',color:'#6b7280'}}>£{rate.toFixed(2)}</div>
                      <div style={{textAlign:'right',fontSize:'0.8125rem',fontWeight:700,color:'#111827'}}>£{(hrs * rate).toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Monthly summary + Invoice button */}
              <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'0.6875rem',color:'#6b7280',textTransform:'uppercase',fontWeight:600}}>{formatMonth(selectedMonth)}</div>
                  <div style={{fontSize:'1rem',fontWeight:700,color:'#111827'}}>{totalHours.toFixed(1)} hours · £{totalAmount.toFixed(2)}</div>
                  <div style={{fontSize:'0.75rem',color:'#6b7280'}}>{monthShifts.length} shift{monthShifts.length!==1?'s':''}</div>
                </div>
                {isSelfEmployed && monthShifts.length > 0 && (
                  <button onClick={() => { setInvoiceRef(''); setShowInvoice(true); }}
                    style={{padding:'0.75rem 1.25rem',background:'#1a52a8',border:'none',borderRadius:'8px',color:'#fff',fontSize:'0.8125rem',fontWeight:700,cursor:'pointer'}}>
                    Generate Invoice
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function HRUpdatesTab() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.updates.list().then(res => setUpdates(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function loadComments(updateId) {
    if (expandedId === updateId) { setExpandedId(null); return; }
    setExpandedId(updateId);
    if (!comments[updateId]) {
      try {
        const res = await api.updates.comments(updateId);
        setComments(prev => ({ ...prev, [updateId]: res.data || [] }));
      } catch {}
    }
  }

  async function postComment(updateId) {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.updates.comment(updateId, commentText);
      setComments(prev => ({ ...prev, [updateId]: [...(prev[updateId] || []), res.data] }));
      setCommentText('');
    } catch (err) { alert(err.message || 'Failed to post comment'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div style={{padding:'2rem',textAlign:'center',color:'#9ca3af'}}>Loading...</div>;

  return (
    <>
      <div style={{marginBottom:'1.25rem'}}>
        <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#111827',margin:'0 0 0.25rem'}}>Company Updates</h2>
        <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0,lineHeight:1.5}}>News and updates from the Managing Director.</p>
      </div>

      {updates.length === 0 && (
        <div style={{padding:'2rem',textAlign:'center',background:'#f9fafb',borderRadius:'10px',border:'1px dashed #d1d5db'}}>
          <div style={{fontSize:'0.875rem',color:'#9ca3af'}}>No updates yet.</div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
        {updates.map(update => {
          const isExpanded = expandedId === update.id;
          const updateComments = comments[update.id] || [];
          return (
            <div key={update.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{padding:'1.25rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem'}}>
                  <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#eff6ff',border:'1px solid #bfdbfe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8125rem',fontWeight:700,color:'#1a52a8'}}>
                    {update.author?.first_name?.[0]}{update.author?.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{fontSize:'0.875rem',fontWeight:600,color:'#111827'}}>{update.author?.first_name} {update.author?.last_name}</div>
                    <div style={{fontSize:'0.6875rem',color:'#9ca3af'}}>
                      {new Date(update.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/London'})} at {new Date(update.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:'1.0625rem',fontWeight:700,color:'#111827',marginBottom:'0.5rem'}}>{update.title}</div>
                <div style={{fontSize:'0.875rem',color:'#374151',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{update.content}</div>
              </div>

              <div style={{borderTop:'1px solid #f1f5f9',padding:'0.625rem 1.25rem'}}>
                <button onClick={() => loadComments(update.id)}
                  style={{background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',fontWeight:500,cursor:'pointer',padding:0}}>
                  {isExpanded ? 'Hide comments' : `Comments${updateComments.length > 0 ? ` (${updateComments.length})` : ''}`}
                </button>
              </div>

              {isExpanded && (
                <div style={{borderTop:'1px solid #f1f5f9',padding:'1rem 1.25rem',background:'#f8fafc'}}>
                  {updateComments.length === 0 && (
                    <div style={{fontSize:'0.8125rem',color:'#9ca3af',marginBottom:'0.75rem'}}>No comments yet. Be the first to respond.</div>
                  )}
                  {updateComments.map(c => (
                    <div key={c.id} style={{marginBottom:'0.75rem',paddingBottom:'0.75rem',borderBottom:'1px solid #e5e7eb'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.375rem',marginBottom:'0.25rem'}}>
                        <span style={{fontSize:'0.8125rem',fontWeight:600,color:'#374151'}}>{c.user?.first_name} {c.user?.last_name}</span>
                        <span style={{fontSize:'0.6875rem',color:'#9ca3af'}}>{new Date(c.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/London'})} {new Date(c.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</span>
                      </div>
                      <div style={{fontSize:'0.8125rem',color:'#6b7280',lineHeight:1.5}}>{c.content}</div>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
                    <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Write a comment..."
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(update.id); } }}
                      style={{flex:1,padding:'0.625rem 0.75rem',border:'1.5px solid #d1d5db',borderRadius:'8px',fontSize:'0.8125rem',color:'#111827',outline:'none'}} />
                    <button onClick={() => postComment(update.id)} disabled={submitting || !commentText.trim()}
                      style={{padding:'0.625rem 1rem',background:'#1a52a8',border:'none',borderRadius:'8px',color:'#fff',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',opacity:(!commentText.trim()||submitting)?0.5:1}}>
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Spinner() {
  return (
    <div style={{minHeight:'100vh',background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'2rem',height:'2rem',border:'3px solid #e5e7eb',borderTopColor:'#1a52a8',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />
    </div>
  );
}

const S = {
  label: { display:'block', fontSize:'0.8125rem', fontWeight:600, color:'#374151', marginBottom:'0.375rem' },
  input: { width:'100%', padding:'0.6875rem 0.875rem', border:'1.5px solid #d1d5db', borderRadius:'8px', fontSize:'0.9375rem', color:'#111827', background:'#fff', boxSizing:'border-box', fontFamily:'inherit', outline:'none', transition:'border-color 0.15s' },
  btn: { width:'100%', padding:'0.875rem', background:'#1a52a8', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.9375rem', fontWeight:700, fontFamily:'inherit', cursor:'pointer' },
  section: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'1.25rem', marginBottom:'1rem' },
  sectionTitle: { fontSize:'0.6875rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.875rem' },
  fieldLabel: { display:'block', fontSize:'0.75rem', fontWeight:600, color:'#374151', marginBottom:'0.25rem' },
  fieldInput: { width:'100%', padding:'0.625rem 0.75rem', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'0.875rem', color:'#111827', background:'#fff', boxSizing:'border-box', fontFamily:'inherit', outline:'none' },
  docBtn: { padding:'0.375rem 0.625rem', background:'#fff', border:'1px solid #d1d5db', borderRadius:'6px', color:'#374151', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' },
  readLabel: { fontSize:'0.6875rem', fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.25rem' },
  readValue: { fontSize:'0.9375rem', fontWeight:500, color:'#111827' },
};
