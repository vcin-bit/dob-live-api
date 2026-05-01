import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';

export default function OfficerHR({ user }) {
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

  // Document states
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
            nok_name: res.data.nok_name || '',
            nok_relationship: res.data.nok_relationship || '',
            nok_phone: res.data.nok_phone || '',
            address_line_1: res.data.address_line_1 || '',
            address_line_2: res.data.address_line_2 || '',
            city: res.data.city || '',
            postcode: res.data.postcode || '',
            date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.split('T')[0] : '',
            ni_number: res.data.ni_number || '',
          });
          setConsentChecked(!!res.data.gdpr_consent);
          setDocs({
            sia_front: res.data.sia_front_path || null,
            sia_back: res.data.sia_back_path || null,
            dbs_certificate: res.data.dbs_certificate_path || null,
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function loadDocUrl(docType) {
    if (docUrls[docType]) return;
    try {
      const res = await api.hr.getDocUrl(docType);
      setDocUrls(prev => ({ ...prev, [docType]: res.url }));
    } catch {}
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
      setSuccess('Document uploaded');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setUploading(''); setUploadTarget(''); }
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
      await api.hr.save({
        ...form,
        gdpr_consent: true,
        gdpr_consent_at: hr?.gdpr_consent_at || new Date().toISOString(),
      });
      setSuccess('HR details saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'11px 12px', fontSize:'14px', color:'#fff', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'5px', display:'block' };
  const section = { marginBottom:'16px', padding:'14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px' };
  const sectionTitle = { fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'12px' };

  if (loading) return (
    <div style={{padding:'1rem',display:'flex',justifyContent:'center',paddingTop:'3rem'}}>
      <div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} />
    </div>
  );

  return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>HR Self-Service</div>
        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'2px'}}>Your information is stored securely and only accessible by authorised personnel</div>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}
      {success && <div style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#4ade80',marginBottom:'12px'}}>{success}</div>}

      {/* Next of Kin */}
      <div style={section}>
        <div style={sectionTitle}>Next of Kin / Emergency Contact</div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Full Name</label>
          <input value={form.nok_name} onChange={e => f('nok_name', e.target.value)} placeholder="e.g. Jane Smith" style={inp} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
          <div>
            <label style={lbl}>Relationship</label>
            <select value={form.nok_relationship} onChange={e => f('nok_relationship', e.target.value)} style={inp}>
              <option value="">Select...</option>
              {['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Phone Number</label>
            <input value={form.nok_phone} onChange={e => f('nok_phone', e.target.value)} placeholder="+44 7700 000000" style={inp} />
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <div style={section}>
        <div style={sectionTitle}>Personal Details</div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Date of Birth</label>
          <input type="date" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} style={inp} />
        </div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Address Line 1</label>
          <input value={form.address_line_1} onChange={e => f('address_line_1', e.target.value)} style={inp} />
        </div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Address Line 2</label>
          <input value={form.address_line_2} onChange={e => f('address_line_2', e.target.value)} style={inp} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'8px'}}>
          <div>
            <label style={lbl}>City / Town</label>
            <input value={form.city} onChange={e => f('city', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Postcode</label>
            <input value={form.postcode} onChange={e => f('postcode', e.target.value)} placeholder="AB1 2CD" style={inp} />
          </div>
        </div>
      </div>

      {/* National Insurance */}
      <div style={section}>
        <div style={sectionTitle}>National Insurance</div>
        <div>
          <label style={lbl}>NI Number</label>
          <input value={form.ni_number} onChange={e => f('ni_number', e.target.value.toUpperCase())} placeholder="AB 12 34 56 C" maxLength={13} style={{...inp, fontFamily:'monospace', letterSpacing:'0.1em'}} />
        </div>
        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'4px'}}>Encrypted at rest. Only accessible by authorised company admin.</div>
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
              <div style={{fontSize:'10px',color: docs[doc.key] ? 'rgba(74,222,128,0.8)' : 'rgba(255,255,255,0.25)',marginTop:'2px'}}>
                {docs[doc.key] ? 'Uploaded' : 'Not uploaded'}
              </div>
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              {docs[doc.key] && (
                <>
                  <button onClick={async () => { await loadDocUrl(doc.key); if (docUrls[doc.key]) window.open(docUrls[doc.key], '_blank'); }}
                    style={{padding:'6px 10px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:'6px',color:'#60a5fa',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>
                    View
                  </button>
                  <button onClick={() => deleteDoc(doc.key)}
                    style={{padding:'6px 10px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'6px',color:'#ef4444',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>
                    Remove
                  </button>
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

      {/* GDPR Consent */}
      <div style={{...section, border:'1px solid rgba(59,130,246,0.15)', background:'rgba(59,130,246,0.03)'}}>
        <div style={sectionTitle}>Data Processing Statement</div>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.45)',lineHeight:1.6,marginBottom:'12px'}}>
          By submitting your personal information, you consent to your employer processing this data for the purposes of employment administration, payroll, regulatory compliance (SIA licensing, BS7858 vetting), and emergency contact procedures. Your data is stored securely, encrypted at rest, and will only be accessed by authorised personnel. You may request access to, correction of, or deletion of your data at any time by contacting your line manager or data controller. Data will be retained for the duration of your employment plus 6 years in line with HMRC requirements, unless you request earlier deletion of non-statutory records.
        </div>
        <div onClick={() => setConsentChecked(!consentChecked)} style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',padding:'8px 0'}}>
          <div style={{width:20,height:20,borderRadius:'4px',border:`2px solid ${consentChecked ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.15)'}`,background: consentChecked ? 'rgba(59,130,246,0.15)' : 'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {consentChecked && <div style={{color:'#60a5fa',fontSize:'13px',fontWeight:700}}>✓</div>}
          </div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.6)',lineHeight:1.4}}>I understand and consent to the processing of my personal data as described above</div>
        </div>
        {hr?.gdpr_consent_at && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'4px'}}>Consent recorded: {new Date(hr.gdpr_consent_at).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</div>}
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving || !consentChecked}
        style={{width:'100%',padding:'14px',background: consentChecked ? '#1a52a8' : '#333',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor: consentChecked ? 'pointer' : 'not-allowed',letterSpacing:'0.02em',opacity: saving ? 0.7 : 1}}>
        {saving ? 'SAVING...' : 'SAVE HR DETAILS'}
      </button>
    </div>
  );
}
