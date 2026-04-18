import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

function HandoverScreen({ user, site, shift, onShiftEnded }) {
  const navigate = useNavigate();
  const [officers, setOfficers] = useState([]);
  const [form, setForm] = useState({
    handed_to: '',
    content: '',
    shift_summary: '',
    incidents: 0,
    patrols: 0,
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.users.list(),
      site?.id ? api.logs.list({ site_id: site.id, officer_id: user.id, limit: 50 }) : Promise.resolve({ data: [] }),
    ]).then(([ur, lr]) => {
      setOfficers((ur.data || []).filter(u => u.id !== user.id && u.role === 'OFFICER'));
      const logs = lr.data || [];
      setRecentLogs(logs);
      // Auto-count incidents and patrols
      setForm(f => ({
        ...f,
        incidents: logs.filter(l => l.log_type === 'INCIDENT').length,
        patrols:   logs.filter(l => l.log_type === 'PATROL').length,
      }));
    });
  }, [site?.id, user.id]);

  async function submit() {
    if (!form.content.trim() && !form.shift_summary.trim()) {
      setError('Please add a handover summary before submitting');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const content = [
        form.shift_summary,
        form.content,
      ].filter(Boolean).join('\n\n');

      await api.handovers.create({
        site_id:    site?.id,
        shift_id:   shift?.id || null,
        handed_to:  form.handed_to || null,
        content,
      });

      // End the shift
      if (shift?.id) {
        try { await api.shifts.checkout(shift.id); } catch {}
      }
      onShiftEnded?.();
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>Shift Handover</h2>
      <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',marginBottom:'1.25rem'}}>
        {site?.name} · {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'})}
      </p>

      {/* Shift stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.5rem',marginBottom:'1.25rem'}}>
        <div className="officer-card" style={{textAlign:'center',padding:'0.75rem 0.5rem'}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'#fff'}}>{recentLogs.length}</div>
          <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Total Logs</div>
        </div>
        <div className="officer-card" style={{textAlign:'center',padding:'0.75rem 0.5rem'}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'#1a52a8'}}>{form.patrols}</div>
          <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Patrols</div>
        </div>
        <div className="officer-card" style={{textAlign:'center',padding:'0.75rem 0.5rem'}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:form.incidents>0?'#ef4444':'rgba(255,255,255,0.3)'}}>{form.incidents}</div>
          <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'0.125rem'}}>Incidents</div>
        </div>
      </div>

      {/* Hand over to */}
      <div style={{marginBottom:'0.875rem'}}>
        <label className="officer-label">Handover To (optional)</label>
        <select className="officer-input" value={form.handed_to} onChange={e => f('handed_to', e.target.value)}>
          <option value="">Select relieving officer</option>
          {officers.map(o => (
            <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>
          ))}
        </select>
      </div>

      {/* Shift summary */}
      <div style={{marginBottom:'0.875rem'}}>
        <label className="officer-label">Shift Summary</label>
        <textarea
          className="officer-input"
          rows={3}
          value={form.shift_summary}
          onChange={e => f('shift_summary', e.target.value)}
          placeholder="Brief summary of the shift..."
        />
      </div>

      {/* Key handover points */}
      <div style={{marginBottom:'1.25rem'}}>
        <label className="officer-label">Key Points for Incoming Officer</label>
        <textarea
          className="officer-input"
          rows={5}
          value={form.content}
          onChange={e => f('content', e.target.value)}
          placeholder="Outstanding issues, things to watch, ongoing situations, equipment status..."
        />
      </div>

      {/* Incidents — highlighted prominently for handover */}
      {recentLogs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type)).length > 0 && (
        <div style={{marginBottom:'1.25rem',padding:'12px',background:'rgba(239,68,68,0.07)',border:'1.5px solid rgba(239,68,68,0.2)',borderRadius:'10px'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'rgba(239,68,68,0.7)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>
            ⚠ Incidents This Shift
          </div>
          {recentLogs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type)).map(log => (
            <div key={log.id} style={{padding:'8px 0',borderBottom:'1px solid rgba(239,68,68,0.1)'}}>
              <div style={{fontSize:'13px',fontWeight:600,color:'#ef4444'}}>{log.title || log.log_type}</div>
              {log.description && <div style={{fontSize:'12px',color:'rgba(255,255,255,0.55)',marginTop:'2px',lineHeight:1.4}}>{log.description}</div>}
              <div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',marginTop:'2px'}}>
                {new Date(log.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All logs this shift */}
      {recentLogs.length > 0 && (
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>
            All Logs This Shift ({recentLogs.length})
          </div>
          <div style={{maxHeight:'180px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            {recentLogs.slice(0,20).map(log => {
              const typeMap = {PATROL:'PAT',INCIDENT:'INC',ALARM:'ALM',ACCESS:'ACC',VISITOR:'VIS',HANDOVER:'HND',MAINTENANCE:'MNT',VEHICLE:'VEH',GENERAL:'GEN',FIRE_ALARM:'FIR',EMERGENCY:'SOS'};
              const code = typeMap[log.log_type] || 'LOG';
              const isIncident = ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(log.log_type);
              return (
                <div key={log.id} style={{display:'flex',gap:'0.5rem',alignItems:'center',padding:'0.375rem 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{width:'1.75rem',height:'1.75rem',background:isIncident?'rgba(239,68,68,0.2)':'rgba(26,82,168,0.3)',borderRadius:'4px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.5rem',fontWeight:700,color:isIncident?'#ef4444':'#7aabff',flexShrink:0}}>{code}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.8125rem',color:isIncident?'rgba(255,150,150,0.9)':'rgba(255,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.title||log.log_type}</div>
                    <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)'}}>
                      {new Date(log.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}

      {/* Share incidents for briefing */}
      {recentLogs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type)).length > 0 && (
        <button
          onClick={() => {
            const incidents = recentLogs.filter(l => ['INCIDENT','ALARM','FIRE_ALARM','EMERGENCY'].includes(l.log_type));
            const text = `DOB Live — ${site?.name || 'Site'} Incident Summary\n` +
              `${new Date().toLocaleDateString('en-GB')}\n\n` +
              incidents.map(l => `• ${l.title || l.log_type} — ${new Date(l.occurred_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}\n  ${l.description||''}`).join('\n\n');
            if (navigator.share) {
              navigator.share({ title: 'Incident Summary', text });
            } else {
              navigator.clipboard?.writeText(text);
              alert('Incident summary copied to clipboard');
            }
          }}
          style={{width:'100%',padding:'0.875rem',background:'rgba(239,68,68,0.1)',border:'1.5px solid rgba(239,68,68,0.25)',borderRadius:'10px',color:'#ef4444',fontSize:'0.875rem',fontWeight:700,cursor:'pointer',marginBottom:'0.75rem'}}
        >
          ⚠ Share Incident Summary
        </button>
      )}

      <button
        onClick={submit}
        disabled={saving}
        style={{width:'100%',padding:'1rem',background:'var(--blue)',color:'#fff',border:'none',borderRadius:'10px',fontSize:'1rem',fontWeight:700,cursor:'pointer',marginBottom:'0.75rem',opacity:saving?0.7:1}}
      >
        {saving ? 'Submitting...' : 'Submit Handover & End Shift'}
      </button>
      <button
        onClick={() => navigate('/')}
        style={{width:'100%',padding:'0.75rem',background:'transparent',color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',fontSize:'0.875rem',cursor:'pointer'}}
      >
        Cancel
      </button>
    </div>
  );
}

export { HandoverScreen };
