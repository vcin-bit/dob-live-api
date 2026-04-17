import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { MapPinIcon } from '@heroicons/react/24/outline';

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
  { key:'VISITOR',       label:'VISITOR',      sub:'Signin · Log' },
  { key:'HANDOVER',      label:'HANDOVER',     sub:'Shift handover' },
  { key:'GENERAL',       label:'GENERAL',      sub:'Observation · Note' },
  { key:'OTHER',         label:'OTHER',        sub:'Anything else' },
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
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    log_type: '', sub_type: '', description: '', location_detail: '', people_involved: '', actions_taken: '',
    occurred_at: new Date().toISOString().slice(0,16),
    latitude: null, longitude: null,
    police_reported: false, police_attended: false,
    police_incident_number: '', police_force: '', police_officer_name: '', police_shoulder_number: '',
    client_reportable: false, media: [],
  });
  const [narrative, setNarrative] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  async function uploadMedia(files) {
    setUploadingMedia(true);
    const token = window.Clerk?.session ? await window.Clerk.session.getToken() : '';
    const uploads = [];
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
      try {
        const r = await fetch(`${API}/api/patrols/media/upload`, { method:'POST', body:fd, headers:{ Authorization:`Bearer ${token}` } });
        const d = await r.json();
        if (d.url) uploads.push({ url:d.url, name:file.name, type:file.type });
      } catch {}
    }
    f('media', [...form.media, ...uploads]);
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
        },
      });
      navigate('/', { state: { message: 'Log entry submitted', logId: res.data?.id } });
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
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
        <div style={S.label}>WHAT HAPPENED — describe in your own words</div>
        <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={4}
          placeholder="e.g. Saw a man trying car door handles in the car park..."
          style={S.input} />
      </div>

      {/* Location on site */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>LOCATION ON SITE</div>
        <input value={form.location_detail} onChange={e=>f('location_detail',e.target.value)}
          placeholder="e.g. Car park north, Unit 3 rear door..."
          style={S.input} />
      </div>

      {/* People involved */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>PERSONS INVOLVED (if any)</div>
        <input value={form.people_involved} onChange={e=>f('people_involved',e.target.value)}
          placeholder="e.g. Male, 30s, dark jacket, blue jeans..."
          style={S.input} />
      </div>

      {/* Actions taken */}
      <div style={{marginBottom:'14px'}}>
        <div style={S.label}>ACTIONS TAKEN</div>
        <input value={form.actions_taken} onChange={e=>f('actions_taken',e.target.value)}
          placeholder="e.g. Challenged, asked to leave, CCTV reviewed..."
          style={S.input} />
      </div>

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
                {['Avon and Somerset','Bedfordshire','Cambridgeshire','Cheshire','City of London','Cleveland','Cumbria','Derbyshire','Devon and Cornwall','Dorset','Durham','Dyfed-Powys','Essex','Gloucestershire','Greater Manchester','Gwent','Hampshire','Hertfordshire','Humberside','Kent','Lancashire','Leicestershire','Lincolnshire','Merseyside','Metropolitan Police','Norfolk','North Wales','North Yorkshire','Northamptonshire','Northumbria','Nottinghamshire','South Wales','South Yorkshire','Staffordshire','Suffolk','Surrey','Sussex','Thames Valley','Warwickshire','West Mercia','West Midlands','West Yorkshire','Wiltshire'].map(f2=>(<option key={f2} value={f2}>{f2}</option>))}
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
          <label style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
            <div style={{fontSize:'22px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
            <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:600,letterSpacing:'0.05em'}}>ADD PHOTO</div>
            <input type="file" accept="image/*,video/*" multiple capture="environment" style={{display:'none'}} onChange={e=>uploadMedia(e.target.files)} />
          </label>
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
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>{site?.name} · {new Date(form.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} today</div>
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

      <button onClick={submit} disabled={submitting}
        style={S.btn(type?.key==='INCIDENT'||type?.key==='EMERGENCY'?'#ef4444':type?.key==='ALARM'||type?.key==='FIRE_ALARM'?'#d97706':'#1a52a8')}>
        {submitting ? 'SUBMITTING...' : `SUBMIT ${type?.label || ''} REPORT`}
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
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  const typeMap = {
    PATROL:'PAT',INCIDENT:'INC',ALARM:'ALM',ACCESS:'ACC',VISITOR:'VIS',
    HANDOVER:'HND',MAINTENANCE:'MNT',VEHICLE:'VEH',KEYHOLDING:'KEY',GENERAL:'GEN',
    SHIFT_START:'ON',SHIFT_END:'OFF',BREAK:'BRK',TRAINING:'TRN',
    EMERGENCY:'SOS',FIRE_ALARM:'FIR',EVACUATION:'EVC',ADMIN:'ADM',OTHER:'OTH',
  };
  const code = typeMap[log.log_type] || log.log_type?.slice(0,3) || 'LOG';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="officer-log-item"
      style={{cursor:'pointer',flexDirection:'column',gap:0}}
    >
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem',width:'100%'}}>
        <div className="officer-log-type">{code}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="officer-log-title">{log.title || config.label}</div>
          <div className="officer-log-meta">
            {new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
        <div style={{color:'rgba(255,255,255,0.3)',fontSize:'0.75rem',flexShrink:0,marginTop:'2px'}}>{expanded ? '▲' : '▼'}</div>
      </div>
      {expanded && (
        <div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid rgba(255,255,255,0.08)',width:'100%'}}>
          {log.description && <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.7)',marginBottom:'0.5rem',lineHeight:1.5}}>{log.description}</p>}
          {log.type_data && Object.keys(log.type_data).length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:'0.25rem'}}>
              {Object.entries(log.type_data).map(([key, value]) => value ? (
                <div key={key} style={{display:'flex',gap:'0.5rem',fontSize:'0.8125rem'}}>
                  <span style={{color:'rgba(255,255,255,0.35)',textTransform:'capitalize',minWidth:'6rem'}}>{key.replace(/_/g,' ')}:</span>
                  <span style={{color:'rgba(255,255,255,0.7)'}}>{String(value)}</span>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { LogEntryScreen, LogHistoryScreen };
