import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';

const AUTO_LOCK_MS = 2 * 60 * 1000; // 2 minutes

/**
 * PIN-gated HR view for officers embedded in the officer app.
 * Requires safe_pin entry before showing any personal data.
 * Auto-locks after 2 minutes of inactivity.
 */
export default function OfficerHR({ user }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [noPin, setNoPin] = useState(false);
  const lastActivity = useRef(Date.now());
  const lockTimer = useRef(null);

  // Auto-lock on inactivity
  useEffect(() => {
    if (!unlocked) return;
    function onActivity() { lastActivity.current = Date.now(); }
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('click', onActivity);
    lockTimer.current = setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_LOCK_MS) {
        setUnlocked(false);
        setPin('');
      }
    }, 10000);
    return () => {
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('click', onActivity);
      clearInterval(lockTimer.current);
    };
  }, [unlocked]);

  function handleDigit(k) {
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setChecking(true); setError('');
      api.escalation.getPins().then(res => {
        if (!res.safe_pin) { setNoPin(true); setChecking(false); return; }
        if (next === res.safe_pin) setUnlocked(true);
        else { setError('Incorrect PIN'); setPin(''); }
      }).catch(() => { setError('Could not verify PIN'); setPin(''); })
        .finally(() => setChecking(false));
    }
  }

  if (!unlocked) {
    return (
      <div style={{padding:'1.5rem',paddingBottom:'6rem',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
        <div style={{width:'100%',maxWidth:'320px',textAlign:'center'}}>
          <div style={{fontSize:'1.25rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem'}}>My Hours & Pay</div>
          <div style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',marginBottom:'2rem',lineHeight:1.5}}>
            Enter your safe PIN to access your personal HR data. This protects your information on shared devices.
          </div>

          {noPin ? (
            <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'10px',padding:'1rem',fontSize:'0.8125rem',color:'#fca5a5',lineHeight:1.5}}>
              You haven't set a safe PIN yet. Go to <strong>Profile</strong> and set your Safe PIN first, then come back here.
            </div>
          ) : (
            <>
              <div style={{display:'flex',justifyContent:'center',gap:'0.75rem',marginBottom:'1.5rem'}}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{width:'3rem',height:'3.5rem',borderRadius:'10px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',fontWeight:700,color:'#fff'}}>
                    {pin[i] ? '\u2022' : ''}
                  </div>
                ))}
              </div>

              {error && <div style={{color:'#fca5a5',fontSize:'0.8125rem',marginBottom:'1rem',fontWeight:600}}>{error}</div>}

              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.625rem',maxWidth:'240px',margin:'0 auto'}}>
                {[1,2,3,4,5,6,7,8,9,'',0,'del'].map((k,i) => {
                  if (k === '') return <div key={i} />;
                  if (k === 'del') return (
                    <button key={i} onClick={() => setPin(p => p.slice(0,-1))}
                      style={{padding:'1rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.5)',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>
                      Del
                    </button>
                  );
                  return (
                    <button key={i} onClick={() => handleDigit(k)}
                      style={{padding:'1rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'#fff',fontSize:'1.125rem',fontWeight:600,cursor:'pointer'}}>
                      {k}
                    </button>
                  );
                })}
              </div>

              {checking && <div style={{marginTop:'1rem',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem'}}>Verifying...</div>}
            </>
          )}
        </div>
      </div>
    );
  }

  return <HRContent user={user} onLock={() => { setUnlocked(false); setPin(''); }} />;
}

/**
 * HR content shown after PIN unlock — tabs for Hours and Personal Details.
 */
function HRContent({ user, onLock }) {
  const [tab, setTab] = useState('hours');

  return (
    <div style={{padding:'1rem',paddingBottom:'6rem'}}>
      {/* Header with lock button */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div style={{fontSize:'1.125rem',fontWeight:700,color:'#fff'}}>My Hours & Pay</div>
        <button onClick={onLock} style={{padding:'0.375rem 0.75rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'rgba(255,255,255,0.5)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>
          Lock
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
        {[{k:'hours',l:'Hours & Pay'},{k:'details',l:'My Details'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{flex:1,padding:'0.625rem',borderRadius:'8px',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',
              background: tab === t.k ? '#1a52a8' : 'rgba(255,255,255,0.07)',
              border: tab === t.k ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
              color: tab === t.k ? '#fff' : 'rgba(255,255,255,0.5)'}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'hours' && <HoursView user={user} />}
      {tab === 'details' && <DetailsView user={user} />}

      <div style={{textAlign:'center',marginTop:'1.5rem',fontSize:'0.6875rem',color:'rgba(255,255,255,0.2)'}}>
        Auto-locks after 2 minutes of inactivity
      </div>
    </div>
  );
}

/**
 * Hours & Pay tab
 */
function HoursView({ user }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  useEffect(() => {
    api.shifts.list({ status: 'COMPLETED' }).then(res => {
      const data = res.data || [];
      setShifts(data);
      if (data.length > 0) {
        const months = [...new Set(data.map(s => getShiftMonth(s)))].sort().reverse();
        if (months.length > 0) setSelectedMonth(months[0]);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  function getHours(s) {
    if (!s.start_time || !s.end_time) return 0;
    return Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 3600000);
  }

  function getShiftMonth(s) {
    const parts = new Date(s.start_time).toLocaleDateString('en-GB', { timeZone:'Europe/London', year:'numeric', month:'2-digit' }).split('/');
    return `${parts[1]}-${parts[0]}`;
  }

  function formatMonth(m) {
    const [y, mo] = m.split('-');
    return new Date(y, parseInt(mo)-1).toLocaleDateString('en-GB', { month:'long', year:'numeric' });
  }

  const monthShifts = shifts.filter(s => getShiftMonth(s) === selectedMonth);
  const availableMonths = [...new Set(shifts.map(s => getShiftMonth(s)))].sort().reverse();
  const regularShifts = monthShifts.filter(s => s.shift_type !== 'bank_holiday');
  const bankHolShifts = monthShifts.filter(s => s.shift_type === 'bank_holiday');
  const regularHrs = regularShifts.reduce((sum, s) => sum + getHours(s), 0);
  const bankHolHrs = bankHolShifts.reduce((sum, s) => sum + getHours(s), 0);
  const totalHrs = regularHrs + bankHolHrs;
  const regularPay = regularShifts.reduce((sum, s) => sum + getHours(s) * (s.pay_rate || 0), 0);
  const bankHolPay = bankHolShifts.reduce((sum, s) => sum + getHours(s) * (s.pay_rate || 0), 0);
  const totalPay = regularPay + bankHolPay;

  if (loading) return <div style={{padding:'2rem',textAlign:'center',color:'rgba(255,255,255,0.4)'}}>Loading...</div>;

  return (
    <>
      {/* Month selector */}
      <div style={{display:'flex',gap:'0.5rem',overflowX:'auto',marginBottom:'1rem',paddingBottom:'0.25rem'}}>
        {availableMonths.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            style={{padding:'0.5rem 0.875rem',borderRadius:'8px',fontSize:'0.8125rem',fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,
              background: m === selectedMonth ? '#1a52a8' : 'rgba(255,255,255,0.07)',
              border: m === selectedMonth ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
              color: m === selectedMonth ? '#fff' : 'rgba(255,255,255,0.5)'}}>
            {formatMonth(m)}
          </button>
        ))}
      </div>

      {/* Summary card */}
      <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',padding:'1rem',marginBottom:'1rem'}}>
        <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',fontWeight:600,marginBottom:'0.25rem'}}>{formatMonth(selectedMonth)}</div>
        <div style={{fontSize:'1.25rem',fontWeight:700,color:'#fff'}}>{totalHrs.toFixed(1)} hours</div>
        <div style={{fontSize:'0.875rem',color:'#f59e0b',fontWeight:600}}>£{totalPay.toFixed(2)}</div>
        {bankHolHrs > 0 && (
          <div style={{marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.6)',fontWeight:600}}>{regularHrs.toFixed(1)}h regular · £{regularPay.toFixed(2)}</div>
            <div style={{fontSize:'0.75rem',color:'#60a5fa',fontWeight:600}}>{bankHolHrs.toFixed(1)}h bank holiday · £{bankHolPay.toFixed(2)}</div>
          </div>
        )}
        <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.3)',marginTop:'0.375rem'}}>{monthShifts.length} shift{monthShifts.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Shift list */}
      <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
        {monthShifts.length === 0 ? (
          <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>No shifts for {formatMonth(selectedMonth)}.</div>
        ) : monthShifts.sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map(s => {
          const hrs = getHours(s);
          const pay = hrs * (s.pay_rate || 0);
          const isBH = s.shift_type === 'bank_holiday';
          return (
            <div key={s.id} style={{
              background: isBH ? 'rgba(26,82,168,0.1)' : 'rgba(255,255,255,0.05)',
              border: isBH ? '1px solid rgba(26,82,168,0.3)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius:'10px',padding:'0.75rem'}}>
              {isBH && <div style={{fontSize:'0.625rem',fontWeight:700,color:'#60a5fa',marginBottom:'0.25rem',letterSpacing:'0.5px'}}>BANK HOLIDAY</div>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'0.875rem',fontWeight:600,color:'#fff'}}>{s.site?.name || 'Site'}</div>
                  <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)'}}>
                    {new Date(s.start_time).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'})}
                    {' · '}
                    {new Date(s.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} – {new Date(s.end_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.9375rem',fontWeight:700,color:'#fff'}}>{hrs.toFixed(1)}h</div>
                  <div style={{fontSize:'0.6875rem',color:'#f59e0b'}}>£{pay.toFixed(2)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Personal Details tab — HR self-service form
 */
function DetailsView({ user }) {
  const [hr, setHr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

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

  useEffect(() => {
    async function load() {
      try {
        const res = await api.hr.get();
        if (res.data) {
          setHr(res.data);
          setForm({
            nok_name: res.data.nok_name || '', nok_relationship: res.data.nok_relationship || '', nok_phone: res.data.nok_phone || '',
            address_line_1: res.data.address_line_1 || '', address_line_2: res.data.address_line_2 || '',
            city: res.data.city || '', postcode: res.data.postcode || '',
            date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.split('T')[0] : '', ni_number: res.data.ni_number || '',
          });
          setConsentChecked(!!res.data.gdpr_consent);
          setDocs({ sia_front: res.data.sia_front_path || null, sia_back: res.data.sia_back_path || null, dbs_certificate: res.data.dbs_certificate_path || null });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function loadDocUrl(docType) {
    if (docUrls[docType]) return;
    try { const res = await api.hr.getDocUrl(docType); setDocUrls(prev => ({ ...prev, [docType]: res.url })); } catch {}
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadTarget) return;
    setUploading(uploadTarget);
    try {
      await api.hr.uploadDoc(uploadTarget, file);
      setDocs(prev => ({ ...prev, [uploadTarget]: 'uploaded' }));
      setDocUrls(prev => ({ ...prev, [uploadTarget]: URL.createObjectURL(file) }));
      setSuccess('Document uploaded'); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setUploading(''); setUploadTarget(''); }
  }

  async function deleteDoc(docType) {
    if (!confirm('Remove this document? This cannot be undone.')) return;
    try { await api.hr.deleteDoc(docType); setDocs(prev => ({ ...prev, [docType]: null })); setDocUrls(prev => ({ ...prev, [docType]: null })); }
    catch (err) { setError(err.message); }
  }

  async function save() {
    if (!consentChecked) { setError('You must agree to the data processing statement'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.hr.save({ ...form, gdpr_consent: true, gdpr_consent_at: hr?.gdpr_consent_at || new Date().toISOString() });
      setSuccess('HR details saved'); setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'11px 12px', fontSize:'14px', color:'#fff', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'5px', display:'block' };
  const section = { marginBottom:'16px', padding:'14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px' };
  const sectionTitle = { fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'12px' };

  if (loading) return <div style={{padding:'2rem',textAlign:'center',color:'rgba(255,255,255,0.4)'}}>Loading...</div>;

  return (
    <>
      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}
      {success && <div style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#4ade80',marginBottom:'12px'}}>{success}</div>}

      <div style={section}>
        <div style={sectionTitle}>Next of Kin / Emergency Contact</div>
        <div style={{marginBottom:'8px'}}><label style={lbl}>Full Name</label><input value={form.nok_name} onChange={e => f('nok_name', e.target.value)} placeholder="e.g. Jane Smith" style={inp} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
          <div><label style={lbl}>Relationship</label><select value={form.nok_relationship} onChange={e => f('nok_relationship', e.target.value)} style={inp}><option value="">Select...</option>{['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><label style={lbl}>Phone Number</label><input value={form.nok_phone} onChange={e => f('nok_phone', e.target.value)} placeholder="+44 7700 000000" style={inp} /></div>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Personal Details</div>
        <div style={{marginBottom:'8px'}}><label style={lbl}>Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} style={inp} /></div>
        <div style={{marginBottom:'8px'}}><label style={lbl}>Address Line 1</label><input value={form.address_line_1} onChange={e => f('address_line_1', e.target.value)} style={inp} /></div>
        <div style={{marginBottom:'8px'}}><label style={lbl}>Address Line 2</label><input value={form.address_line_2} onChange={e => f('address_line_2', e.target.value)} style={inp} /></div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'8px'}}>
          <div><label style={lbl}>City / Town</label><input value={form.city} onChange={e => f('city', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Postcode</label><input value={form.postcode} onChange={e => f('postcode', e.target.value)} placeholder="AB1 2CD" style={inp} /></div>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>National Insurance</div>
        <label style={lbl}>NI Number</label>
        <input value={form.ni_number} onChange={e => f('ni_number', e.target.value.toUpperCase())} placeholder="AB 12 34 56 C" maxLength={13} style={{...inp, fontFamily:'monospace', letterSpacing:'0.1em'}} />
        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'4px'}}>Encrypted at rest. Only accessible by authorised company admin.</div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Documents</div>
        {createPortal(
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={handleUpload} />,
          document.body
        )}
        {[
          { key: 'sia_front', label: 'SIA Licence (Front)' },
          { key: 'sia_back', label: 'SIA Licence (Back)' },
          { key: 'dbs_certificate', label: 'DBS Certificate' },
        ].map(doc => (
          <div key={doc.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{doc.label}</div>
              <div style={{fontSize:'10px',color: docs[doc.key] ? 'rgba(74,222,128,0.8)' : 'rgba(255,255,255,0.25)',marginTop:'2px'}}>{docs[doc.key] ? 'Uploaded' : 'Not uploaded'}</div>
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              {docs[doc.key] && (
                <>
                  <button onClick={async () => { await loadDocUrl(doc.key); if (docUrls[doc.key]) window.open(docUrls[doc.key], '_blank'); }}
                    style={{padding:'6px 10px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:'6px',color:'#60a5fa',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>View</button>
                  <button onClick={() => deleteDoc(doc.key)}
                    style={{padding:'6px 10px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'6px',color:'#ef4444',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>Remove</button>
                </>
              )}
              <button onClick={() => { setUploadTarget(doc.key); fileRef.current?.click(); }} disabled={uploading === doc.key}
                style={{padding:'6px 10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',color:'rgba(255,255,255,0.6)',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>
                {uploading === doc.key ? '...' : docs[doc.key] ? 'Replace' : 'Upload'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{...section, border:'1px solid rgba(59,130,246,0.15)', background:'rgba(59,130,246,0.03)'}}>
        <div style={sectionTitle}>Data Processing Statement</div>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.45)',lineHeight:1.6,marginBottom:'12px'}}>
          By submitting your personal information, you consent to your employer processing this data for the purposes of employment administration, payroll, regulatory compliance (SIA licensing, BS7858 vetting), and emergency contact procedures. Your data is stored securely, encrypted at rest, and will only be accessed by authorised personnel. You may request access to, correction of, or deletion of your data at any time by contacting your line manager or data controller.
        </div>
        <div onClick={() => setConsentChecked(!consentChecked)} style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',padding:'8px 0'}}>
          <div style={{width:20,height:20,borderRadius:'4px',border:`2px solid ${consentChecked ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.15)'}`,background: consentChecked ? 'rgba(59,130,246,0.15)' : 'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {consentChecked && <div style={{color:'#60a5fa',fontSize:'13px',fontWeight:700}}>✓</div>}
          </div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.6)',lineHeight:1.4}}>I understand and consent to the processing of my personal data as described above</div>
        </div>
        {hr?.gdpr_consent_at && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'4px'}}>Consent recorded: {new Date(hr.gdpr_consent_at).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</div>}
      </div>

      <button onClick={save} disabled={saving || !consentChecked}
        style={{width:'100%',padding:'14px',background: consentChecked ? '#1a52a8' : '#333',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor: consentChecked ? 'pointer' : 'not-allowed',opacity: saving ? 0.7 : 1}}>
        {saving ? 'SAVING...' : 'SAVE HR DETAILS'}
      </button>
    </>
  );
}
