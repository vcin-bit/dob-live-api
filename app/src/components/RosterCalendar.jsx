import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { PlusIcon } from '@heroicons/react/24/outline';

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
function localISOString(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${dateStr}T${timeStr}:00${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); r.setHours(0,0,0,0); return r; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); }

function isOvernight(s) {
  if (!s.end_time) return false;
  return new Date(s.end_time) > addDays(new Date(isoDate(new Date(s.start_time))), 1);
}

function shiftTimeLabel(s) {
  const start = fmtTime(s.start_time);
  if (!s.end_time) return `${start} – ?`;
  const end = fmtTime(s.end_time);
  return isOvernight(s) ? `${start}–${end} ↗` : `${start}–${end}`;
}

function shiftHours(s) {
  if (!s.start_time || !s.end_time) return 0;
  return Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 3600000);
}

function canSeePay(role) { return ['COMPANY','OPS_MANAGER','SUPER_ADMIN','FD'].includes(role); }
function canSeeCharge(role) { return ['COMPANY','SUPER_ADMIN','FD'].includes(role); }

function statusBadge(status) {
  switch (status) {
    case 'ACTIVE': return { cls: 'badge-success', label: 'Active', pulse: true };
    case 'COMPLETED': return { cls: 'badge-neutral', label: 'Completed', pulse: false };
    case 'SCHEDULED': return { cls: 'badge-blue', label: 'Scheduled', pulse: false };
    default: return { cls: 'badge-neutral', label: status || 'Scheduled', pulse: false };
  }
}

const VIEW_DAYS = { day: 1, week: 7, '2week': 14, month: 0 };

export default function RosterCalendar({ siteId, user }) {
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [siteOfficerIds, setSiteOfficerIds] = useState(null);
  const [sites, setSites] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editShift, setEditShift] = useState(null);
  const [addDate, setAddDate] = useState(null);

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null); // 'officer' | 'times' | 'delete'
  const [bulkProcessing, setBulkProcessing] = useState(false);

  function getRange() {
    const today = new Date(anchor);
    today.setHours(0,0,0,0);
    let from, to;
    if (view === 'day') { from = new Date(today); to = addDays(today, 1); }
    else if (view === 'week') { from = startOfWeek(today); to = addDays(from, 7); }
    else if (view === '2week') { from = startOfWeek(today); to = addDays(from, 14); }
    else {
      from = startOfWeek(startOfMonth(today));
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endDay = (monthEnd.getDay() + 6) % 7;
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
      const fetchFrom = addDays(from, -1);
      const fetchTo = addDays(to, 1);
      const params = { from: fetchFrom.toISOString(), to: fetchTo.toISOString(), limit: 500 };
      if (siteId) params.site_id = siteId;
      const [shiftsRes, usersRes, sitesRes, ratesRes] = await Promise.all([
        api.shifts.list(params), api.users.list(), api.sites.list(),
        api.rates.list().catch(() => ({ data: [] })),
      ]);
      setShifts(shiftsRes.data || []);
      const allOfficers = (usersRes.data || []).filter(u => u.role === 'OFFICER')
        .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));
      setOfficers(allOfficers);
      setSites(sitesRes.data || []);
      setRates(ratesRes.data || []);
      if (siteId) {
        const assigned = await Promise.all(allOfficers.map(async o => {
          try {
            const res = await api.officerSites.list(o.id);
            return (res.data || []).some(s => s.id === siteId) ? o.id : null;
          } catch { return null; }
        }));
        setSiteOfficerIds(new Set(assigned.filter(Boolean)));
      } else { setSiteOfficerIds(null); }
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
  const modalOfficers = siteOfficerIds ? officers.filter(o => siteOfficerIds.has(o.id)) : officers;

  // Bulk helpers
  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() {
    const visible = days.flatMap(d => shiftsForDay(d));
    setSelected(new Set(visible.map(s => s.id)));
  }
  function selectDay(d) {
    const dayIds = shiftsForDay(d).map(s => s.id);
    setSelected(prev => { const n = new Set(prev); dayIds.forEach(id => n.add(id)); return n; });
  }
  function exitBulk() { setBulkMode(false); setSelected(new Set()); setBulkAction(null); }

  async function bulkChangeOfficer(officerId) {
    setBulkProcessing(true);
    try {
      await Promise.all([...selected].map(id => api.shifts.update(id, { officer_id: officerId })));
      exitBulk(); load();
    } catch (err) { alert(err.message); }
    finally { setBulkProcessing(false); }
  }

  async function bulkChangeTimes(startTime, endTime) {
    setBulkProcessing(true);
    try {
      const selectedShifts = shifts.filter(s => selected.has(s.id));
      await Promise.all(selectedShifts.map(s => {
        const date = isoDate(new Date(s.start_time));
        const startDt = localISOString(date, startTime);
        let endDt = localISOString(date, endTime);
        if (new Date(endDt) <= new Date(startDt)) {
          endDt = localISOString(isoDate(addDays(new Date(date), 1)), endTime);
        }
        return api.shifts.update(s.id, { start_time: startDt, end_time: endDt });
      }));
      exitBulk(); load();
    } catch (err) { alert(err.message); }
    finally { setBulkProcessing(false); }
  }

  async function bulkDelete() {
    setBulkProcessing(true);
    try {
      await Promise.all([...selected].map(id => api.shifts.delete(id)));
      exitBulk(); load();
    } catch (err) { alert(err.message); }
    finally { setBulkProcessing(false); }
  }

  function handleShiftClick(s) {
    if (bulkMode) { toggleSelect(s.id); return; }
    if (isManager) setEditShift(s);
  }

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
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          {isManager && (
            <button className={`btn btn-sm ${bulkMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => bulkMode ? exitBulk() : setBulkMode(true)}>
              {bulkMode ? 'Exit Select' : 'Select'}
            </button>
          )}
          {bulkMode && <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>}
          <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px'}}>
            {[['day','Day'],['week','Week'],['2week','2 Weeks'],['month','Month']].map(([k,l]) => (
              <button key={k} onClick={() => setView(k)}
                style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                  background: view===k ? 'var(--blue)' : 'transparent', color: view===k ? '#fff' : 'var(--text-2)'}}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      ) : view === 'day' ? (
        <div className="card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <div className="section-title">{from.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {bulkMode && <button className="btn btn-ghost btn-sm" onClick={() => selectDay(from)}>Select All</button>}
              {isManager && !bulkMode && <button className="btn btn-primary btn-sm" onClick={() => setAddDate(from)}><PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Shift</button>}
            </div>
          </div>
          {shiftsForDay(from).length === 0 ? (
            <div style={{textAlign:'center',padding:'1.5rem',color:'#ef4444',fontSize:'0.8125rem',fontWeight:600}}>Uncovered</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {shiftsForDay(from).sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map(s => {
                const sb = statusBadge(s.status);
                const sel = selected.has(s.id);
                return (
                  <div key={s.id} onClick={() => handleShiftClick(s)}
                    style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.75rem 1rem',borderRadius:'8px',background:'var(--surface)',
                      border: sel ? '2px solid var(--blue)' : '1px solid var(--border)',
                      cursor: bulkMode || isManager ? 'pointer' : 'default', borderLeft:`4px solid ${officerColour(s.officer_id)}`}}>
                    {bulkMode && <input type="checkbox" checked={sel} readOnly style={{width:'1rem',height:'1rem',accentColor:'var(--blue)',flexShrink:0}} />}
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned'}</div>
                      {!siteId && <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{s.site?.name || '—'}</div>}
                      <div style={{fontSize:'0.8125rem',color:'var(--text-3)',marginTop:'2px'}}>{shiftTimeLabel(s)}</div>
                    </div>
                    <span className={`badge ${sb.cls}`} style={{display:'inline-flex',alignItems:'center',gap:'4px'}}>
                      {sb.pulse && <span style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',animation:'pulse 2s infinite'}} />}
                      {sb.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <RotaGrid days={days} view={view} shiftsForDay={shiftsForDay} isToday={isToday} isManager={isManager}
          onShiftClick={handleShiftClick} onAdd={d => setAddDate(d)} siteId={siteId}
          bulkMode={bulkMode} selected={selected} onSelectDay={selectDay} user={user} anchorMonth={anchor.getMonth()} anchorYear={anchor.getFullYear()} />
      )}

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && !bulkAction && (
        <div style={{position:'sticky',bottom:0,left:0,right:0,background:'var(--navy)',border:'1px solid var(--border)',borderRadius:'10px 10px 0 0',padding:'0.75rem 1rem',display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',zIndex:100}}>
          {bulkProcessing ? (
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',color:'#fff',fontSize:'0.875rem'}}><div className="spinner" style={{width:'1rem',height:'1rem'}} /> Processing...</div>
          ) : (
            <>
              <span style={{fontSize:'0.875rem',fontWeight:600,color:'#fff'}}>{selected.size} shift{selected.size!==1?'s':''} selected</span>
              <div style={{flex:1}} />
              <button className="btn btn-sm" style={{background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.4)',color:'#60a5fa'}} onClick={() => setBulkAction('officer')}>Change Officer</button>
              <button className="btn btn-sm" style={{background:'rgba(251,191,36,0.2)',border:'1px solid rgba(251,191,36,0.4)',color:'#fbbf24'}} onClick={() => setBulkAction('times')}>Change Times</button>
              <button className="btn btn-sm" style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',color:'#ef4444'}} onClick={() => setBulkAction('delete')}>Delete Selected</button>
              <button className="btn btn-ghost btn-sm" style={{color:'rgba(255,255,255,0.5)'}} onClick={exitBulk}>Cancel</button>
            </>
          )}
        </div>
      )}

      {/* Bulk change officer */}
      {bulkAction === 'officer' && (
        <BulkOfficerModal officers={modalOfficers} allOfficers={officers} siteId={siteId} count={selected.size}
          onApply={bulkChangeOfficer} onClose={() => setBulkAction(null)} processing={bulkProcessing} />
      )}

      {/* Bulk change times */}
      {bulkAction === 'times' && (
        <BulkTimesModal count={selected.size}
          onApply={bulkChangeTimes} onClose={() => setBulkAction(null)} processing={bulkProcessing} />
      )}

      {/* Bulk delete confirm */}
      {bulkAction === 'delete' && (
        <div className="modal-overlay" onClick={() => setBulkAction(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
            <div className="modal-header">
              <div className="modal-title">Delete {selected.size} shift{selected.size!==1?'s':''}?</div>
              <button className="modal-close" onClick={() => setBulkAction(null)}>×</button>
            </div>
            <p style={{fontSize:'0.875rem',color:'var(--text-2)',marginBottom:'1rem'}}>This will permanently delete the selected shifts. This cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setBulkAction(null)}>Cancel</button>
              <button className="btn btn-sm" style={{background:'var(--danger)',color:'#fff',border:'none'}} onClick={bulkDelete} disabled={bulkProcessing}>
                {bulkProcessing ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editShift && (
        <ShiftModal shift={editShift} officers={modalOfficers} allOfficers={officers} sites={sites} rates={rates}
          siteId={siteId} user={user} onClose={() => setEditShift(null)} onSaved={() => { setEditShift(null); load(); }} />
      )}

      {/* Add modal */}
      {addDate && (
        <ShiftModal shift={null} prefillDate={isoDate(addDate)} officers={modalOfficers} allOfficers={officers} sites={sites} rates={rates}
          siteId={siteId} user={user} onClose={() => setAddDate(null)} onSaved={() => { setAddDate(null); load(); }} />
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
    </div>
  );
}

// ── Bulk modals ──────────────────────────────────────────────────────────────

function BulkOfficerModal({ officers, allOfficers, siteId, count, onApply, onClose, processing }) {
  const [officerId, setOfficerId] = useState('');
  const list = siteId ? officers : (allOfficers || officers);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
        <div className="modal-header">
          <div className="modal-title">Change Officer — {count} shift{count!==1?'s':''}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="field">
          <label className="label">Assign to</label>
          <select className="input" value={officerId} onChange={e => setOfficerId(e.target.value)}>
            <option value="">Select officer</option>
            {list.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onApply(officerId)} disabled={!officerId || processing}>
            {processing ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkTimesModal({ count, onApply, onClose, processing }) {
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('07:00');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'400px'}}>
        <div className="modal-header">
          <div className="modal-title">Change Times — {count} shift{count!==1?'s':''}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{fontSize:'0.8125rem',color:'var(--text-2)',marginBottom:'0.75rem'}}>New times will be applied to all selected shifts, keeping their original dates.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">Start Time</label>
            <input type="time" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">End Time</label>
            <input type="time" className="input" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onApply(startTime, endTime)} disabled={processing}>
            {processing ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rota Grid ────────────────────────────────────────────────────────────────

function RotaGrid({ days, view, shiftsForDay, isToday, isManager, onShiftClick, onAdd, siteId, bulkMode, selected, onSelectDay, user, anchorMonth, anchorYear }) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const isCompact = view === 'month';
  const cellMinH = isCompact ? 70 : 80;

  return (
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth:'840px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(120px, 1fr))',gap:'1px',background:'var(--border)',borderRadius:'8px 8px 0 0',overflow:'hidden'}}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{background:'var(--surface-2)',padding:'0.5rem',textAlign:'center',fontSize:'0.75rem',fontWeight:700,color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'0.05em'}}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          const weekShifts = week.flatMap(d => shiftsForDay(d));
          const weekHours = weekShifts.reduce((t, s) => t + shiftHours(s), 0);
          const weekPayCost = weekShifts.reduce((t, s) => t + shiftHours(s) * (parseFloat(s.pay_rate) || 0), 0);
          const weekChargeRev = weekShifts.reduce((t, s) => t + shiftHours(s) * (parseFloat(s.charge_rate) || 0), 0);
          return (<React.Fragment key={wi}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7, minmax(120px, 1fr))',gap:'1px',background:'var(--border)'}}>
            {week.map(d => {
              const outOfMonth = isCompact && (d.getMonth() !== anchorMonth || d.getFullYear() !== anchorYear);
              if (outOfMonth) {
                return <div key={isoDate(d)} style={{background:'var(--surface-2)',minHeight:`${cellMinH}px`,opacity:0.4}} />;
              }
              const dayShifts = shiftsForDay(d).sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
              const today = isToday(d);
              return (
                <div key={isoDate(d)} style={{
                  background: today ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
                  padding: isCompact ? '0.25rem' : '0.375rem',
                  minHeight: `${cellMinH}px`, display:'flex', flexDirection:'column',
                  borderLeft: today ? '2px solid var(--blue)' : 'none',
                }}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'4px',marginBottom:'0.25rem'}}>
                    <span style={{fontSize: isCompact ? '0.6875rem' : '0.75rem', fontWeight:600, color: today ? 'var(--blue)' : 'var(--text-2)'}}>
                      {d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                    </span>
                    {bulkMode && dayShifts.length > 0 && (
                      <button onClick={() => onSelectDay(d)} style={{background:'none',border:'none',color:'var(--blue)',cursor:'pointer',fontSize:'0.625rem',fontWeight:600,padding:0}}>All</button>
                    )}
                  </div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:'3px'}}>
                    {dayShifts.length === 0 && (
                      <div style={{fontSize: isCompact ? '0.5625rem' : '0.6875rem', color:'#ef4444', textAlign:'center', padding:'0.25rem 0', fontWeight:600, opacity:0.7}}>Uncovered</div>
                    )}
                    {dayShifts.map(s => {
                      const col = officerColour(s.officer_id);
                      const sel = selected.has(s.id);
                      return (
                        <div key={s.id} onClick={() => onShiftClick(s)}
                          style={{
                            padding: isCompact ? '3px 4px' : '4px 6px', borderRadius:'5px',
                            background: col + '20',
                            border: sel ? '2px solid var(--blue)' : `1px solid ${col}40`,
                            cursor: bulkMode || isManager ? 'pointer' : 'default',
                            position:'relative',
                          }}>
                          {bulkMode && (
                            <input type="checkbox" checked={sel} readOnly
                              style={{position:'absolute',top:2,left:2,width:'0.75rem',height:'0.75rem',accentColor:'var(--blue)'}} />
                          )}
                          <div style={{display:'flex',alignItems:'center',gap:'3px',marginLeft:bulkMode?'1rem':'0'}}>
                            {s.status === 'ACTIVE' && <span style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',flexShrink:0,animation:'pulse 2s infinite'}} />}
                            <span style={{fontWeight:700,fontSize: isCompact ? '0.625rem' : '0.75rem', color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                              {s.officer ? `${s.officer.first_name} ${s.officer.last_name?.[0] || ''}` : '?'}
                            </span>
                          </div>
                          <div style={{fontSize: isCompact ? '0.5625rem' : '0.6875rem', color:'var(--text-2)', marginLeft:bulkMode?'1rem':'0'}}>
                            {shiftTimeLabel(s)}
                          </div>
                          {!isCompact && !siteId && s.site?.name && (
                            <div style={{fontSize:'0.625rem',color:'var(--text-3)',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',marginLeft:bulkMode?'1rem':'0'}}>{s.site.name}</div>
                          )}
                          {canSeePay(user?.role) && (
                            s.pay_rate ? (
                              <div style={{fontSize: isCompact ? '0.5rem' : '0.5625rem',color:'#f59e0b',marginLeft:bulkMode?'1rem':'0',marginTop:'1px',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                                {isCompact ? `£${(shiftHours(s) * parseFloat(s.pay_rate)).toFixed(0)}` : `£${parseFloat(s.pay_rate).toFixed(2)}/hr · £${(shiftHours(s) * parseFloat(s.pay_rate)).toFixed(2)}`}
                              </div>
                            ) : (
                              <div style={{fontSize: isCompact ? '0.5rem' : '0.5625rem',color:'#f59e0b',marginLeft:bulkMode?'1rem':'0',marginTop:'1px',opacity:0.8}}>{isCompact ? '!' : 'Rate not set'}</div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isManager && !bulkMode && (
                    <button onClick={() => onAdd(d)}
                      style={{width:'100%',padding:'2px',background:'none',border:'1px dashed var(--border)',borderRadius:'4px',color:'var(--text-3)',cursor:'pointer',fontSize:'0.75rem',marginTop:'3px'}}>
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Weekly summary row */}
          {weekHours > 0 && canSeePay(user?.role) && (() => {
            const byOfficer = {};
            weekShifts.forEach(s => {
              const name = s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned';
              if (!byOfficer[name]) byOfficer[name] = { hours: 0, pay: 0 };
              const h = shiftHours(s);
              byOfficer[name].hours += h;
              byOfficer[name].pay += h * (parseFloat(s.pay_rate) || 0);
            });
            const entries = Object.entries(byOfficer).sort((a,b) => b[1].pay - a[1].pay);
            return (
              <div style={{background:'var(--surface-2)',padding:'0.5rem 0.75rem',fontSize:'0.75rem',color:'var(--text-2)'}}>
                {entries.map(([name, d]) => (
                  <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}>
                    <span>{name}</span>
                    <span>{d.hours.toFixed(1)} hrs{d.pay > 0 ? <span style={{color:'#f59e0b',marginLeft:'0.5rem'}}>£{d.pay.toFixed(2)}</span> : ''}</span>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',marginTop:'4px',paddingTop:'4px',fontWeight:700,color:'var(--text)'}}>
                  <span>Total</span>
                  <span>{weekHours.toFixed(1)} hrs<span style={{color:'#f59e0b',marginLeft:'0.5rem'}}>£{weekPayCost.toFixed(2)}</span></span>
                </div>
              </div>
            );
          })()}
          </React.Fragment>);
        })}
        {/* Monthly summary */}
        {isCompact && canSeePay(user?.role) && (() => {
          const monthShifts = days.filter(d => d.getMonth() === anchorMonth && d.getFullYear() === anchorYear).flatMap(d => shiftsForDay(d));
          if (!monthShifts.length) return null;
          const byOfficer = {};
          monthShifts.forEach(s => {
            const name = s.officer ? `${s.officer.first_name} ${s.officer.last_name}` : 'Unassigned';
            if (!byOfficer[name]) byOfficer[name] = { hours: 0, pay: 0 };
            const h = shiftHours(s);
            byOfficer[name].hours += h;
            byOfficer[name].pay += h * (parseFloat(s.pay_rate) || 0);
          });
          const entries = Object.entries(byOfficer).sort((a,b) => b[1].pay - a[1].pay);
          const totalHrs = entries.reduce((t, [,d]) => t + d.hours, 0);
          const totalPay = entries.reduce((t, [,d]) => t + d.pay, 0);
          return (
            <div style={{background:'var(--surface-2)',borderRadius:'0 0 8px 8px',padding:'0.75rem 1rem',fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'1px'}}>
              <div style={{fontWeight:700,color:'var(--text)',marginBottom:'0.5rem',fontSize:'0.875rem'}}>Monthly Pay Summary</div>
              {entries.map(([name, d]) => (
                <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'3px 0'}}>
                  <span>{name}</span>
                  <span>{d.hours.toFixed(1)} hrs{d.pay > 0 ? <span style={{color:'#f59e0b',marginLeft:'0.5rem'}}>£{d.pay.toFixed(2)}</span> : ''}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',marginTop:'6px',paddingTop:'6px',fontWeight:700,color:'var(--text)',fontSize:'0.875rem'}}>
                <span>Total pay this month</span>
                <span>{totalHrs.toFixed(1)} hrs<span style={{color:'#f59e0b',marginLeft:'0.5rem'}}>£{totalPay.toFixed(2)}</span></span>
              </div>
            </div>
          );
        })()}
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
    </div>
  );
}

// ── Shift Modal ──────────────────────────────────────────────────────────────

function ShiftModal({ shift, prefillDate, officers, allOfficers, sites, rates, siteId, user, onClose, onSaved }) {
  const hasActuals = shift && (shift.status === 'COMPLETED' || shift.status === 'ACTIVE');
  const [form, setForm] = useState({
    site_id: shift?.site_id || siteId || '', officer_id: shift?.officer_id || '',
    date: shift ? isoDate(new Date(shift.start_time)) : (prefillDate || ''),
    start_time: shift ? fmtTime(shift.start_time) : '19:00',
    end_time: shift?.end_time ? fmtTime(shift.end_time) : '07:00', notes: shift?.notes || '',
    pay_rate: shift?.pay_rate || '', charge_rate: shift?.charge_rate || '',
    actual_start: shift?.checked_in_at ? fmtTime(shift.checked_in_at) : '',
    actual_end: shift?.checked_out_at ? fmtTime(shift.checked_out_at) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const f = (k, v) => setForm(p => ({...p, [k]: v}));
  const isManager = ['COMPANY','OPS_MANAGER','SUPER_ADMIN'].includes(user?.role);
  const visibleOfficers = siteId ? officers : (allOfficers || officers);

  // Auto-populate pay rate from officer_rates when officer or site changes (only for new shifts)
  useEffect(() => {
    if (shift?.pay_rate) return; // don't overwrite existing
    if (!form.officer_id) return;
    const siteRate = rates.find(r => r.officer_id === form.officer_id && r.site_id === form.site_id);
    const defaultRate = rates.find(r => r.officer_id === form.officer_id && !r.site_id);
    const rate = siteRate || defaultRate;
    if (rate) f('pay_rate', parseFloat(rate.hourly_rate || rate.pay_rate || 0));
  }, [form.officer_id, form.site_id]);

  async function save() {
    if (!form.site_id || !form.officer_id || !form.date) { setError('Site, officer and date are required'); return; }
    setSaving(true);
    try {
      const startDt = localISOString(form.date, form.start_time);
      const endDt = form.end_time ? localISOString(form.date, form.end_time) : null;
      let adjustedEnd = endDt;
      if (endDt && new Date(endDt) <= new Date(startDt)) {
        adjustedEnd = localISOString(isoDate(addDays(new Date(form.date), 1)), form.end_time);
      }
      const payload = { site_id: form.site_id, officer_id: form.officer_id, start_time: startDt, end_time: adjustedEnd, notes: form.notes || null,
        pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : null,
        charge_rate: form.charge_rate ? parseFloat(form.charge_rate) : null,
      };
      if (hasActuals && form.actual_start) {
        payload.checked_in_at = localISOString(form.date, form.actual_start);
      }
      if (hasActuals && form.actual_end) {
        let actEnd = localISOString(form.date, form.actual_end);
        if (form.actual_start && new Date(actEnd) <= new Date(localISOString(form.date, form.actual_start))) {
          actEnd = localISOString(isoDate(addDays(new Date(form.date), 1)), form.actual_end);
        }
        payload.checked_out_at = actEnd;
      }
      if (shift) await api.shifts.update(shift.id, payload);
      else await api.shifts.create(payload);
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
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
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={e => f('date', e.target.value)} /></div>
          {!siteId && <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Site</label><select className="input" value={form.site_id} onChange={e => f('site_id', e.target.value)}><option value="">Select site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
          <div className="field" style={siteId ? {} : {gridColumn:'1/-1'}}><label className="label">Officer</label><select className="input" value={form.officer_id} onChange={e => f('officer_id', e.target.value)}><option value="">Select officer</option>{visibleOfficers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}</select></div>
          {siteId && <div className="field"><label className="label">Site</label><select className="input" value={form.site_id} disabled>{sites.filter(s => s.id === siteId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
          <div className="field"><label className="label">Start Time</label><input type="time" className="input" value={form.start_time} onChange={e => f('start_time', e.target.value)} /></div>
          <div className="field"><label className="label">End Time</label><input type="time" className="input" value={form.end_time} onChange={e => f('end_time', e.target.value)} /></div>
          {hasActuals && (
            <>
              <div className="field" style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}><div className="section-title" style={{margin:0,color:'#10b981'}}>Actual Times (editable)</div></div>
              <div className="field"><label className="label">Checked In</label><input type="time" className="input" value={form.actual_start} onChange={e => f('actual_start', e.target.value)} /></div>
              <div className="field"><label className="label">Checked Out</label><input type="time" className="input" value={form.actual_end} onChange={e => f('actual_end', e.target.value)} /></div>
            </>
          )}
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes" /></div>
        </div>
        {/* Pay & Charge rates */}
        {canSeePay(user?.role) && (
          <div style={{display:'grid',gridTemplateColumns: canSeeCharge(user?.role) ? '1fr 1fr' : '1fr',gap:'0.75rem',marginTop:'0.75rem'}}>
            <div className="field">
              <label className="label">Pay Rate (£/hr)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.pay_rate} onChange={e => f('pay_rate', e.target.value)} placeholder="0.00" />
            </div>
            {canSeeCharge(user?.role) && (
              <div className="field">
                <label className="label">Charge Rate (£/hr)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.charge_rate} onChange={e => f('charge_rate', e.target.value)} placeholder="0.00" />
              </div>
            )}
          </div>
        )}
        {(form.pay_rate || form.charge_rate) && form.start_time && form.end_time && form.date && (() => {
          const startDt = new Date(`${form.date}T${form.start_time}:00`);
          let endDt = new Date(`${form.date}T${form.end_time}:00`);
          if (endDt <= startDt) endDt = new Date(`${isoDate(addDays(new Date(form.date), 1))}T${form.end_time}:00`);
          const hrs = Math.max(0, (endDt - startDt) / 3600000);
          const showPay = canSeePay(user?.role) && form.pay_rate;
          const showCharge = canSeeCharge(user?.role) && form.charge_rate;
          return (showPay || showCharge) ? (
            <div style={{padding:'0.5rem 0.75rem',background:'var(--surface-2)',borderRadius:'6px',marginTop:'0.5rem',fontSize:'0.8125rem',color:'var(--text-2)',display:'flex',gap:'1rem',flexWrap:'wrap'}}>
              <span>{hrs.toFixed(1)} hrs</span>
              {showPay && <span style={{color:'#f59e0b'}}>Pay: <strong>£{(hrs * parseFloat(form.pay_rate)).toFixed(2)}</strong></span>}
              {showCharge && <span style={{color:'#10b981'}}>Charge: <strong>£{(hrs * parseFloat(form.charge_rate)).toFixed(2)}</strong></span>}
            </div>
          ) : null;
        })()}
        <div className="modal-footer" style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          <div style={{display:'flex',justifyContent: shift ? 'space-between' : 'flex-end',gap:'0.5rem'}}>
            {shift && !confirmRemove && !confirmDelete && (
              <button className="btn btn-sm" style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',color:'var(--danger)'}} onClick={() => setConfirmRemove(true)}>Remove Officer</button>
            )}
            {shift && confirmRemove && (
              <div style={{display:'flex',gap:'0.375rem',alignItems:'center'}}>
                <button className="btn btn-sm" style={{background:'var(--danger)',color:'#fff',border:'none'}} onClick={async () => { await api.shifts.update(shift.id, { officer_id: null, status: 'SCHEDULED' }); onSaved(); }}>Confirm Remove</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(false)}>Cancel</button>
              </div>
            )}
            {shift && confirmDelete && (
              <div style={{display:'flex',gap:'0.375rem',alignItems:'center'}}>
                <button className="btn btn-sm" style={{background:'var(--danger)',color:'#fff',border:'none'}} onClick={async () => { await api.shifts.delete(shift.id); onSaved(); }}>Confirm Delete</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
            <div style={{display:'flex',gap:'0.5rem'}}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
          {shift && !confirmRemove && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} style={{background:'none',border:'none',color:'rgba(220,38,38,0.5)',fontSize:'0.75rem',cursor:'pointer',padding:0,textAlign:'left'}}>Delete shift entirely</button>
          )}
        </div>
      </div>
    </div>
  );
}
