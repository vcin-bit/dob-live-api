import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { PlusIcon } from '@heroicons/react/24/outline';

// Consistent colour per officer based on id hash
const OFFICER_COLOURS = [
  '#3b82f6','#8b5cf6','#ef4444','#f59e0b','#10b981','#ec4899','#06b6d4','#f97316',
  '#6366f1','#14b8a6','#e11d48','#84cc16','#0ea5e9','#a855f7','#22c55e','#d946ef',
];
function officerColour(id) {
  if (!id) return '#64748b';
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return OFFICER_COLOURS[Math.abs(hash) % OFFICER_COLOURS.length];
}

function isoDate(d) { return d.toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); r.setHours(0,0,0,0); return r; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); }

const VIEW_DAYS = { day: 1, week: 7, '2week': 14, month: 0 };

export default function RosterCalendar({ siteId, user }) {
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [sites, setSites] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editShift, setEditShift] = useState(null);
  const [addDate, setAddDate] = useState(null);

  // Compute visible date range
  function getRange() {
    const today = new Date(anchor);
    today.setHours(0,0,0,0);
    let from, to;
    if (view === 'day') {
      from = new Date(today);
      to = addDays(today, 1);
    } else if (view === 'week') {
      from = startOfWeek(today);
      to = addDays(from, 7);
    } else if (view === '2week') {
      from = startOfWeek(today);
      to = addDays(from, 14);
    } else {
      // Month view — pad to full weeks (Mon–Sun)
      from = startOfWeek(startOfMonth(today));
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      // Pad to end of week (Sunday)
      const endDay = (monthEnd.getDay() + 6) % 7; // 0=Mon
      to = endDay === 0 ? monthEnd : addDays(monthEnd, 7 - endDay);
    }
    return { from, to };
  }

  const { from, to } = getRange();
  const dayCount = view === 'month' ? Math.round((to - from) / 86400000) : VIEW_DAYS[view];
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));

  async function load() {
    setLoading(true);
    try {
      const params = { from: from.toISOString(), to: to.toISOString(), limit: 500 };
      if (siteId) params.site_id = siteId;
      const [shiftsRes, usersRes, sitesRes, ratesRes] = await Promise.all([
        api.shifts.list(params),
        api.users.list(),
        api.sites.list(),
        api.rates.list().catch(() => ({ data: [] })),
      ]);
      setShifts(shiftsRes.data || []);
      setOfficers((usersRes.data || []).filter(u => u.role === 'OFFICER'));
      setSites(sitesRes.data || []);
      setRates(ratesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [anchor, view, siteId]);

  function navigate(dir) {
    const d = new Date(anchor);
    if (view === 'day') d.setDate(d.getDate() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else if (view === '2week') d.setDate(d.getDate() + dir * 14);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  }

  function shiftsForDay(d) {
    const ds = isoDate(d);
    return shifts.filter(s => isoDate(new Date(s.start_time)) === ds);
  }

  // Date range label
  function rangeLabel() {
    const fmt = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    const fmtFull = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    if (view === 'day') return fmtFull(from);
    const last = addDays(to, -1);
    if (from.getFullYear() !== last.getFullYear()) return `${fmtFull(from)} – ${fmtFull(last)}`;
    return `${fmt(from)} – ${fmtFull(last)}`;
  }

  const isManager = ['COMPANY','OPS_MANAGER','SUPER_ADMIN','FD'].includes(user?.role);
  const isToday = d => isoDate(d) === isoDate(new Date());

  return (
    <div>
      {/* Controls */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>←</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(new Date())}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(1)}>→</button>
          <span style={{fontSize:'0.875rem',fontWeight:600,marginLeft:'0.5rem'}}>{rangeLabel()}</span>
        </div>
        <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px'}}>
          {[['day','Day'],['week','Week'],['2week','2 Weeks'],['month','Month']].map(([k,l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                background: view===k ? 'var(--blue)' : 'transparent',
                color: view===k ? '#fff' : 'var(--text-2)',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      ) : view === 'day' ? (
        /* ── DAY VIEW ──────────────────────────────────────── */
        <div className="card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <div className="section-title">{from.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
            {isManager && <button className="btn btn-primary btn-sm" onClick={() => setAddDate(from)}><PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Shift</button>}
          </div>
          {shiftsForDay(from).length === 0 ? (
            <div className="empty-state"><p>No shifts scheduled</p></div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {shiftsForDay(from).sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map(s => (
                <div key={s.id} onClick={() => isManager && setEditShift(s)}
                  style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.75rem 1rem',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--border)',cursor:isManager?'pointer':'default',borderLeft:`4px solid ${officerColour(s.officer_id)}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned'}</div>
                    {!siteId && <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{s.site?.name || '—'}</div>}
                    <div style={{fontSize:'0.8125rem',color:'var(--text-3)',marginTop:'2px'}}>
                      {fmtTime(s.start_time)}{s.end_time ? ` – ${fmtTime(s.end_time)}` : ' – ongoing'}
                    </div>
                  </div>
                  <span className={`badge ${s.status==='ACTIVE'?'badge-success':s.status==='COMPLETED'?'badge-neutral':'badge-blue'}`}>{s.status||'Scheduled'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── GRID VIEW (week / 2week / month) ─────────────── */
        <RotaGrid days={days} view={view} shiftsForDay={shiftsForDay} isToday={isToday} isManager={isManager}
          onEdit={s => setEditShift(s)} onAdd={d => setAddDate(d)} siteId={siteId} />
      )}

      {/* Edit modal */}
      {editShift && (
        <ShiftModal
          shift={editShift}
          officers={officers}
          sites={sites}
          rates={rates}
          siteId={siteId}
          user={user}
          onClose={() => setEditShift(null)}
          onSaved={() => { setEditShift(null); load(); }}
        />
      )}

      {/* Add modal */}
      {addDate && (
        <ShiftModal
          shift={null}
          prefillDate={isoDate(addDate)}
          officers={officers}
          sites={sites}
          rates={rates}
          siteId={siteId}
          user={user}
          onClose={() => setAddDate(null)}
          onSaved={() => { setAddDate(null); load(); }}
        />
      )}
    </div>
  );
}

function RotaGrid({ days, view, shiftsForDay, isToday, isManager, onEdit, onAdd, siteId }) {
  // Split days into rows of 7
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const isCompact = view === 'month';
  const cellMinH = isCompact ? 70 : 80;

  return (
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth:'840px'}}>
        {/* Column headers — Mon to Sun */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(120px, 1fr))',gap:'1px',background:'var(--border)',borderRadius:'8px 8px 0 0',overflow:'hidden'}}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{background:'var(--surface-2)',padding:'0.5rem',textAlign:'center',fontSize:'0.75rem',fontWeight:700,color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'0.05em'}}>
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(120px, 1fr))',gap:'1px',background:'var(--border)'}}>
            {week.map(d => {
              const dayShifts = shiftsForDay(d).sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
              const today = isToday(d);
              return (
                <div key={isoDate(d)} style={{
                  background: today ? 'var(--blue-light)' : 'var(--surface)',
                  padding: isCompact ? '0.25rem' : '0.375rem',
                  minHeight: `${cellMinH}px`,
                  display:'flex',
                  flexDirection:'column',
                }}>
                  {/* Date label */}
                  <div style={{fontSize: isCompact ? '0.6875rem' : '0.75rem', fontWeight:600, color: today ? 'var(--blue)' : 'var(--text-2)', marginBottom:'0.25rem', textAlign:'center'}}>
                    {d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                  </div>

                  {/* Shift blocks */}
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:'3px'}}>
                    {dayShifts.map(s => {
                      const col = officerColour(s.officer_id);
                      return (
                        <div key={s.id} onClick={() => isManager && onEdit(s)}
                          style={{
                            padding: isCompact ? '3px 4px' : '4px 6px',
                            borderRadius:'5px',
                            background: col + '20',
                            border: `1px solid ${col}40`,
                            cursor: isManager ? 'pointer' : 'default',
                          }}>
                          <div style={{fontWeight:700,fontSize: isCompact ? '0.625rem' : '0.75rem', color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                            {s.officer ? `${s.officer.first_name} ${s.officer.last_name?.[0] || ''}` : '?'}
                          </div>
                          <div style={{fontSize: isCompact ? '0.5625rem' : '0.6875rem', color:'var(--text-2)'}}>
                            {fmtTime(s.start_time)}–{s.end_time ? fmtTime(s.end_time) : '?'}
                          </div>
                          {!isCompact && !siteId && s.site?.name && (
                            <div style={{fontSize:'0.625rem',color:'var(--text-3)',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{s.site.name}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add button */}
                  {isManager && (
                    <button onClick={() => onAdd(d)}
                      style={{width:'100%',padding:'2px',background:'none',border:'1px dashed var(--border)',borderRadius:'4px',color:'var(--text-3)',cursor:'pointer',fontSize:'0.75rem',marginTop:'3px'}}>
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftModal({ shift, prefillDate, officers, sites, rates, siteId, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    site_id:    shift?.site_id || siteId || '',
    officer_id: shift?.officer_id || '',
    date:       shift ? isoDate(new Date(shift.start_time)) : (prefillDate || ''),
    start_time: shift ? fmtTime(shift.start_time) : '19:00',
    end_time:   shift?.end_time ? fmtTime(shift.end_time) : '07:00',
    notes:      shift?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const f = (k, v) => setForm(p => ({...p, [k]: v}));
  const isManager = ['COMPANY','OPS_MANAGER','SUPER_ADMIN'].includes(user?.role);

  // Find pay rate for selected officer + site
  const payRate = rates.find(r => r.officer_id === form.officer_id && r.site_id === form.site_id);

  async function save() {
    if (!form.site_id || !form.officer_id || !form.date) { setError('Site, officer and date are required'); return; }
    setSaving(true);
    try {
      const startDt = new Date(`${form.date}T${form.start_time}:00`).toISOString();
      const endDt = form.end_time ? new Date(`${form.date}T${form.end_time}:00`).toISOString() : null;
      // If end is before start, assume next day
      let adjustedEnd = endDt;
      if (endDt && new Date(endDt) <= new Date(startDt)) {
        const nextDay = addDays(new Date(form.date), 1);
        adjustedEnd = new Date(`${isoDate(nextDay)}T${form.end_time}:00`).toISOString();
      }
      const payload = {
        site_id: form.site_id,
        officer_id: form.officer_id,
        start_time: startDt,
        end_time: adjustedEnd,
        notes: form.notes || null,
      };
      if (shift) {
        await api.shifts.update(shift.id, payload);
      } else {
        await api.shifts.create(payload);
      }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm('Delete this shift?')) return;
    try {
      await api.shifts.update(shift.id, { status: 'CANCELLED' });
      onSaved();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{shift ? 'Edit Shift' : 'Add Shift'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Officer</label>
            <select className="input" value={form.officer_id} onChange={e => f('officer_id', e.target.value)}>
              <option value="">Select officer</option>
              {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e => f('site_id', e.target.value)} disabled={!!siteId}>
              <option value="">Select site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Start Time</label>
            <input type="time" className="input" value={form.start_time} onChange={e => f('start_time', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">End Time</label>
            <input type="time" className="input" value={form.end_time} onChange={e => f('end_time', e.target.value)} />
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes" />
          </div>
        </div>

        {/* Pay rate — read-only, managers only, never show charge_rate */}
        {isManager && payRate && (
          <div style={{padding:'0.625rem 0.75rem',background:'var(--surface-2)',borderRadius:'6px',marginTop:'0.75rem',fontSize:'0.8125rem',color:'var(--text-2)'}}>
            Pay rate: <strong style={{color:'var(--text)'}}>£{parseFloat(payRate.hourly_rate || payRate.pay_rate || 0).toFixed(2)}/hr</strong>
            {payRate.role_label && <span> — {payRate.role_label}</span>}
          </div>
        )}

        <div className="modal-footer" style={{display:'flex',justifyContent: shift ? 'space-between' : 'flex-end'}}>
          {shift && (
            <button className="btn btn-sm" style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',color:'var(--danger)'}} onClick={remove}>
              Delete Shift
            </button>
          )}
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
