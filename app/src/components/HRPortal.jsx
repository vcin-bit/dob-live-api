import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ClerkProvider, useUser, useAuth, useSignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { api } from '../lib/api';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// ── Main HR Portal App ──────────────────────────────────────────────────────
export function HRPortalApp() {
  return (
    <ClerkProvider publishableKey={clerkPubKey} signInFallbackRedirectUrl="/hr" signUpFallbackRedirectUrl="/hr">
      <SignedOut><HRLogin /></SignedOut>
      <SignedIn><HRAuthenticated /></SignedIn>
    </ClerkProvider>
  );
}

// ── Login Screen ────────────────────────────────────────────────────────────
function HRLogin() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isLoaded) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}>
          <div style={{width:'2rem',height:'2rem',border:'3px solid #e5e7eb',borderTopColor:'#1a52a8',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />
        </div>
      </div>
    </div>
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 'email') { setStep('password'); return; }
    setLoading(true); setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else if (result.status === 'needs_first_factor') {
        const r2 = await signIn.attemptFirstFactor({ strategy: 'password', password });
        if (r2.status === 'complete') await setActive({ session: r2.createdSessionId });
        else setError('Sign in failed. Please try again.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Incorrect email or password');
    } finally { setLoading(false); }
  }

  return (
    <div style={S.page}>
      <div style={{width:'100%',maxWidth:'420px'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,color:'#111827',letterSpacing:'-0.02em'}}>
            <span style={{color:'#1a52a8'}}>DOB</span> Live
          </div>
          <div style={{fontSize:'0.9375rem',color:'#6b7280',marginTop:'0.25rem',fontWeight:500}}>HR Self-Service Portal</div>
        </div>

        <div style={S.card}>
          <div style={{fontSize:'1.0625rem',fontWeight:700,color:'#111827',marginBottom:'0.375rem'}}>Sign in to continue</div>
          <div style={{fontSize:'0.8125rem',color:'#9ca3af',marginBottom:'1.5rem'}}>Use your DOB Live credentials to access your HR record</div>

          {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{marginBottom:'1rem'}}>
              <label style={S.label}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" style={S.input}
                onFocus={e => e.target.style.borderColor='#1a52a8'} onBlur={e => e.target.style.borderColor='#d1d5db'} />
            </div>
            {step === 'password' && (
              <div style={{marginBottom:'1rem'}}>
                <label style={S.label}>Password</label>
                <div style={{position:'relative'}}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required autoFocus autoComplete="current-password"
                    style={{...S.input, paddingRight:'3.5rem'}}
                    onFocus={e => e.target.style.borderColor='#1a52a8'} onBlur={e => e.target.style.borderColor='#d1d5db'} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer',fontWeight:500}}>{showPw?'Hide':'Show'}</button>
                </div>
              </div>
            )}
            <button type="submit" disabled={loading} style={{...S.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer'}}>
              {loading ? 'Signing in...' : step === 'email' ? 'Continue' : 'Sign In'}
            </button>
          </form>

          {step === 'password' && (
            <button onClick={() => { setStep('email'); setPassword(''); setError(''); }} style={{display:'block',margin:'1rem auto 0',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer'}}>
              ← Use a different email
            </button>
          )}
        </div>

        <div style={{textAlign:'center',marginTop:'1.5rem',fontSize:'0.6875rem',color:'#9ca3af'}}>
          Your data is stored securely and protected under GDPR
        </div>
      </div>
    </div>
  );
}

// ── Authenticated HR Dashboard ──────────────────────────────────────────────
function HRAuthenticated() {
  const { user: clerkUser } = useUser();
  const { getToken, signOut } = useAuth();
  window.__clerkGetToken = getToken;

  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hr, setHr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [sessionExpiry] = useState(Date.now() + 15 * 60 * 1000); // 15 min session
  const [timeLeft, setTimeLeft] = useState(15);

  const [form, setForm] = useState({
    nok_name: '', nok_relationship: '', nok_phone: '',
    address_line_1: '', address_line_2: '', city: '', postcode: '',
    date_of_birth: '', ni_number: '',
  });

  const [docs, setDocs] = useState({ sia_front: null, sia_back: null, dbs_certificate: null });
  const [docUrls, setDocUrls] = useState({});
  const [uploading, setUploading] = useState('');
  const fileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState('');

  // Session timer
  useEffect(() => {
    const t = setInterval(() => {
      const mins = Math.max(0, Math.ceil((sessionExpiry - Date.now()) / 60000));
      setTimeLeft(mins);
      if (mins <= 0) { signOut(); }
    }, 30000);
    return () => clearInterval(t);
  }, [sessionExpiry]);

  // Load user + HR data
  useEffect(() => {
    async function load() {
      try {
        const userRes = await api.users.me();
        setDbUser(userRes.data);
        const hrRes = await api.hr.get();
        if (hrRes.data) {
          setHr(hrRes.data);
          setForm({
            nok_name: hrRes.data.nok_name || '',
            nok_relationship: hrRes.data.nok_relationship || '',
            nok_phone: hrRes.data.nok_phone || '',
            address_line_1: hrRes.data.address_line_1 || '',
            address_line_2: hrRes.data.address_line_2 || '',
            city: hrRes.data.city || '',
            postcode: hrRes.data.postcode || '',
            date_of_birth: hrRes.data.date_of_birth ? hrRes.data.date_of_birth.split('T')[0] : '',
            ni_number: hrRes.data.ni_number || '',
          });
          setConsentChecked(!!hrRes.data.gdpr_consent);
          setDocs({
            sia_front: hrRes.data.sia_front_path || null,
            sia_back: hrRes.data.sia_back_path || null,
            dbs_certificate: hrRes.data.dbs_certificate_path || null,
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadTarget) return;
    setUploading(uploadTarget);
    try {
      await api.hr.uploadDoc(uploadTarget, file);
      setDocs(prev => ({ ...prev, [uploadTarget]: 'uploaded' }));
      setDocUrls(prev => ({ ...prev, [uploadTarget]: URL.createObjectURL(file) }));
      setSuccess('Document uploaded successfully');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setUploading(''); setUploadTarget(''); }
  }

  async function viewDoc(docType) {
    try {
      const res = await api.hr.getDocUrl(docType);
      window.open(res.url, '_blank');
    } catch { alert('Could not load document'); }
  }

  async function deleteDoc(docType) {
    if (!confirm('Remove this document? This cannot be undone.')) return;
    try {
      await api.hr.deleteDoc(docType);
      setDocs(prev => ({ ...prev, [docType]: null }));
      setDocUrls(prev => ({ ...prev, [docType]: null }));
    } catch (err) { setError(err.message); }
  }

  async function save() {
    if (!consentChecked) { setError('You must agree to the data processing statement'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.hr.save({
        ...form,
        gdpr_consent: true,
        gdpr_consent_at: hr?.gdpr_consent_at || new Date().toISOString(),
      });
      setHr(res.data);
      setSuccess('HR details saved successfully');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}>
          <div style={{width:'2rem',height:'2rem',border:'3px solid #e5e7eb',borderTopColor:'#1a52a8',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'0.875rem 1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div>
          <div style={{fontSize:'1rem',fontWeight:800,color:'#111827'}}>
            <span style={{color:'#1a52a8'}}>DOB</span> Live <span style={{fontWeight:400,color:'#9ca3af',fontSize:'0.8125rem',marginLeft:'0.25rem'}}>HR Portal</span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
          <div style={{fontSize:'0.75rem',color:'#9ca3af'}}>Session: {timeLeft} min</div>
          <div style={{fontSize:'0.8125rem',color:'#374151',fontWeight:500}}>{dbUser?.first_name} {dbUser?.last_name}</div>
          <button onClick={() => signOut()} style={{padding:'0.375rem 0.75rem',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'6px',color:'#374151',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>Sign Out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:'640px',margin:'0 auto',padding:'1.5rem 1rem 4rem'}}>
        <div style={{marginBottom:'1.5rem'}}>
          <h1 style={{fontSize:'1.375rem',fontWeight:700,color:'#111827',marginBottom:'0.25rem'}}>HR Self-Service</h1>
          <p style={{fontSize:'0.8125rem',color:'#6b7280',margin:0}}>Manage your personal information securely. Your data is encrypted and only accessible by authorised personnel.</p>
        </div>

        {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{error}</div>}
        {success && <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#16a34a'}}>{success}</div>}

        {/* Next of Kin */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Next of Kin / Emergency Contact</div>
          <div style={{marginBottom:'0.75rem'}}>
            <label style={S.fieldLabel}>Full Name</label>
            <input value={form.nok_name} onChange={e => f('nok_name', e.target.value)} placeholder="e.g. Jane Smith" style={S.fieldInput} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div>
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
        </div>

        {/* Personal Details */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Personal Details</div>
          <div style={{marginBottom:'0.75rem'}}>
            <label style={S.fieldLabel}>Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} style={S.fieldInput} />
          </div>
          <div style={{marginBottom:'0.75rem'}}>
            <label style={S.fieldLabel}>Address Line 1</label>
            <input value={form.address_line_1} onChange={e => f('address_line_1', e.target.value)} style={S.fieldInput} />
          </div>
          <div style={{marginBottom:'0.75rem'}}>
            <label style={S.fieldLabel}>Address Line 2</label>
            <input value={form.address_line_2} onChange={e => f('address_line_2', e.target.value)} style={S.fieldInput} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'0.75rem'}}>
            <div>
              <label style={S.fieldLabel}>City / Town</label>
              <input value={form.city} onChange={e => f('city', e.target.value)} style={S.fieldInput} />
            </div>
            <div>
              <label style={S.fieldLabel}>Postcode</label>
              <input value={form.postcode} onChange={e => f('postcode', e.target.value)} placeholder="AB1 2CD" style={S.fieldInput} />
            </div>
          </div>
        </div>

        {/* National Insurance */}
        <div style={S.section}>
          <div style={S.sectionTitle}>National Insurance</div>
          <div>
            <label style={S.fieldLabel}>NI Number</label>
            <input value={form.ni_number} onChange={e => f('ni_number', e.target.value.toUpperCase())} placeholder="AB 12 34 56 C" maxLength={13} style={{...S.fieldInput, fontFamily:'monospace', letterSpacing:'0.08em'}} />
          </div>
          <div style={{fontSize:'0.6875rem',color:'#9ca3af',marginTop:'0.375rem'}}>Encrypted at rest. Only accessible by authorised company administrators.</div>
        </div>

        {/* Documents */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Documents</div>
          {createPortal(
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={handleUpload} />,
            document.body
          )}

          {[
            { key: 'sia_front', label: 'SIA Licence (Front)', desc: 'Photo of the front of your SIA badge' },
            { key: 'sia_back', label: 'SIA Licence (Back)', desc: 'Photo of the back of your SIA badge' },
            { key: 'dbs_certificate', label: 'DBS Certificate', desc: 'Scan or photo of your DBS certificate' },
          ].map(doc => (
            <div key={doc.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.875rem 0',borderBottom:'1px solid #f1f5f9'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'0.875rem',fontWeight:600,color:'#111827'}}>{doc.label}</div>
                <div style={{fontSize:'0.75rem',color: docs[doc.key] ? '#16a34a' : '#9ca3af',marginTop:'2px'}}>
                  {docs[doc.key] ? 'Uploaded' : doc.desc}
                </div>
              </div>
              <div style={{display:'flex',gap:'0.375rem',flexShrink:0}}>
                {docs[doc.key] && (
                  <>
                    <button onClick={() => viewDoc(doc.key)} style={S.docBtn}>View</button>
                    <button onClick={() => deleteDoc(doc.key)} style={{...S.docBtn, color:'#dc2626', borderColor:'#fecaca'}}>Remove</button>
                  </>
                )}
                <button onClick={() => { setUploadTarget(doc.key); fileRef.current?.click(); }} disabled={uploading === doc.key}
                  style={{...S.docBtn, background: docs[doc.key] ? '#fff' : '#1a52a8', color: docs[doc.key] ? '#374151' : '#fff', borderColor: docs[doc.key] ? '#d1d5db' : '#1a52a8'}}>
                  {uploading === doc.key ? '...' : docs[doc.key] ? 'Replace' : 'Upload'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* GDPR */}
        <div style={{...S.section, border:'1px solid #dbeafe', background:'#eff6ff'}}>
          <div style={S.sectionTitle}>Data Processing Statement</div>
          <div style={{fontSize:'0.75rem',color:'#4b5563',lineHeight:1.7,marginBottom:'1rem'}}>
            By submitting your personal information, you consent to your employer processing this data for the purposes of employment administration, payroll, regulatory compliance (SIA licensing, BS7858 vetting), and emergency contact procedures. Your data is stored securely, encrypted at rest, and will only be accessed by authorised personnel. You may request access to, correction of, or deletion of your data at any time by contacting your line manager or data controller. Data will be retained for the duration of your employment plus 6 years in line with HMRC requirements, unless you request earlier deletion of non-statutory records.
          </div>
          <div onClick={() => setConsentChecked(!consentChecked)} style={{display:'flex',alignItems:'flex-start',gap:'0.75rem',cursor:'pointer',padding:'0.5rem 0'}}>
            <div style={{width:22,height:22,borderRadius:'4px',border:`2px solid ${consentChecked ? '#1a52a8' : '#d1d5db'}`,background: consentChecked ? '#1a52a8' : '#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'1px'}}>
              {consentChecked && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div style={{fontSize:'0.8125rem',color:'#374151',lineHeight:1.5}}>I understand and consent to the processing of my personal data as described above</div>
          </div>
          {hr?.gdpr_consent_at && <div style={{fontSize:'0.6875rem',color:'#9ca3af',marginTop:'0.25rem',paddingLeft:'2.25rem'}}>Consent recorded: {new Date(hr.gdpr_consent_at).toLocaleDateString('en-GB')}</div>}
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving || !consentChecked}
          style={{width:'100%',padding:'0.875rem',background: consentChecked ? '#1a52a8' : '#d1d5db',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.9375rem',fontWeight:700,cursor: consentChecked ? 'pointer' : 'not-allowed',opacity: saving ? 0.7 : 1,marginTop:'0.25rem'}}>
          {saving ? 'Saving...' : 'Save HR Details'}
        </button>
      </div>
    </div>
  );
}

// ── Shared Styles ───────────────────────────────────────────────────────────
const S = {
  page: { minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem', boxSizing:'border-box' },
  card: { background:'#fff', borderRadius:'12px', padding:'2rem', boxShadow:'0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)', border:'1px solid #e5e7eb' },
  label: { display:'block', fontSize:'0.8125rem', fontWeight:600, color:'#374151', marginBottom:'0.375rem' },
  input: { width:'100%', padding:'0.6875rem 0.875rem', border:'1.5px solid #d1d5db', borderRadius:'8px', fontSize:'0.9375rem', color:'#111827', background:'#fff', boxSizing:'border-box', fontFamily:'inherit', outline:'none', transition:'border-color 0.15s' },
  btn: { width:'100%', padding:'0.875rem', background:'#1a52a8', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.9375rem', fontWeight:700, fontFamily:'inherit', marginTop:'0.25rem' },
  section: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'1.25rem', marginBottom:'1rem' },
  sectionTitle: { fontSize:'0.6875rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.875rem' },
  fieldLabel: { display:'block', fontSize:'0.75rem', fontWeight:600, color:'#374151', marginBottom:'0.25rem' },
  fieldInput: { width:'100%', padding:'0.625rem 0.75rem', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'0.875rem', color:'#111827', background:'#fff', boxSizing:'border-box', fontFamily:'inherit', outline:'none' },
  docBtn: { padding:'0.375rem 0.625rem', background:'#fff', border:'1px solid #d1d5db', borderRadius:'6px', color:'#374151', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' },
};
