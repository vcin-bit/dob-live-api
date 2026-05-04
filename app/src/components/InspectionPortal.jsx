import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ClerkProvider, useAuth, useSignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { compressImage, isImage } from '../lib/imageUtils';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const LOGO_URL = 'https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/company-logos/4bab41dd-f6a9-4407-983b-d42d32ea1432/logo.png';

const OBSERVATIONS = [
  'Nothing to Report','Fly Tipping','Forced Entry','Travellers','Safety Concern',
  'Property Breached','Criminal Damage','Graffiti','Suspicious Activity',
  'Anti-Social Behaviour','Fire Risk','Water Leak','Broken Fencing',
  'Lighting Issue','Other'
];

export function InspectionPortalApp() {
  // Swap PWA manifest so "Add to Home Screen" opens /inspect not /
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', '/manifest-inspect.json');
    // Set theme color for this portal
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0b1a3e');
    document.title = 'Risk Secured — Property Inspection';
    return () => {
      if (link) link.setAttribute('href', '/manifest.json');
      document.title = 'DOB Live';
    };
  }, []);

  return (
    <ClerkProvider publishableKey={clerkPubKey} signInForceRedirectUrl="/inspect" signUpForceRedirectUrl="/inspect" afterSignOutUrl="/inspect">
      <SignedOut><InspectLogin /></SignedOut>
      <SignedIn><InspectAuthenticated /></SignedIn>
    </ClerkProvider>
  );
}

// ── Login ───────────────────────────────────────────────────────────────────
function InspectLogin() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustCode, setTrustCode] = useState('');

  if (!isLoaded) return <div style={S.page}><div style={S.spinner} /></div>;

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
      if (result.status === 'complete') await setActive({ session: result.createdSessionId, redirectUrl: '/inspect' });
      else if (result.status === 'needs_second_factor' || result.status === 'needs_client_trust') {
        const emailFactor = result.supportedSecondFactors?.find(f => f.strategy === 'email_code');
        if (emailFactor) {
          await signIn.prepareSecondFactor({ strategy: 'email_code' });
          setStep('trust'); setTrustCode('');
        } else { setError('Verification required but no email code method available.'); }
      } else setError('Sign in failed.');
    } catch (err) { setError(err.errors?.[0]?.longMessage || 'Incorrect email or password'); }
    finally { setLoading(false); }
  }

  async function handleTrustVerify(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await signIn.attemptSecondFactor({ strategy: 'email_code', code: trustCode });
      if (result.status === 'complete') await setActive({ session: result.createdSessionId, redirectUrl: '/inspect' });
      else setError('Verification failed. Please try again.');
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid verification code');
    } finally { setLoading(false); }
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg, #0b1a3e 0%, #1a3a7a 50%, #0b1a3e 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <img src={LOGO_URL} alt="Risk Secured" style={{maxHeight:'48px',maxWidth:'200px',objectFit:'contain',marginBottom:'0.75rem'}} />
          <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.5)',fontWeight:500}}>Property Inspection Portal</div>
        </div>
        <div style={{background:'#fff',borderRadius:'16px',padding:'2rem',boxShadow:'0 25px 50px rgba(0,0,0,0.25)'}}>
          <div style={{fontSize:'1.0625rem',fontWeight:700,color:'#111827',marginBottom:'1.5rem'}}>Sign in to continue</div>
          {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{error}</div>}
          <form onSubmit={handleSubmit}>
            {step !== 'trust' && (
              <>
                <div style={{marginBottom:'1rem'}}><label style={S.label}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@risksecured.co.uk" required autoComplete="email" style={S.input} /></div>
                {step === 'password' && (
                  <div style={{marginBottom:'1rem'}}><label style={S.label}>Password</label>
                    <div style={{position:'relative'}}>
                      <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoFocus style={{...S.input,paddingRight:'3.5rem'}} />
                      <button type="button" onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer'}}>{showPw?'Hide':'Show'}</button>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading} style={{...S.btn,opacity:loading?0.7:1}}>{loading?'Signing in...':step==='email'?'Continue':'Sign In'}</button>
              </>
            )}
            {step === 'trust' && (
              <>
                <p style={{fontSize:'0.8125rem',color:'#6b7280',marginBottom:'1rem'}}>We sent a verification code to <strong>{email}</strong></p>
                <div style={{marginBottom:'1rem'}}><label style={S.label}>6-digit code</label>
                  <input type="text" inputMode="numeric" value={trustCode} onChange={e=>setTrustCode(e.target.value.replace(/\D/g,''))} placeholder="000000" required maxLength={6} autoFocus style={{...S.input,letterSpacing:'0.25em',fontSize:'1.25rem',textAlign:'center'}} />
                </div>
                <button type="submit" disabled={loading||trustCode.length!==6} style={{...S.btn,opacity:loading||trustCode.length!==6?0.7:1}}>{loading?'Verifying...':'Verify'}</button>
                <button type="button" onClick={()=>{setStep('password');setTrustCode('');setError('');}} style={{display:'block',margin:'0.75rem auto 0',background:'none',border:'none',color:'#6b7280',fontSize:'0.8125rem',cursor:'pointer'}}>Back to sign in</button>
              </>
            )}
          </form>
        </div>
        <div style={{textAlign:'center',marginTop:'1.5rem',fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)'}}>
          Risk Secured Ltd | 24/7 Control Room: 01384 218829
        </div>
      </div>
    </div>
  );
}

// ── Authenticated Form ──────────────────────────────────────────────────────
function InspectAuthenticated() {
  const { getToken, signOut } = useAuth();
  window.__clerkGetToken = getToken;

  const [dbUser, setDbUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  const [form, setForm] = useState({
    site_id: '',
    new_to_report: null,
    categories: [],
    summary: '',
    action_points: '',
    immediate_action: false,
    latitude: null, longitude: null,
    media: [],
  });

  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [userRes, sitesRes] = await Promise.all([api.users.me(), api.sites.list()]);
        setDbUser(userRes.data);
        const aldiSites = (sitesRes.data || []).filter(s => s.client_name === 'Aldi Stores Ltd');
        setSites(aldiSites);
        if (aldiSites.length === 1) setForm(f => ({ ...f, site_id: aldiSites[0].id }));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const [gpsError, setGpsError] = useState('');
  function getGPS() {
    setGpsLoading(true); setGpsError('');
    if (!navigator.geolocation) { setGpsError('Geolocation not supported by this browser'); setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setForm(f => ({ ...f, latitude: p.coords.latitude, longitude: p.coords.longitude })); setGpsLoading(false); },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError('Location permission denied — check browser settings');
        else if (err.code === 2) setGpsError('Location unavailable — try again');
        else if (err.code === 3) setGpsError('Location timed out — tap Update Location to retry');
        else setGpsError('Could not get location');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }
  useEffect(() => { getGPS(); }, []);

  async function uploadPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
    const token = await window.__clerkGetToken?.() || '';
    const newMedia = [...form.media];
    for (const rawFile of files) {
      try {
        const file = isImage(rawFile) ? await compressImage(rawFile) : rawFile;
        const fd = new FormData(); fd.append('file', file);
        const r = await fetch(`${API}/api/patrols/media/upload`, { method:'POST', body:fd, headers:{ Authorization:`Bearer ${token}` } });
        if (!r.ok) throw new Error('Upload failed');
        const d = await r.json();
        if (d.url) newMedia.push({ url: d.url, name: rawFile.name, type: rawFile.type });
      } catch (err) { console.error('Upload error:', err); }
    }
    setForm(f => ({ ...f, media: newMedia }));
    setUploading(false);
  }

  async function submit() {
    if (!form.site_id) { setError('Please select a site'); return; }
    if (form.new_to_report === null) { setError('Please indicate if there is anything new to report'); return; }
    if (form.new_to_report && !form.summary.trim()) { setError('Please provide a report summary'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await api.inspections.create(form);
      setPdfUrl(res.pdf_url);
      setSubmitted(true);
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleCat = (cat) => {
    const current = form.categories;
    f('categories', current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat]);
  };
  const selectedSite = sites.find(s => s.id === form.site_id);

  if (loading) return <div style={S.page}><div style={S.spinner} /></div>;

  // ── Success ───────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}}>
      <div style={{maxWidth:'480px',textAlign:'center'}}>
        <div style={{width:'64px',height:'64px',background:'#dcfce7',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.5rem',border:'2px solid #86efac'}}>
          <svg width="28" height="28" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h1 style={{fontSize:'1.5rem',fontWeight:700,color:'#111827',marginBottom:'0.5rem'}}>Inspection Submitted</h1>
        <p style={{fontSize:'0.9375rem',color:'#6b7280',marginBottom:'1.5rem',lineHeight:1.5}}>
          Report emailed to client and saved to DOB Live.
        </p>
        <div style={{display:'flex',gap:'0.75rem',justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={() => { setSubmitted(false); setForm({ site_id: sites.length===1?sites[0].id:'', new_to_report:null, categories:[], summary:'', action_points:'', immediate_action:false, latitude:form.latitude, longitude:form.longitude, media:[] }); }}
            style={{padding:'0.75rem 1.5rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.875rem',fontWeight:700,cursor:'pointer'}}>
            New Inspection
          </button>
          <button onClick={() => signOut({ redirectUrl: '/inspect' })} style={{padding:'0.75rem 1.5rem',background:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      {/* Corporate Header */}
      <div style={{background:'#0b1a3e',padding:'0 1.25rem'}}>
        <div style={{maxWidth:'680px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:'64px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            <img src={LOGO_URL} alt="Risk Secured" style={{maxHeight:'32px',maxWidth:'140px',objectFit:'contain'}} />
            <div style={{width:'1px',height:'28px',background:'rgba(255,255,255,0.15)'}} />
            <div>
              <div style={{fontSize:'0.8125rem',fontWeight:700,color:'#fff'}}>Property Inspection</div>
              <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Aldi Stores Ltd</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.5)'}}>{dbUser?.first_name} {dbUser?.last_name}</div>
              <div style={{fontSize:'0.5625rem',color:'rgba(255,255,255,0.3)'}}>{new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/London'})}</div>
            </div>
            <button onClick={() => signOut({ redirectUrl: '/inspect' })} style={{padding:'0.375rem 0.625rem',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',color:'rgba(255,255,255,0.5)',fontSize:'0.625rem',fontWeight:600,cursor:'pointer'}}>Sign Out</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:'680px',margin:'0 auto',padding:'1.5rem 1.25rem 2rem'}}>
        {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem',color:'#dc2626'}}>{error}</div>}

        {/* Site Selection */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Site</div>
          {sites.length === 1 ? (
            <div>
              <div style={{fontSize:'1.0625rem',fontWeight:700,color:'#111827'}}>{sites[0].name}</div>
              <div style={{fontSize:'0.8125rem',color:'#6b7280',marginTop:'0.125rem'}}>{[sites[0].address, sites[0].city, sites[0].postcode].filter(Boolean).join(', ')}</div>
            </div>
          ) : (
            <>
              <select value={form.site_id} onChange={e => f('site_id', e.target.value)} style={S.fieldInput}>
                <option value="">Select site...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {selectedSite && <div style={{fontSize:'0.8125rem',color:'#6b7280',marginTop:'0.375rem'}}>{[selectedSite.address, selectedSite.city, selectedSite.postcode].filter(Boolean).join(', ')}</div>}
            </>
          )}
        </div>

        {/* GPS Location with Map */}
        <div style={S.section}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <div style={S.sectionTitle}>Location Verification</div>
            <button onClick={getGPS} style={{padding:'0.375rem 0.75rem',background:'#1a52a8',border:'none',borderRadius:'6px',color:'#fff',fontSize:'0.6875rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'0.375rem'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
              {gpsLoading ? 'Locating...' : 'Update Location'}
            </button>
          </div>
          {form.latitude ? (
            <>
              <div style={{height:'200px',borderRadius:'8px',overflow:'hidden',border:'1px solid #e2e8f0',marginBottom:'0.5rem'}}>
                <iframe
                  width="100%" height="100%" frameBorder="0" style={{border:0}}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${form.longitude-0.005},${form.latitude-0.003},${form.longitude+0.005},${form.latitude+0.003}&layer=mapnik&marker=${form.latitude},${form.longitude}`}
                />
              </div>
              <div style={{fontSize:'0.6875rem',color:'#9ca3af',display:'flex',alignItems:'center',gap:'0.375rem'}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                GPS: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
              </div>
            </>
          ) : (
            <div style={{padding:'2rem',textAlign:'center',background:'#f9fafb',borderRadius:'8px',border:`1px dashed ${gpsError ? '#fca5a5' : '#d1d5db'}`}}>
              <div style={{fontSize:'0.8125rem',color: gpsError ? '#dc2626' : '#9ca3af'}}>{gpsLoading ? 'Acquiring GPS position...' : gpsError || 'GPS unavailable — tap Update Location'}</div>
            </div>
          )}
        </div>

        {/* New to report */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Anything new to report?</div>
          <div style={{display:'flex',gap:'0.75rem'}}>
            {[{v:true,label:'Yes — Issues Found',color:'#dc2626',bg:'#fef2f2',border:'#fca5a5'},{v:false,label:'No — All Clear',color:'#16a34a',bg:'#f0fdf4',border:'#86efac'}].map(opt => (
              <button key={String(opt.v)} onClick={() => f('new_to_report', opt.v)}
                style={{flex:1,padding:'1rem',background:form.new_to_report===opt.v?opt.bg:'#fff',border:`2px solid ${form.new_to_report===opt.v?opt.border:'#e5e7eb'}`,borderRadius:'10px',cursor:'pointer',fontSize:'0.875rem',fontWeight:700,color:form.new_to_report===opt.v?opt.color:'#9ca3af',transition:'all 0.15s'}}>
                {form.new_to_report===opt.v && '✓ '}{opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Observations */}
        {form.new_to_report !== null && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Observations (select all that apply)</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
              {OBSERVATIONS.map(cat => {
                const sel = form.categories.includes(cat);
                return (
                  <button key={cat} onClick={() => toggleCat(cat)}
                    style={{padding:'0.5rem 0.875rem',background:sel?'#1a52a8':'#fff',border:`1.5px solid ${sel?'#1a52a8':'#d1d5db'}`,borderRadius:'999px',color:sel?'#fff':'#374151',fontSize:'0.8125rem',fontWeight:sel?700:500,cursor:'pointer'}}>
                    {sel && '✓ '}{cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={S.section}>
          <div style={S.sectionTitle}>{form.new_to_report ? 'Report Summary *' : 'Notes (optional)'}</div>
          <textarea value={form.summary} onChange={e => f('summary', e.target.value)} rows={4}
            placeholder={form.new_to_report ? 'Describe what you found during the inspection...' : 'Main property secure. No issues to report.'}
            style={{...S.fieldInput, resize:'vertical', minHeight:'100px'}} />
        </div>

        {/* Action points */}
        {form.new_to_report && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Suggested Action Points</div>
            <textarea value={form.action_points} onChange={e => f('action_points', e.target.value)} rows={3}
              placeholder="What actions should be taken?"
              style={{...S.fieldInput, resize:'vertical'}} />
          </div>
        )}

        {/* Immediate intervention */}
        {form.new_to_report && (
          <div onClick={() => f('immediate_action', !form.immediate_action)}
            style={{...S.section, background:form.immediate_action?'#fef2f2':'#fff', border:form.immediate_action?'2px solid #fca5a5':'1px solid #e5e7eb',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.875rem'}}>
            <div style={{width:24,height:24,borderRadius:'4px',border:`2px solid ${form.immediate_action?'#dc2626':'#d1d5db'}`,background:form.immediate_action?'#dc2626':'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {form.immediate_action && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div>
              <div style={{fontSize:'0.875rem',fontWeight:700,color:form.immediate_action?'#dc2626':'#374151'}}>Immediate intervention required</div>
              <div style={{fontSize:'0.75rem',color:'#9ca3af'}}>Tick if this issue requires urgent client attention</div>
            </div>
          </div>
        )}

        {/* Photos */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Photographs</div>
          {createPortal(
            <input ref={fileRef} type="file" accept="image/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadPhotos} />,
            document.body
          )}
          <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.75rem'}}>
            {form.media.map((m, i) => (
              <div key={i} style={{width:80,height:80,borderRadius:'8px',overflow:'hidden',position:'relative',border:'1px solid #e5e7eb'}}>
                <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                <button onClick={() => f('media', form.media.filter((_,j) => j!==i))}
                  style={{position:'absolute',top:3,right:3,width:20,height:20,background:'#dc2626',borderRadius:'50%',border:'none',color:'#fff',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
              </div>
            ))}
            {form.media.length < 10 && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{width:80,height:80,borderRadius:'8px',border:'2px dashed #d1d5db',background:'#f9fafb',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
                <div style={{fontSize:'1.5rem',color:'#9ca3af',lineHeight:1}}>{uploading ? '...' : '+'}</div>
                <div style={{fontSize:'0.5625rem',color:'#9ca3af'}}>{uploading ? 'Uploading' : 'Add Photo'}</div>
              </button>
            )}
          </div>
          <div style={{fontSize:'0.6875rem',color:'#9ca3af'}}>Up to 10 photographs. These will be embedded in the report.</div>
        </div>

        {/* Submit */}
        <button onClick={submit} disabled={submitting || uploading}
          style={{width:'100%',padding:'1rem',background:'#0b1a3e',color:'#fff',border:'none',borderRadius:'10px',fontSize:'1rem',fontWeight:700,cursor:submitting?'wait':'pointer',opacity:(submitting||uploading)?0.7:1}}>
          {submitting ? 'Generating Report & Sending...' : 'Submit Inspection'}
        </button>
        <div style={{textAlign:'center',fontSize:'0.6875rem',color:'#9ca3af',marginTop:'0.5rem',marginBottom:'1.5rem'}}>
          Report will be emailed to the client and saved to DOB Live
        </div>
      </div>

      {/* Corporate Footer */}
      <div style={{background:'#0b1a3e',padding:'1.25rem',borderTop:'3px solid #1a52a8'}}>
        <div style={{maxWidth:'680px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem'}}>
            <div>
              <img src={LOGO_URL} alt="Risk Secured" style={{maxHeight:'24px',maxWidth:'120px',objectFit:'contain',marginBottom:'0.5rem',opacity:0.7}} />
              <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.3)'}}>Risk Secured Ltd</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>
                24/7 Control Room: <span style={{color:'rgba(255,255,255,0.7)',fontWeight:600}}>01384 218829</span>
              </div>
              <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)'}}>
                Tel: 0843 122 1247 | Mobile: 07587 865219
              </div>
              <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)'}}>
                david@risksecured.co.uk | www.risksecured.co.uk
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center' },
  spinner: { width:'2rem',height:'2rem',border:'3px solid #e5e7eb',borderTopColor:'#1a52a8',borderRadius:'50%',animation:'spin 0.6s linear infinite' },
  label: { display:'block',fontSize:'0.8125rem',fontWeight:600,color:'#374151',marginBottom:'0.375rem' },
  input: { width:'100%',padding:'0.6875rem 0.875rem',border:'1.5px solid #d1d5db',borderRadius:'8px',fontSize:'0.9375rem',color:'#111827',background:'#fff',boxSizing:'border-box',fontFamily:'inherit',outline:'none' },
  btn: { width:'100%',padding:'0.875rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'8px',fontSize:'0.9375rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit' },
  section: { background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'1.25rem',marginBottom:'1rem' },
  sectionTitle: { fontSize:'0.6875rem',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.75rem' },
  fieldInput: { width:'100%',padding:'0.625rem 0.75rem',border:'1.5px solid #d1d5db',borderRadius:'6px',fontSize:'0.875rem',color:'#111827',background:'#fff',boxSizing:'border-box',fontFamily:'inherit',outline:'none' },
};
