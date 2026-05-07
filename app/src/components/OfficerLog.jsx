import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { MapPinIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { LOG_TYPE_CONFIG } from '../lib/constants';
import { compressImage, isImage } from '../lib/imageUtils';

// ── Types config ─────────────────────────────────────────────────────────────
const HIGH_PRIORITY = [
  { key:'INCIDENT',   label:'INCIDENT',        sub:'Crime · Disturbance · Threat',  color:'#ef4444', border:'rgba(239,68,68,0.45)', bg:'rgba(239,68,68,0.12)' },
  { key:'ALARM',      label:'ALARM',           sub:'Intruder · Fire · Technical',   color:'#fbbf24', border:'rgba(251,191,36,0.35)', bg:'rgba(251,191,36,0.1)' },
  { key:'FIRE_ALARM', label:'FIRE / EVACUATION', sub:'Fire alarm · Evacuation',     color:'rgba(239,68,68,0.8)', border:'rgba(239,68,68,0.25)', bg:'rgba(239,68,68,0.08)' },
  { key:'EMERGENCY',  label:'EMERGENCY',       sub:'Medical · Serious incident',    color:'#ef4444', border:'rgba(239,68,68,0.4)', bg:'rgba(239,68,68,0.1)' },
];
const ROUTINE = [
  { key:'PATROL',        label:'PATROL',       sub:'Check · Observation' },
  { key:'ACCESS_CONTROL',label:'ACCESS',       sub:'Entry · Visitor' },
  { key:'VEHICLE_CHECK', label:'VEHICLE',      sub:'Check · Suspicious' },
  { key:'MAINTENANCE',   label:'MAINTENANCE',  sub:'Fault · Repair' },
  { key:'VISITOR',          label:'VISITOR / CONTRACTOR', sub:'Name, reg, personnel' },
  { key:'CCTV_CHECK',      label:'CCTV PATROL',          sub:'Camera review' },
  { key:'WELFARE_CHECK',   label:'WELFARE CHECK',        sub:'Officer welfare' },
  { key:'HANDOVER',        label:'HANDOVER',             sub:'Shift handover' },
  { key:'GENERAL',         label:'GENERAL',              sub:'Observation · Note' },
  { key:'OTHER',           label:'OTHER',                sub:'Anything else' },
];
const SUB_TYPES = {
  INCIDENT:    ['THEFT','FIGHT/ASSAULT','TRESPASS','VANDALISM','SUSPICIOUS PERSON','DRUG-RELATED','VERBAL ABUSE','OTHER'],
  ALARM:       ['INTRUDER','FIRE','PANIC','TECHNICAL FAULT','FALSE ALARM','OTHER'],
  FIRE_ALARM:  ['FIRE','FALSE ALARM','DRILL','EVACUATION','OTHER'],
  EMERGENCY:   ['MEDICAL','FIRE','SECURITY THREAT','STRUCTURAL','OTHER'],
  PATROL:      ['ROUTINE PATROL','PERIMETER CHECK','INTERNAL CHECK','WELFARE CHECK','CCTV REVIEW'],
  ACCESS_CONTROL:['AUTHORISED ENTRY','REFUSED ENTRY','TAILGATE','OUT OF HOURS','CONTRACTOR'],
  VEHICLE_CHECK: ['ROUTINE CHECK','SUSPICIOUS VEHICLE','ABANDONED','PARKING VIOLATION','DAMAGE'],
  MAINTENANCE: ['LIGHTING','DOOR/GATE','CCTV','FENCE/PERIMETER','LOCK/KEY','OTHER'],
};

const ALL_TYPES = [...HIGH_PRIORITY, ...ROUTINE];
const getType = key => ALL_TYPES.find(t => t.key === key);

// ── Styles helpers ────────────────────────────────────────────────────────────
const S = {
  label: { fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'7px' },
  input: { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'12px', fontSize:'14px', color:'#fff', resize:'none', boxSizing:'border-box', fontFamily:'inherit' },
  pill: (sel) => ({ padding:'8px 14px', background:sel?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.04)', border:`1.5px solid ${sel?'rgba(239,68,68,0.45)':'rgba(255,255,255,0.1)'}`, borderRadius:'6px', fontSize:'12px', color:sel?'#ef4444':'rgba(255,255,255,0.45)', fontWeight:700, cursor:'pointer', letterSpacing:'0.04em' }),
  btn: (color) => ({ width:'100%', padding:'16px', background:color||'#1a52a8', border:'none', borderRadius:'10px', color:'#fff', fontSize:'15px', fontWeight:700, cursor:'pointer', letterSpacing:'0.03em' }),
  ghost: { width:'100%', padding:'12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', color:'rgba(255,255,255,0.4)', fontSize:'13px', cursor:'pointer', letterSpacing:'0.03em' },
  toggle: (on) => ({ width:'40px', height:'22px', background:on?'#3b82f6':'rgba(255,255,255,0.1)', borderRadius:'999px', position:'relative', flexShrink:0, cursor:'pointer', transition:'background 0.2s' }),
  toggleDot: (on) => ({ position:'absolute', top:3, left:on?'auto':'3px', right:on?'3px':'auto', width:16, height:16, background:'#fff', borderRadius:'50%' }),
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ step }) {
  return (
    <div style={{display:'flex',gap:'4px'}}>
      {[1,2,3].map(n => (
        <div key={n} style={{height:'8px', width:n===step?'20px':'8px', borderRadius:'4px', background:n===step?'#3b82f6':'rgba(255,255,255,0.2)', transition:'width 0.2s'}} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function LogEntryScreen({ user, site, shift }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetType = searchParams.get('type') || '';
  const [step, setStep] = useState(presetType ? 2 : 1);
  const [form, setForm] = useState({
    log_type: presetType, sub_type: '', description: '', location_detail: '', people_involved: '', actions_taken: '',
    occurred_at: new Date().toISOString().slice(0,16),
    latitude: null, longitude: null,
    police_reported: false, police_attended: false,
    police_incident_number: '', police_force: '', police_officer_name: '', police_shoulder_number: '',
    client_reportable: false, media: [],
    // VISITOR fields
    visitor_name: '', visitor_who_visiting: '', visitor_pass_number: '', visitor_vehicle_reg: '', visitor_personnel_count: '1', visitor_time_in: new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}),
    // WELFARE_CHECK fields
    welfare_officer_name: '', welfare_outcome: '', welfare_notes: '',
    // MANAGEMENT_VISIT fields
    manager_name: '', visit_purpose: '', visit_duration: '',
    // CCTV_CHECK fields
    cameras_checked: '', cctv_issues_found: false, cctv_issue_description: '', cctv_action_taken: '',
  });
  const [narrative, setNarrative] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mediaInputRef = useRef(null);
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const type = getType(form.log_type);
  const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';

  // GPS
  function getGPS() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(pos => {
      f('latitude', pos.coords.latitude); f('longitude', pos.coords.longitude);
      setGpsLoading(false);
    }, () => setGpsLoading(false), { enableHighAccuracy: true, timeout: 8000 });
  }

  // Media upload
  async function uploadMedia(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploadingMedia(true);
    // Show local previews instantly so officer sees the image immediately
    const previews = files.map(rawFile => ({ url: URL.createObjectURL(rawFile), name: rawFile.name, type: rawFile.type, uploading: true }));
    f('media', [...form.media, ...previews]);
    const token = await window.__clerkGetToken?.() || '';
    const finalMedia = [...form.media];
    for (let i = 0; i < files.length; i++) {
      const rawFile = files[i];
      try {
        const file = isImage(rawFile) ? await compressImage(rawFile) : rawFile;
        const fd = new FormData(); fd.append('file', file);
        const r = await fetch(`${API}/api/patrols/media/upload`, { method:'POST', body:fd, headers:{ Authorization:`Bearer ${token}` } });
        if (!r.ok) { const txt = await r.text(); throw new Error(`Upload failed: ${r.status} ${txt}`); }
        const d = await r.json();
        if (d.url) finalMedia.push({ url: d.url, name: rawFile.name, type: rawFile.type });
        else throw new Error('No URL in response: ' + JSON.stringify(d));
      } catch (err) { console.error('Upload error:', err); alert('Upload failed: ' + err.message); }
    }
    f('media', finalMedia);
    setUploadingMedia(false);
  }

  // AI generate narrative
  async function generateNarrative() {
    if (!form.description.trim()) { setError('Please add a description first'); return; }
    setGeneratingAI(true); setError('');
    try {
      const res = await api.report.generate({
        log_type: form.log_type,
        incident_subtype: form.sub_type,
        description: form.description,
        site_name: site?.name,
        officer_name: `${user?.first_name} ${user?.last_name}`,
        occurred_at: form.occurred_at,
        police_attended: form.police_attended,
        police_reported: form.police_reported,
        police_incident_number: form.police_incident_number,
        police_force: form.police_force,
        police_officer_name: form.police_officer_name,
        police_shoulder_number: form.police_shoulder_number,
        actions_taken: form.actions_taken,
        people_involved: form.people_involved,
        location_detail: form.location_detail,
      });
      setNarrative(res.narrative);
    } catch (e) { setError('AI generation failed. You can write the report manually.'); }
    finally { setGeneratingAI(false); }
  }

  // Submit
  async function submit() {
    setSubmitting(true); setError('');
    try {
      const finalDesc = narrative || form.description;
      const res = await api.logs.create({
        site_id: site?.id,
        shift_id: shift?.id || null,
        log_type: form.log_type,
        title: `${form.log_type.replace(/_/g,' ')}${form.sub_type ? ' — ' + form.sub_type : ''}`,
        description: finalDesc,
        occurred_at: form.occurred_at,
        latitude: form.latitude, longitude: form.longitude,
        client_reportable: form.client_reportable,
        type_data: {
          sub_type: form.sub_type,
          location_detail: form.location_detail,
          people_involved: form.people_involved,
          actions_taken: form.actions_taken,
          police_reported: form.police_reported,
          police_attended: form.police_attended,
          police_incident_number: form.police_incident_number,
          police_force: form.police_force,
          police_officer_name: form.police_officer_name,
          police_shoulder_number: form.police_shoulder_number,
          media: form.media,
          ai_generated: !!narrative,
          // VISITOR
          ...(form.log_type === 'VISITOR' && { visitor_name: form.visitor_name, visitor_who_visiting: form.visitor_who_visiting, visitor_pass_number: form.visitor_pass_number, visitor_vehicle_reg: form.visitor_vehicle_reg, visitor_personnel_count: form.visitor_personnel_count, visitor_time_in: form.visitor_time_in }),
          // WELFARE_CHECK
          ...(form.log_type === 'WELFARE_CHECK' && { welfare_officer_name: form.welfare_officer_name, welfare_outcome: form.welfare_outcome, welfare_notes: form.welfare_notes }),
          // MANAGEMENT_VISIT
          ...(form.log_type === 'MANAGEMENT_VISIT' && { manager_name: form.manager_name, visit_purpose: form.visit_purpose, visit_duration: form.visit_duration }),
          // CCTV_CHECK
          ...(form.log_type === 'CCTV_CHECK' && { cameras_checked: form.cameras_checked, cctv_issues_found: form.cctv_issues_found, cctv_issue_description: form.cctv_issue_description, cctv_action_taken: form.cctv_action_taken }),
        },
      });
      navigate('/', { state: { message: 'Log entry submitted', logId: res.data?.id } });
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── GENERAL INFO: quick single-field entry, no categories/tabs ───────────────
  if (form.log_type === 'GENERAL_INFO') return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'3px',height:'24px',background:'#3b82f6',borderRadius:'2px'}} />
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#3b82f6',letterSpacing:'0.02em'}}>GENERAL INFO</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>Record non-incident occurrences</div>
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>Cancel</button>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>WHAT'S HAPPENING?</div>
        <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={4}
          placeholder="e.g. Site workers arriving, milk delivered, MD on site, cleaners finished..."
          style={S.input} autoFocus />
      </div>

      {/* Photos */}
      {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>PHOTOS</div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
          {form.media.map((m, i) => (
            <div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
              {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>VIDEO</div>}
              <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:1,right:1,width:16,height:16,background:'rgba(239,68,68,0.9)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
            </div>
          ))}
          {uploadingMedia && <div style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:20,height:20,border:'2px solid rgba(255,255,255,0.1)',borderTop:'2px solid #3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite'}}/></div>}
          <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'22px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:600}}>ADD PHOTO</div>
          </button>
        </div>
      </div>

      <button onClick={async () => {
        if (!form.description.trim()) { setError('Please enter what happened'); return; }
        setSubmitting(true); setError('');
        try {
          await api.logs.create({
            site_id: site?.id, shift_id: shift?.id || null, log_type: 'GENERAL',
            title: form.description.trim().slice(0, 60),
            description: form.description.trim(),
            occurred_at: new Date().toISOString(),
            ...(form.media.length ? { type_data: { media: form.media } } : {}),
          });
          navigate('/', { state: { message: 'Info logged' } });
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
      }} disabled={submitting || !form.description.trim()}
        style={S.btn(!form.description.trim() ? '#333' : '#1a52a8')}>
        {submitting ? 'LOGGING...' : 'LOG INFO'}
      </button>
    </div>
  );

  // ── ENVIRONMENTAL HEALTH & SAFETY ───────────────────────────────────────────
  if (form.log_type === 'EHS') return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'3px',height:'24px',background:'#f59e0b',borderRadius:'2px'}} />
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#f59e0b',letterSpacing:'0.02em'}}>HEALTH & SAFETY</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name}</div>
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>Cancel</button>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>CATEGORY *</div>
        <select value={form.sub_type||''} onChange={e=>f('sub_type',e.target.value)} style={S.input}>
          <option value="">Select category...</option>
          {['Slip / Trip / Fall','Hazardous Substance','Unsafe Condition','Fire Safety Issue','Water Leak / Flooding','Electrical Hazard','Broken Equipment','Poor Lighting','Asbestos Concern','Pest Sighting','Other'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>SEVERITY *</div>
        <div style={{display:'flex',gap:'6px'}}>
          {[{k:'Low',c:'#10b981'},{k:'Medium',c:'#f59e0b'},{k:'High',c:'#ef4444'},{k:'Critical',c:'#7f1d1d'}].map(({k,c}) => (
            <button key={k} type="button" onClick={() => f('welfare_outcome',k)}
              style={{flex:1,padding:'10px',background:form.welfare_outcome===k?`${c}20`:'rgba(255,255,255,0.03)',border:`1.5px solid ${form.welfare_outcome===k?c:'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'12px',fontWeight:700,color:form.welfare_outcome===k?c:'rgba(255,255,255,0.45)',cursor:'pointer'}}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>LOCATION ON SITE</div>
        <input value={form.location_detail||''} onChange={e=>f('location_detail',e.target.value)} placeholder="e.g. Warehouse B, entrance lobby" style={S.input} />
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>DESCRIPTION *</div>
        <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={3} placeholder="Describe the hazard or issue..." style={S.input} />
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>ACTION TAKEN</div>
        <textarea value={form.actions_taken||''} onChange={e=>f('actions_taken',e.target.value)} rows={2} placeholder="What action was taken to mitigate..." style={{...S.input,resize:'none'}} />
      </div>

      {/* Photos */}
      <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Photos (optional)</div>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
        {form.media.map((m, i) => (
          <div key={i} style={{width:56,height:56,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
            {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>video</div>}
            <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:1,right:1,width:16,height:16,background:'rgba(239,68,68,0.9)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
          </div>
        ))}
      </div>
      {form.media.length < 5 && (
        <div style={{marginBottom:'20px'}}>
          {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
          <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo</div>
          </button>
        </div>
      )}

      {/* Client reportable */}
      <div onClick={() => f('client_reportable',!form.client_reportable)}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:form.client_reportable?'rgba(59,130,246,0.07)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.client_reportable?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',cursor:'pointer',marginBottom:'14px'}}>
        <div>
          <div style={{fontSize:'12px',fontWeight:700,color:'#fff',letterSpacing:'0.02em'}}>REPORT TO CLIENT</div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>{form.client_reportable?'Visible in client portal + ops manager':'Ops manager only'}</div>
        </div>
        <div style={S.toggle(form.client_reportable)}><div style={S.toggleDot(form.client_reportable)}/></div>
      </div>

      <button onClick={async () => {
        if (!form.sub_type) { setError('Please select a category'); return; }
        if (!form.welfare_outcome) { setError('Please select severity'); return; }
        if (!form.description.trim()) { setError('Description is required'); return; }
        setSubmitting(true); setError('');
        try {
          await api.logs.create({
            site_id: site?.id, shift_id: shift?.id || null, log_type: 'HEALTH_SAFETY',
            title: `H&S — ${form.sub_type}`,
            description: form.description.trim(),
            occurred_at: new Date().toISOString(),
            client_reportable: form.client_reportable,
            type_data: {
              category: form.sub_type,
              severity: form.welfare_outcome,
              location: form.location_detail || null,
              action_taken: form.actions_taken || null,
              ...(form.media.length ? { media: form.media } : {}),
            },
          });
          navigate('/', { state: { message: 'H&S report submitted' } });
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
      }} disabled={submitting || !form.sub_type || !form.welfare_outcome || !form.description.trim()}
        style={S.btn(!form.sub_type || !form.welfare_outcome || !form.description.trim() ? '#333' : '#f59e0b')}>
        {submitting ? 'SUBMITTING...' : 'SUBMIT H&S REPORT'}
      </button>
    </div>
  );

  // ── VEHICLE REPORT ──────────────────────────────────────────────────────────
  if (form.log_type === 'VEHICLE') return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'3px',height:'24px',background:'#a78bfa',borderRadius:'2px'}} />
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#a78bfa',letterSpacing:'0.02em'}}>VEHICLE REPORT</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name}</div>
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>Cancel</button>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>TYPE *</div>
        <select value={form.sub_type||''} onChange={e=>f('sub_type',e.target.value)} style={S.input}>
          <option value="">Select type...</option>
          {['Abandoned','Suspicious','Parked Causing Obstruction','Damaged','Untaxed','Dangerous Driving','Other'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>REGISTRATION *</div>
        <input value={form.visitor_vehicle_reg||''} onChange={e=>f('visitor_vehicle_reg',e.target.value.toUpperCase())} placeholder="e.g. AB12 CDE" style={{...S.input,textTransform:'uppercase',letterSpacing:'0.1em',fontSize:'1.125rem'}} />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'14px'}}>
        <div>
          <div style={S.label}>MAKE / MODEL</div>
          <input value={form.visitor_name||''} onChange={e=>f('visitor_name',e.target.value)} placeholder="e.g. Ford Focus" style={S.input} />
        </div>
        <div>
          <div style={S.label}>COLOUR</div>
          <input value={form.visitor_pass_number||''} onChange={e=>f('visitor_pass_number',e.target.value)} placeholder="e.g. Silver" style={S.input} />
        </div>
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>LOCATION ON SITE</div>
        <input value={form.location_detail||''} onChange={e=>f('location_detail',e.target.value)} placeholder="e.g. Car park north, bay 12" style={S.input} />
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>DESCRIPTION *</div>
        <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={3} placeholder="Describe the issue..." style={S.input} />
      </div>

      {/* Police reported */}
      <div style={{marginBottom:'14px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px'}}>
        <div style={S.label}>REPORTED TO POLICE?</div>
        <div style={{display:'flex',gap:'8px'}}>
          <button type="button" onClick={() => f('police_reported', true)}
            style={{flex:1,padding:'12px',background:form.police_reported?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'13px',fontWeight:700,color:form.police_reported?'#60a5fa':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
            {form.police_reported?'✓ ':''}Yes
          </button>
          <button type="button" onClick={() => f('police_reported', false)}
            style={{flex:1,padding:'12px',background:form.police_reported===false?'rgba(239,68,68,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported===false?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'13px',fontWeight:700,color:form.police_reported===false?'#ef4444':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
            {form.police_reported===false?'✗ ':''}No
          </button>
        </div>
        {form.police_reported && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'10px'}}>
            <div>
              <div style={S.label}>POLICE FORCE</div>
              <select value={form.police_force||''} onChange={e => f('police_force', e.target.value)} style={S.input}>
                <option value="">Select force...</option>
                {['Avon and Somerset','Bedfordshire','Cambridgeshire','Cheshire','City of London','Cleveland','Cumbria','Derbyshire','Devon and Cornwall','Dorset','Durham','Dyfed-Powys','Essex','Gloucestershire','Greater Manchester','Gwent','Hampshire','Hertfordshire','Humberside','Kent','Lancashire','Leicestershire','Lincolnshire','Merseyside','Metropolitan Police','Norfolk','North Wales','North Yorkshire','Northamptonshire','Northumbria','Nottinghamshire','South Wales','South Yorkshire','Staffordshire','Suffolk','Surrey','Sussex','Thames Valley','Warwickshire','West Mercia','West Midlands','West Yorkshire','Wiltshire','Police Scotland','PSNI'].map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <div style={S.label}>INCIDENT / CRIME NUMBER</div>
              <input value={form.police_incident_number||''} onChange={e => f('police_incident_number', e.target.value)} placeholder="e.g. 4100123456" style={S.input} />
            </div>
          </div>
        )}
      </div>

      {/* Photos */}
      <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Photos (optional)</div>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
        {form.media.map((m, i) => (
          <div key={i} style={{width:56,height:56,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
            {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>video</div>}
            <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:1,right:1,width:16,height:16,background:'rgba(239,68,68,0.9)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
          </div>
        ))}
      </div>
      {form.media.length < 5 && (
        <div style={{marginBottom:'20px'}}>
          {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
          <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo</div>
          </button>
        </div>
      )}

      <button onClick={async () => {
        if (!form.sub_type) { setError('Please select vehicle type'); return; }
        if (!form.visitor_vehicle_reg?.trim()) { setError('Registration is required'); return; }
        if (!form.description.trim()) { setError('Description is required'); return; }
        setSubmitting(true); setError('');
        try {
          await api.logs.create({
            site_id: site?.id, shift_id: shift?.id || null, log_type: 'VEHICLE_CHECK',
            title: `Vehicle — ${form.sub_type} — ${form.visitor_vehicle_reg.trim()}`,
            description: form.description.trim(),
            occurred_at: new Date().toISOString(),
            type_data: {
              vehicle_type: form.sub_type,
              registration: form.visitor_vehicle_reg.trim(),
              make_model: form.visitor_name || null,
              colour: form.visitor_pass_number || null,
              location: form.location_detail || null,
              ...(form.media.length ? { media: form.media } : {}),
              ...(form.police_reported ? { police_reported: true, police_force: form.police_force, police_incident_number: form.police_incident_number } : { police_reported: false }),
            },
          });
          navigate('/', { state: { message: 'Vehicle report submitted' } });
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
      }} disabled={submitting || !form.sub_type || !form.visitor_vehicle_reg?.trim() || !form.description.trim()}
        style={S.btn(!form.sub_type || !form.visitor_vehicle_reg?.trim() || !form.description.trim() ? '#333' : '#a78bfa')}>
        {submitting ? 'SUBMITTING...' : 'SUBMIT VEHICLE REPORT'}
      </button>
    </div>
  );

  // ── CCTV PATROL: single page form, no steps ─────────────────────────────────
  if (form.log_type === 'CCTV_CHECK') return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'3px',height:'24px',background:'#3b82f6',borderRadius:'2px'}} />
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#3b82f6',letterSpacing:'0.02em'}}>CCTV PATROL</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name}</div>
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>Cancel</button>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>CAMERAS CHECKED</div>
        <input type="text" inputMode="text" value={form.cameras_checked} onChange={e=>f('cameras_checked',e.target.value)} placeholder="Number of cameras" style={S.input} />
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>ALL IN ORDER?</div>
        <div style={{display:'flex',gap:'8px'}}>
          <button type="button" onClick={() => { f('cctv_issues_found', false); f('cctv_action_taken', ''); f('cctv_issue_description', ''); }}
            style={{flex:1,padding:'16px',background:!form.cctv_issues_found?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.03)',border:`2px solid ${!form.cctv_issues_found?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',color:!form.cctv_issues_found?'#4ade80':'rgba(255,255,255,0.4)',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
            ✓ AIO — All In Order
          </button>
          <button type="button" onClick={() => f('cctv_issues_found', true)}
            style={{flex:1,padding:'16px',background:form.cctv_issues_found?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.03)',border:`2px solid ${form.cctv_issues_found?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',color:form.cctv_issues_found?'#ef4444':'rgba(255,255,255,0.4)',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
            ⚠ Issues Found
          </button>
        </div>
      </div>

      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>DESCRIPTION / NOTES</div>
        <textarea value={form.cctv_issue_description} onChange={e=>f('cctv_issue_description',e.target.value)} rows={3} placeholder="Describe any issues, observations or notes..." style={S.input} />
      </div>

      {form.cctv_issues_found && (
        <>
          <div style={{marginBottom:'14px'}}>
            <div style={S.label}>ACTIONS TAKEN</div>
            <select value={form.cctv_action_taken} onChange={e=>f('cctv_action_taken',e.target.value)} style={S.input}>
              <option value="">Select action...</option>
              <option value="Escalated to Incident Report">Escalated to Incident Report</option>
              <option value="Reported to Manager">Reported to Manager</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {form.cctv_action_taken === 'Other' && (
            <div style={{marginBottom:'14px'}}>
              <div style={S.label}>PLEASE DESCRIBE</div>
              <textarea value={form.cctv_issue_description} onChange={e=>f('cctv_issue_description',e.target.value)} rows={3} placeholder="Describe what was found..." style={S.input} />
            </div>
          )}
        </>
      )}

      {/* Photos */}
      {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>PHOTOS</div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
          {form.media.map((m, i) => (
            <div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
              {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>VIDEO</div>}
              <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:1,right:1,width:16,height:16,background:'rgba(239,68,68,0.9)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
            </div>
          ))}
          {uploadingMedia && <div style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:20,height:20,border:'2px solid rgba(255,255,255,0.1)',borderTop:'2px solid #3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite'}}/></div>}
          <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'22px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:600}}>ADD PHOTO</div>
          </button>
        </div>
      </div>

      <button onClick={async () => {
        setSubmitting(true); setError('');
        try {
          await api.logs.create({
            site_id: site?.id, shift_id: shift?.id || null, log_type: 'CCTV_CHECK',
            title: `CCTV PATROL${form.cctv_issues_found ? ' — Issues Found' : ' — AIO'}`,
            description: form.cctv_issues_found ? (form.cctv_issue_description || form.cctv_action_taken) : 'All cameras checked, all in order.',
            occurred_at: new Date().toISOString(),
            type_data: { cameras_checked: form.cameras_checked, cctv_issues_found: form.cctv_issues_found ? 'Yes' : 'No', ...(form.cctv_issues_found ? { cctv_issue_description: form.cctv_issue_description || 'None', cctv_action_taken: form.cctv_action_taken || 'None' } : {}), ...(form.media.length ? { media: form.media } : {}) },
          });
          navigate('/', { state: { message: 'CCTV patrol submitted' } });
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
      }} disabled={submitting || !form.cameras_checked}
        style={S.btn(!form.cameras_checked ? '#333' : '#1a52a8')}>
        {submitting ? 'SUBMITTING...' : 'SUBMIT CCTV PATROL'}
      </button>
    </div>
  );

  // ── VISITOR: single page form, no steps ──────────────────────────────────────
  if (form.log_type === 'VISITOR') return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'3px',height:'24px',background:'#0891b2',borderRadius:'2px'}} />
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#0891b2',letterSpacing:'0.02em'}}>VISITOR / CONTRACTOR</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name}</div>
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>Cancel</button>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      <div style={{marginBottom:'12px'}}>
        <div style={S.label}>VISITOR / COMPANY NAME *</div>
        <input type="text" value={form.visitor_name} onChange={e=>f('visitor_name',e.target.value)} placeholder="Name and company" style={S.input} />
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={S.label}>WHO VISITING / WHERE WORKING *</div>
        <input type="text" value={form.visitor_who_visiting} onChange={e=>f('visitor_who_visiting',e.target.value)} placeholder="e.g. Unit 12, John Smith - Facilities" style={S.input} />
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={S.label}>PASS NUMBER</div>
        <input type="text" value={form.visitor_pass_number} onChange={e=>f('visitor_pass_number',e.target.value)} placeholder="Badge/pass number issued" style={S.input} />
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={S.label}>VEHICLE REGISTRATION</div>
        <input type="text" value={form.visitor_vehicle_reg} onChange={e=>f('visitor_vehicle_reg',e.target.value)} placeholder="Vehicle reg if applicable" style={S.input} />
      </div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <div style={{flex:1}}>
          <div style={S.label}>PERSONNEL</div>
          <input type="number" value={form.visitor_personnel_count} onChange={e=>f('visitor_personnel_count',e.target.value)} style={S.input} min="1" />
        </div>
        <div style={{flex:1}}>
          <div style={S.label}>TIME ON SITE</div>
          <input type="time" value={form.visitor_time_in} onChange={e=>f('visitor_time_in',e.target.value)} style={S.input} />
        </div>
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={S.label}>ADDITIONAL INFO</div>
        <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={3}
          placeholder="e.g. Reason for visit, items brought on site, PPE issued, expected duration, special instructions..."
          style={S.input} />
      </div>

      {/* Photos */}
      {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
      <div style={{marginBottom:'12px'}}>
        <div style={S.label}>PHOTOS</div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
          {form.media.map((m, i) => (
            <div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
              {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>VIDEO</div>}
              <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:1,right:1,width:16,height:16,background:'rgba(239,68,68,0.9)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
            </div>
          ))}
          {uploadingMedia && <div style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:20,height:20,border:'2px solid rgba(255,255,255,0.1)',borderTop:'2px solid #3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite'}}/></div>}
          <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'22px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:600}}>ADD PHOTO</div>
          </button>
        </div>
      </div>

      <button onClick={async () => {
        if (!form.visitor_name.trim() || !form.visitor_who_visiting.trim()) { setError('Name and who visiting are required'); return; }
        setSubmitting(true); setError('');
        try {
          await api.logs.create({
            site_id: site?.id, shift_id: shift?.id || null, log_type: 'VISITOR',
            title: `VISITOR — ${form.visitor_name.trim()}`,
            description: `${form.visitor_name.trim()} visiting ${form.visitor_who_visiting.trim()}. ${form.visitor_personnel_count || 1} person(s). Time: ${form.visitor_time_in}.${form.visitor_vehicle_reg ? ' Vehicle: ' + form.visitor_vehicle_reg : ''}${form.visitor_pass_number ? ' Pass: ' + form.visitor_pass_number : ''}${form.description.trim() ? '\n' + form.description.trim() : ''}`,
            occurred_at: new Date().toISOString(),
            type_data: { visitor_name: form.visitor_name, visitor_who_visiting: form.visitor_who_visiting, visitor_pass_number: form.visitor_pass_number, visitor_vehicle_reg: form.visitor_vehicle_reg, visitor_personnel_count: form.visitor_personnel_count, visitor_time_in: form.visitor_time_in, ...(form.media.length ? { media: form.media } : {}) },
          });
          // Also create visitor record for on-site tracking
          try {
            await api.visitors.create({
              site_id: site?.id, shift_id: shift?.id || null,
              visitor_name: form.visitor_name.trim(), company_name: form.visitor_who_visiting.trim(),
              who_visiting: form.visitor_who_visiting.trim(), pass_number: form.visitor_pass_number || null,
              vehicle_reg: form.visitor_vehicle_reg || null, personnel_count: form.visitor_personnel_count || 1,
            });
          } catch {}
          navigate('/', { state: { message: 'Visitor logged' } });
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
      }} disabled={submitting || !form.visitor_name.trim() || !form.visitor_who_visiting.trim()}
        style={S.btn((!form.visitor_name.trim() || !form.visitor_who_visiting.trim()) ? '#333' : '#1a52a8')}>
        {submitting ? 'SUBMITTING...' : 'LOG VISITOR'}
      </button>
    </div>
  );

  // ── LOG OCCURRENCE (GENERAL): Incident form ────────────────────────────────
  if (form.log_type === 'GENERAL') {
    const INCIDENT_TYPES = ['Theft','Fight/Assault','Trespass','Criminal Damage','Suspicious Person','Drug-Related','Verbal Abuse','Hostile Recon','Fire','Fly Tipping','Alarm','Other'];

    return (
      <div style={{padding:'1rem 1rem 5rem'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'3px',height:'24px',background:'#ef4444',borderRadius:'2px'}} />
            <div>
              <div style={{fontSize:'14px',fontWeight:700,color:'#ef4444',letterSpacing:'0.02em'}}>INCIDENT</div>
              <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name}</div>
            </div>
          </div>
          <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>Cancel</button>
        </div>

        {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

        {/* Incident type */}
        <div style={{marginBottom:'14px'}}>
          <div style={S.label}>INCIDENT TYPE *</div>
          <select value={form.actions_taken || ''} onChange={e => f('actions_taken', e.target.value)} style={S.input}>
            <option value="">Select type...</option>
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Time of incident */}
        {form.actions_taken && (
          <div style={{marginBottom:'14px'}}>
            <div style={S.label}>TIME OF INCIDENT</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <input type="date" value={form.incident_date || new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})} onChange={e => f('incident_date', e.target.value)} style={S.input} />
              <input type="time" value={form.incident_time || ''} onChange={e => f('incident_time', e.target.value)} style={S.input} placeholder="HH:MM" />
            </div>
          </div>
        )}

        {/* Description */}
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Description *</div>
        <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={3} placeholder="Describe what you found..."
          style={S.input} />

        {/* Police */}
        {form.actions_taken && (
          <div style={{marginBottom:'14px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px'}}>
            <div style={S.label}>REPORTED TO POLICE?</div>
            <div style={{display:'flex',gap:'8px',marginBottom: form.police_reported ? '12px' : '0'}}>
              <button type="button" onClick={() => f('police_reported', true)}
                style={{flex:1,padding:'12px',background:form.police_reported?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'13px',fontWeight:700,color:form.police_reported?'#60a5fa':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
                {form.police_reported?'✓ ':''}Yes
              </button>
              <button type="button" onClick={() => { f('police_reported', false); f('police_force',''); f('police_incident_number',''); }}
                style={{flex:1,padding:'12px',background:form.police_reported===false?'rgba(239,68,68,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported===false?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'13px',fontWeight:700,color:form.police_reported===false?'#ef4444':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
                {form.police_reported===false?'✗ ':''}No
              </button>
            </div>
            {form.police_reported && (
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <div>
                  <div style={S.label}>POLICE FORCE</div>
                  <select value={form.police_force||''} onChange={e => f('police_force', e.target.value)} style={S.input}>
                    <option value="">Select force...</option>
                    {['Avon and Somerset','Bedfordshire','Cambridgeshire','Cheshire','City of London','Cleveland','Cumbria','Derbyshire','Devon and Cornwall','Dorset','Durham','Dyfed-Powys','Essex','Gloucestershire','Greater Manchester','Gwent','Hampshire','Hertfordshire','Humberside','Kent','Lancashire','Leicestershire','Lincolnshire','Merseyside','Metropolitan Police','Norfolk','North Wales','North Yorkshire','Northamptonshire','Northumbria','Nottinghamshire','South Wales','South Yorkshire','Staffordshire','Suffolk','Surrey','Sussex','Thames Valley','Warwickshire','West Mercia','West Midlands','West Yorkshire','Wiltshire','Police Scotland','PSNI'].map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <div style={S.label}>INCIDENT / CRIME NUMBER</div>
                  <input value={form.police_incident_number||''} onChange={e => f('police_incident_number', e.target.value)} placeholder="e.g. 4100123456" style={S.input} />
                </div>
                <div>
                  <div style={S.label}>REPORTED VIA</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button type="button" onClick={() => f('police_reported_via','999')}
                      style={{flex:1,padding:'10px',background:form.police_reported_via==='999'?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported_via==='999'?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'13px',fontWeight:700,color:form.police_reported_via==='999'?'#ef4444':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
                      999
                    </button>
                    <button type="button" onClick={() => f('police_reported_via','101')}
                      style={{flex:1,padding:'10px',background:form.police_reported_via==='101'?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported_via==='101'?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'13px',fontWeight:700,color:form.police_reported_via==='101'?'#60a5fa':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
                      101
                    </button>
                  </div>
                </div>

                {/* Emergency services attended */}
                <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:'10px',marginTop:'4px'}}>
                  <div style={S.label}>EMERGENCY SERVICES ATTENDED?</div>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'8px'}}>
                    {['Police','Fire','Ambulance'].map(svc => (
                      <button key={svc} type="button" onClick={() => {
                        const current = form.services_attended || [];
                        f('services_attended', current.includes(svc) ? current.filter(s => s !== svc) : [...current, svc]);
                      }} style={{padding:'8px 14px',background:(form.services_attended||[]).includes(svc)?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.03)',border:`1.5px solid ${(form.services_attended||[]).includes(svc)?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'6px',fontSize:'12px',fontWeight:700,color:(form.services_attended||[]).includes(svc)?'#60a5fa':'rgba(255,255,255,0.45)',cursor:'pointer'}}>
                        {(form.services_attended||[]).includes(svc)?'✓ ':''}{svc}
                      </button>
                    ))}
                  </div>
                </div>

                {(form.services_attended||[]).length > 0 && (
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div>
                        <div style={S.label}>TIME ON SITE</div>
                        <input type="time" value={form.services_time_on||''} onChange={e => f('services_time_on', e.target.value)} style={S.input} />
                      </div>
                      <div>
                        <div style={S.label}>TIME OFF SITE</div>
                        <input type="time" value={form.services_time_off||''} onChange={e => f('services_time_off', e.target.value)} style={S.input} />
                      </div>
                    </div>
                    <div>
                      <div style={S.label}>OFFICER NAME(S) & SHOULDER NUMBER(S)</div>
                      <input value={form.police_officer_name||''} onChange={e => f('police_officer_name', e.target.value)} placeholder="e.g. PC Smith 1234, PC Jones 5678" style={S.input} />
                    </div>
                    <div>
                      <div style={S.label}>ACTIONS TAKEN BY EMERGENCY SERVICES</div>
                      <textarea value={form.services_actions||''} onChange={e => f('services_actions', e.target.value)} rows={2} placeholder="e.g. Suspect arrested, area cordoned off..." style={{...S.input, resize:'none'}} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div style={{margin:'14px 0',padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)'}}>
            {form.latitude ? `GPS: ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : 'GPS: acquiring...'}
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.2)',marginTop:'2px'}}>///what3words</div>
        </div>

        {/* Photos */}
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Photos / Video (optional) — max 5</div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
          {form.media.map((m, i) => (
            <div key={i} style={{width:56,height:56,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
              {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>video</div>}
              <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:1,right:1,width:16,height:16,background:'rgba(239,68,68,0.9)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
            </div>
          ))}
        </div>
        {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
        {form.media.length < 5 && (
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px'}}>
            <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
              <div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
              <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo/Video</div>
            </button>
          </div>
        )}

        {/* Submit */}
        <button onClick={async () => {
          if (!form.actions_taken) { setError('Please select incident type'); return; }
          if (!form.description.trim()) { setError('Description is required'); return; }
          setSubmitting(true); setError('');
          try {
            const logType = 'INCIDENT';
            const title = `Incident — ${form.actions_taken}`;
            await api.logs.create({
              site_id: site?.id, shift_id: shift?.id || null, log_type: logType,
              title,
              description: form.description,
              occurred_at: new Date().toISOString(),
              latitude: form.latitude, longitude: form.longitude,
              type_data: { category: 'Incident', incident_type: form.actions_taken, incident_date: form.incident_date || null, incident_time: form.incident_time || null, ...(form.media.length ? { media: form.media } : {}), ...(form.police_reported ? { police_reported: true, police_force: form.police_force, police_incident_number: form.police_incident_number, police_reported_via: form.police_reported_via, services_attended: form.services_attended, services_time_on: form.services_time_on, services_time_off: form.services_time_off, police_officer_name: form.police_officer_name, services_actions: form.services_actions } : { police_reported: false }) },
            });
            navigate('/', { state: { message: 'Occurrence logged' } });
          } catch (e) { setError(e.message); }
          finally { setSubmitting(false); }
        }} disabled={submitting || !form.description.trim() || !form.actions_taken}
          style={S.btn(!form.description.trim() || !form.actions_taken ? '#333' : '#1a52a8')}>
          {submitting ? 'LOGGING...' : 'LOG OCCURRENCE'}
        </button>
      </div>
    );
  }

  // ── STEP 1: Select type ─────────────────────────────────────────────────────
  if (step === 1) return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div>
          <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>New Log Entry</div>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'2px'}}>Step 1 — Select type</div>
        </div>
        <StepDots step={1} />
      </div>

      <div style={{fontSize:'9px',fontWeight:700,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:'8px'}}>HIGH PRIORITY</div>
      <div style={{display:'flex',flexDirection:'column',gap:'7px',marginBottom:'14px'}}>
        {HIGH_PRIORITY.map(t => (
          <button key={t.key} onClick={() => { f('log_type', t.key); setStep(2); }}
            style={{width:'100%',padding:'14px 16px',background:t.bg,border:`2px solid ${t.border}`,borderRadius:'10px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:'15px',fontWeight:700,color:t.color,letterSpacing:'0.02em'}}>{t.label}</div>
              <div style={{fontSize:'11px',color:t.color,opacity:0.6,marginTop:'2px'}}>{t.sub}</div>
            </div>
            <div style={{width:'4px',height:'30px',background:t.border,borderRadius:'2px'}} />
          </button>
        ))}
      </div>

      <div style={{fontSize:'9px',fontWeight:700,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:'8px'}}>ROUTINE</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'7px'}}>
        {ROUTINE.map(t => (
          <button key={t.key} onClick={() => { f('log_type', t.key); setStep(2); }}
            style={{padding:'13px 12px',background:'rgba(255,255,255,0.04)',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',cursor:'pointer',textAlign:'left'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'rgba(255,255,255,0.75)',letterSpacing:'0.02em'}}>{t.label}</div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'2px'}}>{t.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── STEP 2: Details ─────────────────────────────────────────────────────────
  if (step === 2) return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'3px',height:'24px',background:type?.color||'#3b82f6',borderRadius:'2px'}} />
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:type?.color||'#fff',letterSpacing:'0.02em'}}>{type?.label}</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>Step 2 — Details</div>
          </div>
        </div>
        <StepDots step={2} />
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      {/* Sub-type pills */}
      {SUB_TYPES[form.log_type] && (
        <div style={{marginBottom:'14px'}}>
          <div style={S.label}>TYPE</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {SUB_TYPES[form.log_type].map(s => (
              <button key={s} onClick={() => f('sub_type', form.sub_type===s?'':s)} style={S.pill(form.sub_type===s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Date/time */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>DATE & TIME</div>
        <input type="datetime-local" value={form.occurred_at} onChange={e=>f('occurred_at',e.target.value)} style={S.input} />
      </div>

      {/* Description */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>WHAT HAPPENED</div>
        <textarea value={narrative || form.description} onChange={e => { if (narrative) setNarrative(e.target.value); else f('description', e.target.value); }} rows={4}
          placeholder="Describe what you saw or what occurred. Include the sequence of events in the order they happened."
          style={{...S.input, ...(narrative ? {border:'1.5px solid rgba(139,92,246,0.3)', background:'rgba(139,92,246,0.05)'} : {})}} />
        {form.description.trim() && (
          <button type="button" onClick={generateNarrative} disabled={generatingAI}
            style={{marginTop:'8px',width:'100%',padding:'12px',background:generatingAI?'rgba(139,92,246,0.08)':'rgba(139,92,246,0.12)',border:'1.5px solid rgba(139,92,246,0.4)',borderRadius:'8px',color:'#a78bfa',fontSize:'13px',fontWeight:700,cursor:generatingAI?'default':'pointer',letterSpacing:'0.03em'}}>
            {generatingAI ? '⏳ Writing report...' : '✦ Write with AI'}
          </button>
        )}
        {narrative && <div style={{fontSize:'10px',color:'rgba(139,92,246,0.6)',marginTop:'4px'}}>AI-generated — edit above before submitting</div>}
      </div>

      {/* Location on site */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>LOCATION ON SITE</div>
        <input value={form.location_detail} onChange={e=>f('location_detail',e.target.value)}
          placeholder="e.g. Main car park, rear fire exit, loading bay, reception area"
          style={S.input} />
      </div>

      {/* Description of persons */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>DESCRIPTION OF PERSON(S) INVOLVED</div>
        <textarea value={form.people_involved} onChange={e=>f('people_involved',e.target.value)} rows={3}
          placeholder="Gender, approx age, height, build, hair colour, clothing (top to bottom), distinguishing features, accent, direction of travel"
          style={S.input} />
      </div>

      {/* Actions taken */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>ACTIONS TAKEN</div>
        <textarea value={form.actions_taken} onChange={e=>f('actions_taken',e.target.value)} rows={2}
          placeholder="e.g. Challenged individual, asked to leave, escorted from site, CCTV reviewed, police called, area secured"
          style={S.input} />
      </div>

      {/* WELFARE_CHECK extra fields */}
      {form.log_type === 'WELFARE_CHECK' && (
        <div style={{marginBottom:'14px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={S.label}>WELFARE CHECK DETAILS</div>
          <input value={form.welfare_officer_name} onChange={e=>f('welfare_officer_name',e.target.value)} placeholder="Officer name checked" style={S.input} />
          <select value={form.welfare_outcome} onChange={e=>f('welfare_outcome',e.target.value)} style={S.input}>
            <option value="">Select outcome...</option>
            <option value="All well">All well</option>
            <option value="Concerns raised">Concerns raised</option>
            <option value="No response">No response</option>
          </select>
          <textarea value={form.welfare_notes} onChange={e=>f('welfare_notes',e.target.value)} rows={2} placeholder="Notes" style={S.input} />
        </div>
      )}

      {/* MANAGEMENT_VISIT extra fields */}
      {form.log_type === 'MANAGEMENT_VISIT' && (
        <div style={{marginBottom:'14px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={S.label}>MANAGEMENT VISIT DETAILS</div>
          <input value={form.manager_name} onChange={e=>f('manager_name',e.target.value)} placeholder="Manager name" style={S.input} />
          <input value={form.visit_purpose} onChange={e=>f('visit_purpose',e.target.value)} placeholder="Purpose of visit" style={S.input} />
          <input type="number" value={form.visit_duration} onChange={e=>f('visit_duration',e.target.value)} placeholder="Duration (minutes)" style={S.input} min="1" />
        </div>
      )}

      {/* Police - only for serious types */}
      {['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(form.log_type) && (
        <div style={{marginBottom:'14px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px'}}>
          <div style={S.label}>POLICE</div>
          <div style={{display:'flex',gap:'7px',marginBottom:form.police_reported||form.police_attended?'12px':'0'}}>
            <button type="button" onClick={() => f('police_reported',!form.police_reported)}
              style={{flex:1,padding:'11px 8px',background:form.police_reported?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_reported?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'11px',fontWeight:700,color:form.police_reported?'#60a5fa':'rgba(255,255,255,0.45)',cursor:'pointer',letterSpacing:'0.04em'}}>
              {form.police_reported?'✓ ':''}POLICE REPORTED
            </button>
            <button type="button" onClick={() => f('police_attended',!form.police_attended)}
              style={{flex:1,padding:'11px 8px',background:form.police_attended?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.police_attended?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'11px',fontWeight:700,color:form.police_attended?'#60a5fa':'rgba(255,255,255,0.45)',cursor:'pointer',letterSpacing:'0.04em'}}>
              {form.police_attended?'✓ ':''}POLICE ATTENDED
            </button>
          </div>
          {form.police_reported && (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              <input value={form.police_incident_number} onChange={e=>f('police_incident_number',e.target.value)}
                placeholder="Crime / Incident reference number" style={S.input} />
              <select value={form.police_force} onChange={e=>f('police_force',e.target.value)} style={S.input}>
                <option value="">Select police force...</option>
                {['Avon and Somerset','Bedfordshire','Cambridgeshire','Cheshire','City of London','Cleveland','Cumbria','Derbyshire','Devon and Cornwall','Dorset','Durham','Dyfed-Powys','Essex','Gloucestershire','Greater Manchester','Gwent','Hampshire','Hertfordshire','Humberside','Kent','Lancashire','Leicestershire','Lincolnshire','Merseyside','Metropolitan Police','Norfolk','North Wales','North Yorkshire','Northamptonshire','Northumbria','Nottinghamshire','South Wales','South Yorkshire','Staffordshire','Suffolk','Surrey','Sussex','Thames Valley','Warwickshire','West Mercia','West Midlands','West Yorkshire','Wiltshire'].map(force=>(<option key={force} value={force}>{force}</option>))}
              </select>
            </div>
          )}
          {form.police_attended && (
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:form.police_reported?'8px':'0'}}>
              <input value={form.police_officer_name} onChange={e=>f('police_officer_name',e.target.value)} placeholder="Attending officer name e.g. PC Smith" style={S.input} />
              <input value={form.police_shoulder_number} onChange={e=>f('police_shoulder_number',e.target.value)} placeholder="Shoulder / collar number" style={S.input} />
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      {createPortal(<input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={uploadMedia} />, document.body)}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>PHOTOS / VIDEO</div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
          {form.media.map((m,i) => (
            <div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
              {m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>VIDEO</div>}
              <button onClick={() => f('media', form.media.filter((_,j)=>j!==i))} style={{position:'absolute',top:2,right:2,width:16,height:16,background:'rgba(220,38,38,0.85)',borderRadius:'50%',border:'none',color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
            </div>
          ))}
          {uploadingMedia && <div style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:20,height:20,border:'2px solid rgba(255,255,255,0.1)',borderTop:'2px solid #3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite'}}/></div>}
          <button type="button" onClick={() => mediaInputRef.current?.click()} style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'22px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:600,letterSpacing:'0.05em'}}>ADD PHOTO</div>
          </button>
        </div>
      </div>

      {/* GPS */}
      <div style={{marginBottom:'14px'}}>
        <button type="button" onClick={getGPS} disabled={gpsLoading}
          style={{width:'100%',padding:'11px',background:form.latitude?'rgba(74,222,128,0.08)':'rgba(255,255,255,0.03)',border:`1px solid ${form.latitude?'rgba(74,222,128,0.25)':'rgba(255,255,255,0.08)'}`,borderRadius:'8px',color:form.latitude?'#4ade80':'rgba(255,255,255,0.4)',fontSize:'12px',fontWeight:700,cursor:'pointer',letterSpacing:'0.05em',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
          <MapPinIcon style={{width:'14px',height:'14px'}} />
          {gpsLoading?'GETTING LOCATION...':form.latitude?'✓ LOCATION CAPTURED':'CAPTURE LOCATION'}
        </button>
      </div>

      <button onClick={() => setStep(3)} style={S.btn()}>NEXT STEP →</button>
      <div style={{height:'8px'}}/>
      <button onClick={() => setStep(1)} style={S.ghost}>← BACK</button>
    </div>
  );

  // ── STEP 3: Review & AI report ──────────────────────────────────────────────
  return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div>
          <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Review & Submit</div>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'2px'}}>Step 3 — Generate report</div>
        </div>
        <StepDots step={3} />
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

      {/* Summary card */}
      <div style={{background:type?.bg||'rgba(59,130,246,0.08)',border:`1.5px solid ${type?.border||'rgba(59,130,246,0.2)'}`,borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
          <div style={{width:'3px',height:'32px',background:type?.color||'#3b82f6',borderRadius:'2px',flexShrink:0}} />
          <div>
            <div style={{fontSize:'13px',fontWeight:700,color:type?.color||'#fff',letterSpacing:'0.03em'}}>{type?.label}{form.sub_type ? ` — ${form.sub_type}` : ''}</div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name} · {new Date(form.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} today</div>
          </div>
        </div>
        <div style={{paddingLeft:'11px',fontSize:'12px',color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>{form.description}</div>
      </div>

      {/* Status row */}
      <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
        <div style={{flex:1,padding:'9px',background:form.latitude?'rgba(74,222,128,0.07)':'rgba(255,255,255,0.03)',border:`1px solid ${form.latitude?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.07)'}`,borderRadius:'8px',textAlign:'center'}}>
          <div style={{fontSize:'9px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Location</div>
          <div style={{fontSize:'11px',color:form.latitude?'rgba(74,222,128,0.8)':'rgba(255,255,255,0.25)',fontWeight:600,marginTop:'2px'}}>{form.latitude?'Captured':'None'}</div>
        </div>
        <div style={{flex:1,padding:'9px',background:form.media.length?'rgba(59,130,246,0.07)':'rgba(255,255,255,0.03)',border:`1px solid ${form.media.length?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.07)'}`,borderRadius:'8px',textAlign:'center'}}>
          <div style={{fontSize:'9px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Photos</div>
          <div style={{fontSize:'11px',color:form.media.length?'rgba(59,130,246,0.8)':'rgba(255,255,255,0.25)',fontWeight:600,marginTop:'2px'}}>{form.media.length||'None'}</div>
        </div>
        {(form.police_reported||form.police_attended) && (
          <div style={{flex:1,padding:'9px',background:'rgba(59,130,246,0.07)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'9px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Police</div>
            <div style={{fontSize:'11px',color:'rgba(59,130,246,0.8)',fontWeight:600,marginTop:'2px'}}>{form.police_reported?'Reported':'Attended'}</div>
          </div>
        )}
      </div>

      {/* AI Report generation */}
      <div style={{marginBottom:'14px',padding:'14px',background:'rgba(99,102,241,0.07)',border:'1.5px solid rgba(99,102,241,0.2)',borderRadius:'10px'}}>
        <div style={{fontSize:'9px',fontWeight:700,color:'rgba(99,102,241,0.7)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'8px'}}>AI REPORT WRITER</div>
        {!narrative ? (
          <>
            <div style={{fontSize:'12px',color:'rgba(255,255,255,0.45)',marginBottom:'10px',lineHeight:1.5}}>
              Turn your notes into a professional, client-ready incident report automatically.
            </div>
            <button onClick={generateNarrative} disabled={generatingAI||!form.description.trim()}
              style={{width:'100%',padding:'13px',background:generatingAI?'rgba(99,102,241,0.1)':'rgba(99,102,241,0.2)',border:'1.5px solid rgba(99,102,241,0.4)',borderRadius:'8px',color:'#a5b4fc',fontSize:'13px',fontWeight:700,cursor:'pointer',letterSpacing:'0.03em'}}>
              {generatingAI ? '⏳ GENERATING REPORT...' : '✦ GENERATE PROFESSIONAL REPORT'}
            </button>
          </>
        ) : (
          <>
            <div style={{fontSize:'9px',fontWeight:700,color:'rgba(99,102,241,0.6)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'6px'}}>AI-GENERATED NARRATIVE — review and edit</div>
            <textarea value={narrative} onChange={e=>setNarrative(e.target.value)} rows={5}
              style={{...S.input, border:'1.5px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.05)', marginBottom:'8px'}} />
            <button onClick={generateNarrative} disabled={generatingAI}
              style={{width:'100%',padding:'9px',background:'transparent',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'6px',color:'rgba(99,102,241,0.6)',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>
              ↻ REGENERATE
            </button>
          </>
        )}
      </div>

      {/* Client reportable */}
      <div onClick={() => f('client_reportable',!form.client_reportable)}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:form.client_reportable?'rgba(59,130,246,0.07)':'rgba(255,255,255,0.03)',border:`1.5px solid ${form.client_reportable?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.08)'}`,borderRadius:'10px',cursor:'pointer',marginBottom:'14px'}}>
        <div>
          <div style={{fontSize:'12px',fontWeight:700,color:'#fff',letterSpacing:'0.02em'}}>REPORT TO CLIENT</div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>{form.client_reportable?'Visible in client portal + ops manager':'Ops manager only'}</div>
        </div>
        <div style={S.toggle(form.client_reportable)}><div style={S.toggleDot(form.client_reportable)}/></div>
      </div>

      <button onClick={submit} disabled={submitting || uploadingMedia}
        style={S.btn(type?.key==='INCIDENT'||type?.key==='EMERGENCY'?'#ef4444':type?.key==='ALARM'||type?.key==='FIRE_ALARM'?'#d97706':'#1a52a8')}>
        {uploadingMedia ? 'UPLOADING PHOTO...' : submitting ? 'SUBMITTING...' : `SUBMIT ${type?.label || ''} REPORT`}
      </button>
      <div style={{height:'8px'}}/>
      <button onClick={() => setStep(2)} style={S.ghost}>← BACK</button>
    </div>
  );
}

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
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <div style={{marginBottom:'1rem'}}>
        <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.125rem'}}>Log History</h2>
        <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)'}}>{site.name}</p>
      </div>

      {/* Filters */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'1rem'}}>
        <select className="officer-input" value={filters.log_type} onChange={e => handleFilterChange('log_type', e.target.value)} style={{gridColumn:'1/-1'}}>
          <option value="">All Types</option>
          {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => (
            <option key={type} value={type}>{config.label}</option>
          ))}
        </select>
        <input type="date" className="officer-input" value={filters.from} onChange={e => handleFilterChange('from', e.target.value)} />
        <input type="date" className="officer-input" value={filters.to} onChange={e => handleFilterChange('to', e.target.value)} />
      </div>

      {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}

      <div>
        {loading && logs.length === 0 ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
        ) : logs.length === 0 ? (
          <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)'}}>
            <ClipboardDocumentListIcon style={{width:'2.5rem',height:'2.5rem',margin:'0 auto 0.75rem'}} />
            <p style={{fontSize:'0.875rem'}}>{filters.log_type || filters.from || filters.to ? 'No logs match filters' : 'No logs yet'}</p>
          </div>
        ) : (
          <>
            {logs.map(log => <LogHistoryCard key={log.id} log={log} />)}
            {hasMore && (
              <button onClick={loadMore} disabled={loading} style={{width:'100%',padding:'0.875rem',background:'#1a2235',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'rgba(255,255,255,0.6)',fontSize:'0.875rem',fontWeight:500,cursor:'pointer',marginTop:'0.5rem'}}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LogHistoryCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  const typeMap = {
    PATROL:'PAT',INCIDENT:'INC',ALARM:'ALM',ACCESS:'ACC',VISITOR:'VIS',
    HANDOVER:'HND',MAINTENANCE:'MNT',VEHICLE:'VEH',KEYHOLDING:'KEY',GENERAL:'GEN',
    SHIFT_START:'ON',SHIFT_END:'OFF',BREAK:'BRK',TRAINING:'TRN',
    EMERGENCY:'SOS',FIRE_ALARM:'FIR',EVACUATION:'EVC',ADMIN:'ADM',OTHER:'OTH',
    VEHICLE_CHECK:'VEH',HEALTH_SAFETY:'H&S',CCTV_CHECK:'CCTV',
  };
  const code = typeMap[log.log_type] || log.log_type?.slice(0,3) || 'LOG';
  const isIncident = ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY','VEHICLE_CHECK','HEALTH_SAFETY'].includes(log.log_type);

  async function loadComments() {
    if (commentsLoaded) return;
    try {
      const res = await api.logs.comments(log.id);
      setComments(res.data || []);
    } catch {}
    setCommentsLoaded(true);
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.logs.addComment(log.id, newComment.trim());
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch {}
    setSubmitting(false);
  }

  return (
    <div
      onClick={() => { if (!expanded) { setExpanded(true); if (isIncident) loadComments(); } }}
      className="officer-log-item"
      style={{cursor:'pointer',flexDirection:'column',gap:0}}
    >
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem',width:'100%'}} onClick={expanded ? () => setExpanded(false) : undefined}>
        <div className="officer-log-type">{code}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="officer-log-title">{log.title || config.label}</div>
          <div className="officer-log-meta">
            {new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
          </div>
        </div>
        <div style={{color:'rgba(255,255,255,0.3)',fontSize:'0.75rem',flexShrink:0,marginTop:'2px'}}>{expanded ? '▲' : '▼'}</div>
      </div>
      {expanded && (
        <div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid rgba(255,255,255,0.08)',width:'100%'}} onClick={e => e.stopPropagation()}>
          {log.description && <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.7)',marginBottom:'0.5rem',lineHeight:1.5}}>{log.description}</p>}
          {log.type_data && Object.keys(log.type_data).length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:'0.25rem',marginBottom:'0.5rem'}}>
              {Object.entries(log.type_data).filter(([key, value]) => value && typeof value !== 'object' && key !== 'ai_generated' && key !== 'shift_event').map(([key, value]) => (
                <div key={key} style={{display:'flex',gap:'0.5rem',fontSize:'0.8125rem'}}>
                  <span style={{color:'rgba(255,255,255,0.35)',textTransform:'capitalize',minWidth:'6rem'}}>{key.replace(/_/g,' ')}:</span>
                  <span style={{color:'rgba(255,255,255,0.7)'}}>{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Follow-up updates for incidents */}
          {isIncident && (
            <div style={{marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.375rem'}}>Updates</div>
              {comments.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:'0.375rem',marginBottom:'0.5rem'}}>
                  {comments.map(c => (
                    <div key={c.id} style={{padding:'0.375rem 0.5rem',background:'rgba(255,255,255,0.03)',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.06)'}}>
                      <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.6)',lineHeight:1.4}}>{c.comment}</div>
                      <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.25)',marginTop:'2px'}}>{c.user ? `${c.user.first_name} ${c.user.last_name}` : ''} · {new Date(c.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</div>
                    </div>
                  ))}
                </div>
              )}
              {!commentsLoaded && <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.3)',marginBottom:'0.375rem'}}>Loading...</div>}
              <div style={{display:'flex',gap:'0.375rem'}}>
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add follow-up update..."
                  style={{flex:1,padding:'0.5rem 0.625rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',color:'#fff',fontSize:'0.8125rem',outline:'none'}}
                  onKeyDown={e => e.key === 'Enter' && submitComment()}
                />
                <button onClick={submitComment} disabled={submitting || !newComment.trim()}
                  style={{padding:'0.5rem 0.75rem',background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'6px',color:'#60a5fa',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',opacity:(!newComment.trim()||submitting)?0.4:1}}>
                  {submitting ? '...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { LogEntryScreen, LogHistoryScreen };
