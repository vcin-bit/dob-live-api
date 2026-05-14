import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { HoursTab } from './HRPortal';

const AUTO_LOCK_MS = 2 * 60 * 1000;

export default function OfficerHR({ user }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [noPin, setNoPin] = useState(false);
  const lastActivity = useRef(Date.now());
  const lockTimer = useRef(null);

  useEffect(() => {
    if (!unlocked) return;
    function onActivity() { lastActivity.current = Date.now(); }
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('click', onActivity);
    lockTimer.current = setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_LOCK_MS) { setUnlocked(false); setPin(''); }
    }, 10000);
    return () => { window.removeEventListener('touchstart', onActivity); window.removeEventListener('click', onActivity); clearInterval(lockTimer.current); };
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
      }).catch(() => { setError('Could not verify PIN'); setPin(''); }).finally(() => setChecking(false));
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
                      style={{padding:'1rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.5)',fontSize:'0.875rem',fontWeight:600,cursor:'pointer'}}>Del</button>
                  );
                  return (
                    <button key={i} onClick={() => handleDigit(k)}
                      style={{padding:'1rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'#fff',fontSize:'1.125rem',fontWeight:600,cursor:'pointer'}}>{k}</button>
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

  return <UnlockedHR user={user} onLock={() => { setUnlocked(false); setPin(''); }} />;
}

function UnlockedHR({ user, onLock }) {
  const [tab, setTab] = useState('hours');
  const [dbUser, setDbUser] = useState(null);
  const [hr, setHr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nok_name:'', nok_relationship:'', nok_phone:'',
    address_line_1:'', address_line_2:'', city:'', postcode:'',
    date_of_birth:'', ni_number:'', personal_email:'',
    bank_name:'', bank_sort_code:'', bank_account_number:'', bank_account_holder:'',
    employment_status:'', utr_number:'',
    company_name:'', company_address:'', company_vat_number:'', company_reg_number:'',
    self_employment_declaration: false, terms_accepted: false,
  });
  const [docs, setDocs] = useState({ sia_front:null, sia_back:null, dbs_certificate:null });
  const [docUrls, setDocUrls] = useState({});
  const [uploading, setUploading] = useState('');
  const fileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState('');
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [invoiceShifts, setInvoiceShifts] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

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
            self_employment_declaration: hrRes.data.self_employment_declaration||false, terms_accepted: hrRes.data.terms_accepted||false,
          });
          setConsentChecked(!!hrRes.data.gdpr_consent);
          setDocs({ sia_front: hrRes.data.sia_front_path||null, sia_back: hrRes.data.sia_back_path||null, dbs_certificate: hrRes.data.dbs_certificate_path||null });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadDocUrl(docType) {
    if (docUrls[docType]) return;
    try { const res = await api.hr.getDocUrl(docType); setDocUrls(prev => ({ ...prev, [docType]: res.url })); } catch {}
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
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
    if (!confirm('Remove this document?')) return;
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

  if (loading) return <div style={{padding:'2rem',textAlign:'center',color:'rgba(255,255,255,0.4)'}}>Loading...</div>;

  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'11px 12px', fontSize:'14px', color:'#fff', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'5px', display:'block' };
  const section = { marginBottom:'16px', padding:'14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px' };
  const sectionTitle = { fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'12px' };

  return (
    <div style={{padding:'1rem',paddingBottom:'6rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div style={{fontSize:'1.125rem',fontWeight:700,color:'#fff'}}>My Hours & Pay</div>
        <button onClick={onLock} style={{padding:'0.375rem 0.75rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'rgba(255,255,255,0.5)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>Lock</button>
      </div>

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

      {tab === 'hours' && (
        <HoursTab hr={hr} dbUser={dbUser} form={form}
          shifts={shifts} setShifts={setShifts}
          shiftsLoading={shiftsLoading} setShiftsLoading={setShiftsLoading}
          invoiceShifts={invoiceShifts} setInvoiceShifts={setInvoiceShifts}
          showInvoice={showInvoice} setShowInvoice={setShowInvoice}
          invoiceRef={invoiceRef} setInvoiceRef={setInvoiceRef} />
      )}

      {tab === 'details' && (
        <>
          {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}
          {success && <div style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#4ade80',marginBottom:'12px'}}>{success}</div>}

          {/* Employment Status */}
          <div style={section}>
            <div style={sectionTitle}>Employment Status</div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {[
                { value:'employed', label:'Employed (PAYE)', desc:'Your employer handles tax and NI through PAYE.' },
                { value:'self_employed', label:'Self-Employed', desc:'You invoice for your services and manage your own tax.' },
                { value:'ltd_company', label:'Subcontractor (Ltd)', desc:'You operate through a limited company and invoice as a business.' },
              ].map(opt => (
                <label key={opt.value} onClick={() => f('employment_status', opt.value)}
                  style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'12px',borderRadius:'8px',cursor:'pointer',
                    background: form.employment_status === opt.value ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                    border: form.employment_status === opt.value ? '1.5px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)'}}>
                  <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${form.employment_status === opt.value ? '#3b82f6' : 'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'1px'}}>
                    {form.employment_status === opt.value && <div style={{width:8,height:8,borderRadius:'50%',background:'#3b82f6'}} />}
                  </div>
                  <div>
                    <div style={{fontSize:'0.8125rem',fontWeight:600,color:'#fff'}}>{opt.label}</div>
                    <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Company details for Ltd */}
          {form.employment_status === 'ltd_company' && (
            <div style={section}>
              <div style={sectionTitle}>Company Details</div>
              <div style={{marginBottom:'8px'}}><label style={lbl}>Company Name</label><input value={form.company_name} onChange={e => f('company_name', e.target.value)} style={inp} /></div>
              <div style={{marginBottom:'8px'}}><label style={lbl}>Company Address</label><input value={form.company_address} onChange={e => f('company_address', e.target.value)} style={inp} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <div><label style={lbl}>Company Reg No</label><input value={form.company_reg_number} onChange={e => f('company_reg_number', e.target.value)} style={inp} /></div>
                <div><label style={lbl}>VAT Number</label><input value={form.company_vat_number} onChange={e => f('company_vat_number', e.target.value)} style={inp} /></div>
              </div>
            </div>
          )}

          {/* UTR for self-employed */}
          {(form.employment_status === 'self_employed' || form.employment_status === 'ltd_company') && (
            <div style={section}>
              <div style={sectionTitle}>Tax Details</div>
              <label style={lbl}>UTR Number</label>
              <input value={form.utr_number} onChange={e => f('utr_number', e.target.value)} placeholder="10 digits" style={inp} />
            </div>
          )}

          {/* Personal Email */}
          <div style={section}>
            <div style={sectionTitle}>Personal Email</div>
            <label style={lbl}>Email Address</label>
            <input value={form.personal_email} onChange={e => f('personal_email', e.target.value)} placeholder="your@email.com" style={inp} />
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'4px'}}>Used to send copies of invoices and correspondence.</div>
          </div>

          {/* Bank Details */}
          <div style={section}>
            <div style={sectionTitle}>Bank Details</div>
            <div style={{marginBottom:'8px'}}><label style={lbl}>Account Holder Name</label><input value={form.bank_account_holder} onChange={e => f('bank_account_holder', e.target.value)} style={inp} /></div>
            <div style={{marginBottom:'8px'}}><label style={lbl}>Bank Name</label><input value={form.bank_name} onChange={e => f('bank_name', e.target.value)} style={inp} /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <div><label style={lbl}>Sort Code</label><input value={form.bank_sort_code} onChange={e => f('bank_sort_code', e.target.value)} placeholder="00-00-00" style={{...inp, fontFamily:'monospace'}} /></div>
              <div><label style={lbl}>Account Number</label><input value={form.bank_account_number} onChange={e => f('bank_account_number', e.target.value)} placeholder="00000000" style={{...inp, fontFamily:'monospace'}} /></div>
            </div>
          </div>

          {/* Next of Kin */}
          <div style={section}>
            <div style={sectionTitle}>Next of Kin / Emergency Contact</div>
            <div style={{marginBottom:'8px'}}><label style={lbl}>Full Name</label><input value={form.nok_name} onChange={e => f('nok_name', e.target.value)} style={inp} /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <div><label style={lbl}>Relationship</label><select value={form.nok_relationship} onChange={e => f('nok_relationship', e.target.value)} style={inp}><option value="">Select...</option>{['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              <div><label style={lbl}>Phone Number</label><input value={form.nok_phone} onChange={e => f('nok_phone', e.target.value)} style={inp} /></div>
            </div>
          </div>

          {/* Personal Details */}
          <div style={section}>
            <div style={sectionTitle}>Personal Details</div>
            <div style={{marginBottom:'8px'}}><label style={lbl}>Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} style={inp} /></div>
            <div style={{marginBottom:'8px'}}><label style={lbl}>Address Line 1</label><input value={form.address_line_1} onChange={e => f('address_line_1', e.target.value)} style={inp} /></div>
            <div style={{marginBottom:'8px'}}><label style={lbl}>Address Line 2</label><input value={form.address_line_2} onChange={e => f('address_line_2', e.target.value)} style={inp} /></div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'8px'}}>
              <div><label style={lbl}>City / Town</label><input value={form.city} onChange={e => f('city', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Postcode</label><input value={form.postcode} onChange={e => f('postcode', e.target.value)} style={inp} /></div>
            </div>
          </div>

          {/* NI Number */}
          <div style={section}>
            <div style={sectionTitle}>National Insurance</div>
            <label style={lbl}>NI Number</label>
            <input value={form.ni_number} onChange={e => f('ni_number', e.target.value.toUpperCase())} placeholder="AB 12 34 56 C" maxLength={13} style={{...inp, fontFamily:'monospace', letterSpacing:'0.1em'}} />
          </div>

          {/* Documents */}
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

          {/* GDPR */}
          <div style={{...section, border:'1px solid rgba(59,130,246,0.15)', background:'rgba(59,130,246,0.03)'}}>
            <div style={sectionTitle}>Data Processing Statement</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.45)',lineHeight:1.6,marginBottom:'12px'}}>
              By submitting your personal information, you consent to your employer processing this data for the purposes of employment administration, payroll, regulatory compliance (SIA licensing, BS7858 vetting), and emergency contact procedures. Your data is stored securely, encrypted at rest, and will only be accessed by authorised personnel.
            </div>
            <div onClick={() => setConsentChecked(!consentChecked)} style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',padding:'8px 0'}}>
              <div style={{width:20,height:20,borderRadius:'4px',border:`2px solid ${consentChecked ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.15)'}`,background: consentChecked ? 'rgba(59,130,246,0.15)' : 'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {consentChecked && <div style={{color:'#60a5fa',fontSize:'13px',fontWeight:700}}>✓</div>}
              </div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.6)',lineHeight:1.4}}>I understand and consent to the processing of my personal data</div>
            </div>
          </div>

          <button onClick={save} disabled={saving || !consentChecked}
            style={{width:'100%',padding:'14px',background: consentChecked ? '#1a52a8' : '#333',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor: consentChecked ? 'pointer' : 'not-allowed',opacity: saving ? 0.7 : 1}}>
            {saving ? 'SAVING...' : 'SAVE HR DETAILS'}
          </button>
        </>
      )}

      <div style={{textAlign:'center',marginTop:'1.5rem',fontSize:'0.6875rem',color:'rgba(255,255,255,0.2)'}}>Auto-locks after 2 minutes of inactivity</div>
    </div>
  );
}
