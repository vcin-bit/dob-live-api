import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

function HandoverScreen({ user, site, shift, onShiftEnded }) {
  const navigate = useNavigate();
  const [officers, setOfficers] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    handed_to: '',
    site_status: 'ALL_SECURE',
    keys_handed_over: true,
    radio_handed_over: true,
    outstanding_issues: '',
    content: '',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      api.users.list(),
      site?.id ? api.logs.list({ site_id: site.id, shift_id: shift?.id, limit: 100 }) : Promise.resolve({ data: [] }),
    ]).then(([ur, lr]) => {
      setOfficers((ur.data || []).filter(u => u.id !== user.id && u.role === 'OFFICER'));
      setRecentLogs((lr.data || []).filter(l => !l.type_data?.checkpoint));
    });
  }, [site?.id, user.id]);

  const incidents = recentLogs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type));

  async function submit() {
    if (!form.content.trim()) { setError('Please add key handover points'); return; }
    setSaving(true); setError(null);
    try {
      await api.handovers.create({
        site_id: site?.id,
        shift_id: shift?.id || null,
        handed_to: form.handed_to || null,
        content: form.content,
        site_status: form.site_status,
        outstanding_issues: form.outstanding_issues || null,
        keys_handed_over: form.keys_handed_over,
        radio_handed_over: form.radio_handed_over,
        equipment_checklist: [
          { item: 'Keys', handed: form.keys_handed_over },
          { item: 'Radio', handed: form.radio_handed_over },
        ],
      });

      // End the shift
      if (shift?.id) {
        try { await api.shifts.checkout(shift.id); } catch {}
      }
      onShiftEnded?.();
      navigate('/');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>End of Shift Handover</h2>
      <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',marginBottom:'1.25rem'}}>
        {site?.name} · {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'short',timeZone:'Europe/London'})}
      </p>

      {/* Shift stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.5rem',marginBottom:'1.25rem'}}>
        <div style={{textAlign:'center',padding:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px'}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'#fff'}}>{recentLogs.length}</div>
          <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}}>Logs</div>
        </div>
        <div style={{textAlign:'center',padding:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px'}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'#3b82f6'}}>{recentLogs.filter(l=>l.log_type==='PATROL').length}</div>
          <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}}>Patrols</div>
        </div>
        <div style={{textAlign:'center',padding:'0.75rem',background: incidents.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',border:`1px solid ${incidents.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,borderRadius:'8px'}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color: incidents.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.3)'}}>{incidents.length}</div>
          <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}}>Incidents</div>
        </div>
      </div>

      {/* Incidents warning */}
      {incidents.length > 0 && (
        <div style={{padding:'0.75rem',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'8px',marginBottom:'1rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#ef4444',textTransform:'uppercase',marginBottom:'0.375rem'}}>⚠ Incidents This Shift</div>
          {incidents.map(l => (
            <div key={l.id} style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.6)',padding:'0.25rem 0',borderBottom:'1px solid rgba(239,68,68,0.1)'}}>
              {l.title} — {new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
            </div>
          ))}
        </div>
      )}

      {/* Site Status */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Site Status</div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {[['ALL_SECURE','All Secure','#16a34a'],['ISSUES_NOTED','Issues Noted','#f59e0b'],['REQUIRES_ATTENTION','Requires Attention','#dc2626']].map(([val,label,color]) => (
            <button key={val} onClick={() => f('site_status', val)}
              style={{flex:1,padding:'0.625rem',background: form.site_status === val ? `${color}20` : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${form.site_status === val ? color : 'rgba(255,255,255,0.08)'}`,borderRadius:'8px',
                color: form.site_status === val ? color : 'rgba(255,255,255,0.4)',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',textAlign:'center'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Equipment Handover</div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {[['keys_handed_over','Keys'],['radio_handed_over','Radio']].map(([key,label]) => (
            <button key={key} onClick={() => f(key, !form[key])}
              style={{flex:1,padding:'0.625rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.375rem',
                background: form[key] ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1.5px solid ${form[key] ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,borderRadius:'8px',
                color: form[key] ? '#4ade80' : '#ef4444',fontSize:'0.8125rem',fontWeight:700,cursor:'pointer'}}>
              {form[key] ? '✓' : '✗'} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Handing to */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.375rem'}}>Handing Over To</div>
        <select value={form.handed_to} onChange={e => f('handed_to', e.target.value)}
          style={{width:'100%',padding:'0.625rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',color:'#fff',fontSize:'0.875rem'}}>
          <option value="">Select relieving officer</option>
          {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
        </select>
      </div>

      {/* Outstanding Issues */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.375rem'}}>Outstanding Issues</div>
        <textarea value={form.outstanding_issues} onChange={e => f('outstanding_issues', e.target.value)} rows={2}
          placeholder="Any unresolved issues, ongoing situations, or items needing follow-up..."
          style={{width:'100%',padding:'0.625rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',color:'#fff',fontSize:'0.875rem',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}} />
      </div>

      {/* Key handover points */}
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.375rem'}}>Key Points for Incoming Officer *</div>
        <textarea value={form.content} onChange={e => f('content', e.target.value)} rows={4}
          placeholder="What does the next officer need to know? Site conditions, anything unusual, areas to watch..."
          style={{width:'100%',padding:'0.625rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',color:'#fff',fontSize:'0.875rem',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}} />
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'0.75rem',fontSize:'0.8125rem',color:'#ef4444',marginBottom:'1rem'}}>{error}</div>}

      <button onClick={submit} disabled={saving}
        style={{width:'100%',padding:'1rem',background:'#1a52a8',color:'#fff',border:'none',borderRadius:'10px',fontSize:'1rem',fontWeight:700,cursor:'pointer',marginBottom:'0.75rem',opacity:saving?0.7:1}}>
        {saving ? 'Submitting...' : 'Submit Handover & End Shift'}
      </button>
      <button onClick={() => navigate('/')}
        style={{width:'100%',padding:'0.75rem',background:'transparent',color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',fontSize:'0.875rem',cursor:'pointer'}}>
        Cancel
      </button>
    </div>
  );
}

export { HandoverScreen };
