import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const TASK_TYPES = [
  { key:'TASK',           label:'General Task',      desc:'e.g. Check a specific area, confirm something' },
  { key:'WELFARE_CALL',   label:'Lone Worker Call',  desc:'Welfare call to a staff member or lone worker' },
  { key:'CCTV_CHECK',     label:'CCTV Check',        desc:'Review specific cameras for activity' },
  { key:'BUILDING_CHECK', label:'Building Check',    desc:'Check a specific building, room, or area' },
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function SitePlaybook({ siteId }) {
  const [playbook, setPlaybook] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(null);

  // Patrol config form
  const [patrol, setPatrol] = useState({
    patrol_frequency_hours: 2,
    patrol_type: 'Physical perimeter patrol',
  });

  // New task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ name:'', description:'', task_type:'TASK', scheduled_time:'', contact_name:'', contact_phone:'', escalate_after_minutes:15, days_of_week:[0,1,2,3,4,5,6] });

  // New standing check
  const [newCheck, setNewCheck] = useState('');

  useEffect(() => {
    load();
  }, [siteId]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.playbooks.get(siteId);
      if (res.playbook) {
        setPlaybook(res.playbook);
        setPatrol({ patrol_frequency_hours: res.playbook.patrol_frequency_hours, patrol_type: res.playbook.patrol_type });
      }
      setTasks(res.tasks || []);
      setChecks(res.checks || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function savePatrol() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.playbooks.savePatrol(siteId, patrol);
      setSuccess('Patrol settings saved.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function addTask() {
    if (!newTask.name.trim()) return;
    setSaving(true); setError('');
    try {
      await api.playbooks.addTask(siteId, newTask);
      setNewTask({ name:'', description:'', task_type:'TASK', scheduled_time:'', contact_name:'', contact_phone:'', escalate_after_minutes:15, days_of_week:[0,1,2,3,4,5,6] });
      setShowTaskForm(false);
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteTask(taskId) {
    await api.playbooks.deleteTask(siteId, taskId);
    setTasks(p => p.filter(t => t.id !== taskId));
    setConfirmDeleteTask(null);
  }

  async function addCheck() {
    if (!newCheck.trim()) return;
    setSaving(true);
    try {
      await api.playbooks.addCheck(siteId, { description: newCheck.trim() });
      setNewCheck('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteCheck(checkId) {
    await api.playbooks.deleteCheck(siteId, checkId);
    setChecks(p => p.filter(c => c.id !== checkId));
  }

  function toggleDay(d) {
    setNewTask(p => ({
      ...p,
      days_of_week: p.days_of_week.includes(d) ? p.days_of_week.filter(x => x !== d) : [...p.days_of_week, d]
    }));
  }

  const inp = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'0.5rem 0.75rem', fontSize:'0.875rem', color:'var(--text)', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'0.75rem', fontWeight:500, color:'var(--text-2)', marginBottom:'0.25rem', display:'block' };

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner"/></div>;

  return (
    <div>
      {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
      {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{success}</div>}

      {/* ── PATROL SCHEDULE ─────────────────────────────────────── */}
      <div className="card" style={{marginBottom:'1.25rem'}}>
        <div className="section-title" style={{marginBottom:'0.25rem'}}>Patrol Schedule</div>
        <div style={{fontSize:'0.8125rem',color:'var(--text-3)',marginBottom:'1rem'}}>
          Officers will receive countdown warnings and popup reminders when a patrol is due.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1rem'}}>
          <div>
            <label style={lbl}>Frequency (hours)</label>
            <select value={patrol.patrol_frequency_hours} onChange={e => setPatrol(p=>({...p,patrol_frequency_hours:+e.target.value}))} style={inp}>
              {[0.5,1,1.5,2,2.5,3,4,6].map(h => <option key={h} value={h}>{h === 0.5 ? '30 mins' : `${h} hour${h!==1?'s':''}`}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Patrol Type</label>
            <select value={patrol.patrol_type} onChange={e => setPatrol(p=>({...p,patrol_type:e.target.value}))} style={inp}>
              {['Physical perimeter patrol','Internal building check','CCTV patrol','Vehicle park check','Full site patrol'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{padding:'0.75rem',background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:'8px',marginBottom:'1rem',fontSize:'0.8125rem',color:'var(--text-2)'}}>
          Officers will see a countdown on the home screen. Popups fire at <strong>15, 10, 5 minutes</strong> then a "PATROL DUE NOW" alert. Logging any patrol entry dismisses the timer.
        </div>
        <button onClick={savePatrol} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? 'Saving...' : 'Save Patrol Schedule'}
        </button>
      </div>

      {/* ── SCHEDULED TASKS ─────────────────────────────────────── */}
      <div className="card" style={{marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.25rem'}}>
          <div className="section-title">Scheduled Tasks & Reminders</div>
          <button onClick={() => setShowTaskForm(!showTaskForm)} className="btn btn-secondary btn-sm">
            {showTaskForm ? 'Cancel' : '+ Add Task'}
          </button>
        </div>
        <div style={{fontSize:'0.8125rem',color:'var(--text-3)',marginBottom:'1rem'}}>
          Popups fire on officer's phone at the scheduled time. Officer taps Done — creating an automatic log entry. No response after {15} mins alerts you.
        </div>

        {showTaskForm && (
          <div style={{padding:'1rem',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',marginBottom:'1rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Task Name *</label>
                <input value={newTask.name} onChange={e=>setNewTask(p=>({...p,name:e.target.value}))} placeholder="e.g. Lone worker call to Sarah" style={inp} />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Description / Instructions</label>
                <input value={newTask.description} onChange={e=>setNewTask(p=>({...p,description:e.target.value}))} placeholder="e.g. Call mobile, confirm safe and secure, log outcome" style={inp} />
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select value={newTask.task_type} onChange={e=>setNewTask(p=>({...p,task_type:e.target.value}))} style={inp}>
                  {TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Time (24hr) — leave blank for shift-start</label>
                <input type="time" value={newTask.scheduled_time} onChange={e=>setNewTask(p=>({...p,scheduled_time:e.target.value}))} style={inp} />
              </div>
              {newTask.task_type === 'WELFARE_CALL' && (
                <>
                  <div>
                    <label style={lbl}>Contact Name</label>
                    <input value={newTask.contact_name} onChange={e=>setNewTask(p=>({...p,contact_name:e.target.value}))} placeholder="e.g. Sarah Johnson" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Contact Number</label>
                    <input value={newTask.contact_phone} onChange={e=>setNewTask(p=>({...p,contact_phone:e.target.value}))} placeholder="07700 000000" style={inp} />
                  </div>
                </>
              )}
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Days</label>
                <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                  {DAYS.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      style={{padding:'4px 10px',borderRadius:'4px',border:'1px solid var(--border)',background:newTask.days_of_week.includes(i)?'var(--blue)':'var(--surface)',color:newTask.days_of_week.includes(i)?'#fff':'var(--text-2)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Escalate if not done after (mins)</label>
                <select value={newTask.escalate_after_minutes} onChange={e=>setNewTask(p=>({...p,escalate_after_minutes:+e.target.value}))} style={inp}>
                  {[10,15,20,30,45,60].map(m => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
            </div>
            <button onClick={addTask} disabled={saving||!newTask.name.trim()} className="btn btn-primary btn-sm">
              {saving ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="empty-state"><p>No scheduled tasks yet — add reminders for welfare calls, CCTV checks, building checks etc.</p></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            {tasks.map(t => {
              const typeInfo = TASK_TYPES.find(x => x.key === t.task_type) || TASK_TYPES[0];
              const typeColor = { WELFARE_CALL:'#f97316', CCTV_CHECK:'#3b82f6', BUILDING_CHECK:'#8b5cf6', TASK:'var(--text-2)' };
              return (
                <div key={t.id} style={{display:'flex',gap:'0.75rem',alignItems:'flex-start',padding:'0.75rem',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap',marginBottom:'0.25rem'}}>
                      <span style={{fontWeight:600,fontSize:'0.875rem'}}>{t.name}</span>
                      <span style={{fontSize:'0.6875rem',color:typeColor[t.task_type]||'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>{typeInfo.label}</span>
                      {t.scheduled_time && <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>⏰ {t.scheduled_time.slice(0,5)}</span>}
                    </div>
                    {t.description && <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{t.description}</div>}
                    {t.contact_name && <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'2px'}}>📞 {t.contact_name}{t.contact_phone ? ` — ${t.contact_phone}` : ''}</div>}
                    <div style={{fontSize:'0.6875rem',color:'var(--text-3)',marginTop:'4px'}}>
                      Escalates after {t.escalate_after_minutes} mins · {t.days_of_week?.length === 7 ? 'Every day' : t.days_of_week?.map(d => DAYS[d]).join(', ')}
                    </div>
                  </div>
                  <button onClick={() => setConfirmDeleteTask(t.id)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'1rem',padding:'0 4px',flexShrink:0}}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── STANDING CHECKS ─────────────────────────────────────── */}
      <div className="card">
        <div className="section-title" style={{marginBottom:'0.25rem'}}>Handover Checklist Items</div>
        <div style={{fontSize:'0.8125rem',color:'var(--text-3)',marginBottom:'1rem'}}>
          These appear on every handover. The incoming officer must acknowledge each one. Creates an unbreakable chain of accountability.
        </div>
        <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.75rem'}}>
          <input value={newCheck} onChange={e => setNewCheck(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addCheck()}
            placeholder='e.g. "Keys in cabinet A — confirm receipt"' style={{...inp, flex:1}} />
          <button onClick={addCheck} disabled={saving||!newCheck.trim()} className="btn btn-primary btn-sm">Add</button>
        </div>
        {checks.length === 0 ? (
          <div className="empty-state"><p>No standing checks yet. Add items every incoming officer must confirm — keys, equipment, ongoing situations.</p></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            {checks.map((c, i) => (
              <div key={c.id} style={{display:'flex',gap:'0.5rem',alignItems:'center',padding:'0.5rem 0.75rem',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px'}}>
                <span style={{fontSize:'0.75rem',color:'var(--text-3)',width:'1.25rem',flexShrink:0}}>{i+1}</span>
                <span style={{flex:1,fontSize:'0.875rem'}}>{c.description}</span>
                <button onClick={() => deleteCheck(c.id)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'1rem',padding:0}}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteTask && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px',textAlign:'center'}}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>Remove this task?</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.45)',marginBottom:'20px',lineHeight:1.5}}>This task will be permanently removed from the playbook.</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setConfirmDeleteTask(null)}
                style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={() => deleteTask(confirmDeleteTask)}
                style={{flex:1,padding:'13px',background:'rgba(220,38,38,0.15)',border:'1.5px solid rgba(220,38,38,0.4)',borderRadius:'10px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
