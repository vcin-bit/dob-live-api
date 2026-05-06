import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function DocumentsScreen({ user }) {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    api.sites.list().then(r => setSites(r.data || []));
  }, []);

  useEffect(() => {
    if (!selectedSite) { setFolders([]); setDocuments([]); return; }
    setLoading(true);
    Promise.all([
      api.folders.list({ site_id: selectedSite }),
      api.folders.documents.list({ site_id: selectedSite }),
    ]).then(([fr, dr]) => {
      setFolders(fr.data || []);
      setDocuments(dr.data || []);
    }).finally(() => setLoading(false));
  }, [selectedSite]);

  const folderDocs = selectedFolder
    ? documents.filter(d => d.folder_id === selectedFolder.id)
    : documents.filter(d => !d.folder_id);

  async function createFolder() {
    if (!newFolderName.trim() || !selectedSite) return;
    try {
      await api.folders.create({ site_id: selectedSite, name: newFolderName });
      setNewFolderName(''); setShowFolderForm(false);
      const r = await api.folders.list({ site_id: selectedSite });
      setFolders(r.data || []);
    } catch (e) { setError(e.message); }
  }

  async function deleteFolder(id) {
    if (!window.confirm('Delete this folder and all its documents?')) return;
    await api.folders.delete(id);
    setSelectedFolder(null);
    const r = await api.folders.list({ site_id: selectedSite });
    setFolders(r.data || []);
  }

  async function deleteDocument(id) {
    if (!window.confirm('Delete this document?')) return;
    await api.folders.documents.delete(id);
    const r = await api.folders.documents.list({ site_id: selectedSite });
    setDocuments(r.data || []);
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Documents</div>
        <select className="input" style={{width:'200px'}} value={selectedSite} onChange={e => { setSelectedSite(e.target.value); setSelectedFolder(null); }}>
          <option value="">Select site...</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {!selectedSite ? (
          <div className="empty-state"><p>Select a site to view documents</p></div>
        ) : loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'clamp(150px, 25vw, 220px) 1fr',gap:'1rem'}}>
            {/* Folder sidebar */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                <div className="section-title">Folders</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowFolderForm(true)}>+ New</button>
              </div>
              {showFolderForm && (
                <div style={{marginBottom:'0.5rem',display:'flex',gap:'0.5rem'}}>
                  <input className="input" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} placeholder="Folder name" onKeyDown={e=>e.key==='Enter'&&createFolder()} />
                  <button className="btn btn-primary btn-sm" onClick={createFolder}>Add</button>
                </div>
              )}
              <div
                onClick={() => setSelectedFolder(null)}
                style={{padding:'0.5rem 0.625rem',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'0.875rem',fontWeight: !selectedFolder?600:400,background:!selectedFolder?'var(--blue-light)':'transparent',color:!selectedFolder?'var(--blue)':'var(--text)',marginBottom:'0.25rem'}}
              >
                All Documents
              </div>
              {folders.map(f => (
                <div key={f.id} style={{display:'flex',alignItems:'center',gap:'0.375rem',padding:'0.5rem 0.625rem',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'0.875rem',fontWeight:selectedFolder?.id===f.id?600:400,background:selectedFolder?.id===f.id?'var(--blue-light)':'transparent',color:selectedFolder?.id===f.id?'var(--blue)':'var(--text)',marginBottom:'0.25rem'}}
                  onClick={() => setSelectedFolder(f)}>
                  <span style={{flex:1}}>{f.name}</span>
                  <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',padding:'0 2px',fontSize:'0.75rem'}}>x</button>
                </div>
              ))}
            </div>

            {/* Documents list */}
            <div className="card">
              <div className="section-header" style={{marginBottom:'1rem'}}>
                <div className="section-title">{selectedFolder ? selectedFolder.name : 'All Documents'}</div>
                <DocumentUploadButton siteId={selectedSite} folderId={selectedFolder?.id} onUploaded={() => api.folders.documents.list({site_id:selectedSite}).then(r=>setDocuments(r.data||[]))} />
              </div>
              {folderDocs.length === 0 ? (
                <div className="empty-state"><p>No documents yet</p></div>
              ) : (
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
                  <tbody>
                    {folderDocs.map(d => (
                      <tr key={d.id}>
                        <td style={{fontWeight:500}}>{d.name}</td>
                        <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.mime_type||'—'}</td>
                        <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{d.file_size ? `${(d.file_size/1024).toFixed(0)} KB` : '—'}</td>
                        <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{new Date(d.created_at).toLocaleDateString('en-GB')}</td>
                        <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                          <a href={d.storage_path?.startsWith('http') ? d.storage_path : `https://bxesqjzkuredqzvepomn.supabase.co/storage/v1/object/public/documents/${d.storage_path}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View</a>
                          <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>deleteDocument(d.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentUploadButton({ siteId, folderId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload to Supabase storage via signed URL approach
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bxesqjzkuredqzvepomn.supabase.co';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const path = `${siteId}/${folderId || 'root'}/${Date.now()}-${file.name}`;
      
      // Upload via Supabase storage REST API
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      
      // Register in database
      await api.folders.documents.create({
        site_id: siteId,
        folder_id: folderId || null,
        name: file.name,
        original_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      });
      onUploaded();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <input type="file" ref={inputRef} style={{display:'none'}} onChange={handleFile} />
      <button className="btn btn-primary btn-sm" onClick={() => inputRef.current.click()} disabled={!siteId||uploading}>
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </>
  );
}

// ── PATROL ROUTES ─────────────────────────────────────────────────────────────
function PatrolRoutesScreen({ user }) {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRoute, setEditRoute] = useState(null);

  useEffect(() => { api.sites.list().then(r => setSites(r.data||[])); }, []);

  async function load() {
    if (!selectedSite) return;
    setLoading(true);
    const r = await api.patrols.getRoutes(selectedSite);
    setRoutes(r.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [selectedSite]);

  async function deleteRoute(id) {
    if (!window.confirm('Delete this patrol route?')) return;
    await api.patrols.deleteRoute(id);
    load();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Patrol Routes</div>
      </div>
      <div className="page-content">
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center',marginBottom:'1.25rem',flexWrap:'wrap'}}>
          <select className="input" style={{width:'250px',maxWidth:'100%'}} value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
            <option value="">Select site...</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!selectedSite} onClick={() => { setEditRoute(null); setShowForm(true); }}>
            <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Route
          </button>
        </div>
        {!selectedSite ? (
          <div className="empty-state"><p>Select a site to manage patrol routes</p></div>
        ) : loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : routes.length === 0 ? (
          <div className="empty-state"><p>No patrol routes for this site</p></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {routes.map(route => (
              <div key={route.id} className="card">
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:'0.9375rem'}}>{route.name}</div>
                    {route.instructions && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginTop:'0.25rem'}}>{route.instructions}</div>}
                    <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                      {(route.checkpoints||[]).map((cp, i) => (
                        <span key={cp.id} className="badge badge-navy">{i+1}. {cp.name}</span>
                      ))}
                      {(route.checkpoints||[]).length === 0 && <span style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>No checkpoints</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'0.5rem',flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditRoute(route); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => deleteRoute(route.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && (
        <PatrolRouteFormModal
          route={editRoute}
          siteId={selectedSite}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function PatrolRouteFormModal({ route, siteId, onClose, onSaved }) {
  const [name, setName] = useState(route?.name || '');
  const [instructions, setInstructions] = useState(route?.instructions || '');
  const [checkpoints, setCheckpoints] = useState(route?.checkpoints?.map(c => ({ name: c.name, instructions: c.instructions || '', what_to_look_for: c.what_to_look_for || '' })) || [{ name: '', instructions: '', what_to_look_for: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function addCheckpoint() { setCheckpoints(cp => [...cp, { name: '', instructions: '', what_to_look_for: '' }]); }
  function removeCheckpoint(i) { setCheckpoints(cp => cp.filter((_, j) => j !== i)); }
  function updateCheckpoint(i, field, val) { setCheckpoints(cp => cp.map((c, j) => j === i ? {...c, [field]: val} : c)); }

  async function save() {
    if (!name.trim()) { setError('Route name required'); return; }
    const validCps = checkpoints.filter(c => c.name.trim());
    try {
      setSaving(true);
      if (route) {
        await api.patrols.update(route.id, { name, instructions, checkpoints: validCps });
      } else {
        await api.patrols.create({ site_id: siteId, name, instructions, checkpoints: validCps });
      }
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'600px'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{route ? 'Edit Route' : 'New Patrol Route'}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field">
          <label className="label">Route Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Perimeter Check" />
        </div>
        <div className="field">
          <label className="label">Instructions</label>
          <textarea className="input" rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="General instructions for this route..." />
        </div>
        <div style={{marginBottom:'1rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <label className="label" style={{margin:0}}>Checkpoints</label>
            <button className="btn btn-ghost btn-sm" onClick={addCheckpoint}>+ Add</button>
          </div>
          {checkpoints.map((cp, i) => (
            <div key={i} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'0.75rem',marginBottom:'0.625rem'}}>
              <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginBottom:'0.5rem'}}>
                <div style={{width:22,height:22,borderRadius:'50%',background:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#fff',flexShrink:0}}>{i+1}</div>
                <input className="input" style={{flex:1}} value={cp.name} onChange={e => updateCheckpoint(i, 'name', e.target.value)} placeholder={`Checkpoint ${i+1} name e.g. Unit 12 North Gate`} />
                <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',flexShrink:0}} onClick={() => removeCheckpoint(i)}>✕</button>
              </div>
              <input className="input" style={{marginBottom:'0.375rem'}} value={cp.instructions} onChange={e => updateCheckpoint(i, 'instructions', e.target.value)} placeholder="Navigation instructions e.g. Turn left at reception, take stairs to 2nd floor" />
              <textarea className="input" rows={2} value={cp.what_to_look_for} onChange={e => updateCheckpoint(i, 'what_to_look_for', e.target.value)} placeholder="What to check / look for e.g. Check fire exits are clear, verify alarm panel shows green, ensure server room door is locked" style={{resize:'vertical'}} />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Route'}</button>
        </div>
      </div>
    </div>
  );
}

// ── SHIFT PATTERNS ────────────────────────────────────────────────────────────
function ShiftPatternsScreen({ user }) {
  const [patterns, setPatterns] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPattern, setEditPattern] = useState(null);
  const [applyPattern, setApplyPattern] = useState(null);
  const [applyMonth, setApplyMonth] = useState(new Date().toISOString().slice(0,7));
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  async function load() {
    const [pr, sr] = await Promise.all([api.patterns.list(), api.sites.list()]);
    setPatterns(pr.data || []);
    setSites(sr.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const DAYS = [['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Shift Patterns</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditPattern(null); setShowForm(true); }}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Pattern
        </button>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : patterns.length === 0 ? <div className="empty-state"><p>No shift patterns yet</p></div>
        : (
          <table className="table">
            <thead><tr><th>Name</th><th>Site</th><th>Days</th><th>Hours</th><th>Pay Rate</th><th>Charge Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {patterns.map(p => (
                <tr key={p.id}>
                  <td style={{fontWeight:500}}>{p.name}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{p.site?.name||'—'}</td>
                  <td style={{fontSize:'0.8125rem'}}>
                    <div style={{display:'flex',gap:'2px',flexWrap:'wrap'}}>
                      {DAYS.map(([d,l]) => (
                        <span key={d} style={{padding:'1px 5px',borderRadius:'3px',fontSize:'0.6875rem',fontWeight:600,background:(p.days||[]).includes(d)?'var(--blue)':'var(--surface-2)',color:(p.days||[]).includes(d)?'#fff':'var(--text-3)'}}>{l}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{p.start_time}–{p.end_time}</td>
                  <td style={{fontSize:'0.8125rem'}}>{p.pay_rate ? `£${p.pay_rate}/h` : '—'}</td>
                  <td style={{fontSize:'0.8125rem'}}>{p.charge_rate ? `£${p.charge_rate}/h` : '—'}</td>
                  <td><span className={`badge ${p.active!==false?'badge-success':'badge-neutral'}`}>{p.active!==false?'Active':'Inactive'}</span></td>
                  <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                    <button className="btn btn-sm" style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981',fontWeight:600}} onClick={() => { setApplyPattern(p); setApplyResult(null); }}>Apply to Roster</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditPattern(p); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => { if(window.confirm('Delete pattern?')){ await api.patterns.delete(p.id); load(); }}}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <ShiftPatternFormModal pattern={editPattern} sites={sites} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      {/* Apply pattern to roster modal */}
      {applyPattern && (
        <div className="modal-overlay" onClick={() => setApplyPattern(null)}>
          <div className="modal" style={{maxWidth:'400px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Apply to Roster</div>
              <button className="modal-close" onClick={() => setApplyPattern(null)}>×</button>
            </div>
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontWeight:600,marginBottom:'0.25rem'}}>{applyPattern.name}</div>
              <div style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{applyPattern.site?.name} · {applyPattern.start_time}–{applyPattern.end_time} · {(applyPattern.days||[]).join(', ')}</div>
            </div>
            <div className="field" style={{marginBottom:'1rem'}}>
              <label className="label">Month</label>
              <input type="month" className="input" value={applyMonth} onChange={e => setApplyMonth(e.target.value)} />
            </div>
            {applyResult && (
              <div className={`alert ${applyResult.error ? 'alert-danger' : 'alert-success'}`} style={{marginBottom:'1rem'}}>
                {applyResult.error || applyResult.message}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApplyPattern(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={applying} onClick={async () => {
                setApplying(true); setApplyResult(null);
                try {
                  const [year, month] = applyMonth.split('-').map(Number);
                  const daysInMonth = new Date(year, month, 0).getDate();
                  const dayMap = { mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sun:0 };
                  const patternDays = (applyPattern.days||[]).map(d => dayMap[d]);
                  let created = 0;
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month - 1, day);
                    if (!patternDays.includes(date.getDay())) continue;
                    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
                    const startDt = `${dateStr}T${applyPattern.start_time}:00+01:00`;
                    let endDt = `${dateStr}T${applyPattern.end_time}:00+01:00`;
                    if (new Date(endDt) <= new Date(startDt)) {
                      const nextDay = new Date(date); nextDay.setDate(nextDay.getDate() + 1);
                      endDt = `${nextDay.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })}T${applyPattern.end_time}:00+01:00`;
                    }
                    await api.shifts.create({
                      site_id: applyPattern.site_id,
                      start_time: startDt, end_time: endDt,
                      pay_rate: applyPattern.pay_rate ? parseFloat(applyPattern.pay_rate) : null,
                      charge_rate: applyPattern.charge_rate ? parseFloat(applyPattern.charge_rate) : null,
                      notes: `From pattern: ${applyPattern.name}`,
                    });
                    created++;
                  }
                  setApplyResult({ message: `Created ${created} shifts for ${applyMonth}` });
                } catch (e) { setApplyResult({ error: e.message }); }
                finally { setApplying(false); }
              }}>
                {applying ? 'Creating shifts...' : 'Generate Shifts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftPatternFormModal({ pattern, sites, onClose, onSaved }) {
  const DAYS = [['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];
  const [form, setForm] = useState({
    name: pattern?.name||'', site_id: pattern?.site_id||'',
    days: pattern?.days||[], start_time: pattern?.start_time||'07:00',
    end_time: pattern?.end_time||'19:00', pay_rate: pattern?.pay_rate||'',
    charge_rate: pattern?.charge_rate||'', notes: pattern?.notes||'',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  function toggleDay(d) { setForm(p=>({...p,days:p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d]})); }

  async function save() {
    if (!form.name||!form.site_id||form.days.length===0) { setError('Name, site and at least one day required'); return; }
    try {
      setSaving(true);
      const payload = {...form, pay_rate: form.pay_rate||null, charge_rate: form.charge_rate||null};
      if (pattern) await api.patterns.update(pattern.id, payload);
      else await api.patterns.create(payload);
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{pattern?'Edit Pattern':'New Shift Pattern'}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Pattern Name</label><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Weekday Nights" /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">Select site</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label className="label">Days</label>
            <div style={{display:'flex',gap:'0.375rem'}}>
              {DAYS.map(([d,l]) => (
                <button key={d} type="button" onClick={()=>toggleDay(d)} style={{padding:'0.375rem 0.625rem',borderRadius:'4px',border:'1px solid',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',background:form.days.includes(d)?'var(--blue)':'var(--surface)',color:form.days.includes(d)?'#fff':'var(--text-2)',borderColor:form.days.includes(d)?'var(--blue)':'var(--border)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Start Time</label><input type="time" className="input" value={form.start_time} onChange={e=>f('start_time',e.target.value)} /></div>
          <div className="field"><label className="label">End Time</label><input type="time" className="input" value={form.end_time} onChange={e=>f('end_time',e.target.value)} /></div>
          <div className="field"><label className="label">Pay Rate (£/hr)</label><input type="number" step="0.01" className="input" value={form.pay_rate} onChange={e=>f('pay_rate',e.target.value)} /></div>
          <div className="field"><label className="label">Charge Rate (£/hr)</label><input type="number" step="0.01" className="input" value={form.charge_rate} onChange={e=>f('charge_rate',e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── RATES ─────────────────────────────────────────────────────────────────────
function RatesScreen({ user }) {
  const [rates, setRates] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [rr, ur, sr] = await Promise.all([api.rates.list(), api.users.list(), api.sites.list()]);
    setRates(rr.data||[]);
    setOfficers((ur.data||[]).filter(u=>u.role==='OFFICER'));
    setSites(sr.data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Officer Rates</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}><PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Rate</button>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : rates.length===0 ? <div className="empty-state"><p>No rates configured</p></div>
        : (
          <table className="table">
            <thead><tr><th>Officer</th><th>Site</th><th>Role</th><th>Rate</th><th>From</th><th></th></tr></thead>
            <tbody>
              {rates.map(r=>(
                <tr key={r.id}>
                  <td style={{fontWeight:500}}>{r.officer?`${r.officer.first_name} ${r.officer.last_name}`:'—'}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{r.site?.name||'All sites'}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{r.role_label||'—'}</td>
                  <td style={{fontWeight:600}}>£{r.hourly_rate}/hr</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{new Date(r.effective_from).toLocaleDateString('en-GB')}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async()=>{ if(window.confirm('Remove this rate?')){ await api.rates.delete(r.id); load(); }}}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <RateFormModal officers={officers} sites={sites} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();}} />}
    </div>
  );
}

function RateFormModal({ officers, sites, onClose, onSaved }) {
  const [form, setForm] = useState({ officer_id:'', site_id:'', hourly_rate:'', role_label:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    if (!form.officer_id||!form.hourly_rate) { setError('Officer and rate required'); return; }
    try { setSaving(true); await api.rates.create({...form, site_id:form.site_id||null}); onSaved(); }
    catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Add Officer Rate</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Officer</label>
            <select className="input" value={form.officer_id} onChange={e=>f('officer_id',e.target.value)}>
              <option value="">Select officer</option>
              {officers.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Site (optional)</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Hourly Rate (£)</label><input type="number" step="0.01" className="input" value={form.hourly_rate} onChange={e=>f('hourly_rate',e.target.value)} placeholder="e.g. 13.50" /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Role Label</label><input className="input" value={form.role_label} onChange={e=>f('role_label',e.target.value)} placeholder="e.g. Door Supervisor" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save Rate'}</button>
        </div>
      </div>
    </div>
  );
}

// ── ALERTS ────────────────────────────────────────────────────────────────────
function AlertsScreen({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('open');

  async function load() {
    const [ar, sr] = await Promise.all([api.alerts.list(), api.sites.list()]);
    setAlerts(ar.data||[]);
    setSites(sr.data||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const filtered = alerts.filter(a => a.status === tab);
  const severityBadge = { low:'badge-neutral', medium:'badge-warning', high:'badge-danger', critical:'badge-danger' };

  async function resolve(id) {
    await api.alerts.update(id, { status:'resolved' });
    load();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Alerts</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}><PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Raise Alert</button>
      </div>
      <div className="page-content">
        <div className="tabs">
          {[['open','Open'],['resolved','Resolved']].map(([val,label])=>(
            <button key={val} className={`tab${tab===val?' active':''}`} onClick={()=>setTab(val)}>{label}</button>
          ))}
        </div>
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : filtered.length===0 ? <div className="empty-state"><p>No {tab} alerts</p></div>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {filtered.map(a=>(
              <div key={a.id} className="card" style={{borderLeft:`3px solid ${a.severity==='high'||a.severity==='critical'?'var(--danger)':a.severity==='medium'?'var(--warning)':'var(--border)'}`}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
                      <span style={{fontWeight:600}}>{a.title}</span>
                      <span className={`badge ${severityBadge[a.severity]||'badge-neutral'}`}>{a.severity}</span>
                    </div>
                    {a.description && <div style={{fontSize:'0.875rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>{a.description}</div>}
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>
                      {a.site?.name||''}{a.site?' · ':''}{new Date(a.created_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  {tab==='open' && (
                    <button className="btn btn-secondary btn-sm" onClick={()=>resolve(a.id)}>Resolve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && <AlertFormModal sites={sites} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();}} />}
    </div>
  );
}

function AlertFormModal({ sites, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', description:'', site_id:'', severity:'medium' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    if (!form.title.trim()) { setError('Title required'); return; }
    try { setSaving(true); await api.alerts.create({...form, site_id:form.site_id||null}); onSaved(); }
    catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Raise Alert</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Title</label><input className="input" value={form.title} onChange={e=>f('title',e.target.value)} placeholder="Brief description of the issue" /></div>
        <div className="field"><label className="label">Details</label><textarea className="input" rows={3} value={form.description} onChange={e=>f('description',e.target.value)} placeholder="Additional details..." /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Severity</label>
            <select className="input" value={form.severity} onChange={e=>f('severity',e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Raise Alert'}</button>
        </div>
      </div>
    </div>
  );
}

// ── COMPANY POLICIES ──────────────────────────────────────────────────────────
function PoliciesScreen({ user }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const canEdit = ['COMPANY','SUPER_ADMIN'].includes(user.role);

  useEffect(() => {
    api.policies.get().then(r => { setSections(r.data?.sections || []); setLoading(false); });
  }, []);

  function addSection() { setSections(s => [...s, { title:'', content:'' }]); }
  function updateSection(i, field, val) { setSections(s => s.map((sec,j) => j===i ? {...sec,[field]:val} : sec)); }
  function removeSection(i) { setSections(s => s.filter((_,j) => j!==i)); }

  async function save() {
    try {
      setSaving(true); setError(null);
      await api.policies.update(sections);
      setSuccess(true); setTimeout(()=>setSuccess(false), 2000);
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Company Policies</div>
        {canEdit && (
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="btn btn-ghost btn-sm" onClick={addSection}>+ Add Section</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save Policies'}</button>
          </div>
        )}
      </div>
      <div className="page-content">
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>Policies saved</div>}
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : sections.length===0 ? (
          <div className="empty-state">
            <p>No policy sections yet</p>
            {canEdit && <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={addSection}>Add First Section</button>}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {sections.map((sec,i) => (
              <div key={i} className="card">
                {canEdit ? (
                  <>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                      <input className="input" value={sec.title} onChange={e=>updateSection(i,'title',e.target.value)} placeholder="Section title" style={{fontWeight:600,fontSize:'1rem'}} />
                      <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',marginLeft:'0.5rem'}} onClick={()=>removeSection(i)}>Remove</button>
                    </div>
                    <textarea className="input" rows={6} value={sec.content} onChange={e=>updateSection(i,'content',e.target.value)} placeholder="Policy content..." />
                  </>
                ) : (
                  <>
                    <div style={{fontWeight:600,marginBottom:'0.5rem'}}>{sec.title}</div>
                    <div style={{fontSize:'0.875rem',color:'var(--text-2)',whiteSpace:'pre-line'}}>{sec.content}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ── SITE INSTRUCTIONS (MANAGER) ───────────────────────────────────────────────
function SiteInstructionsScreen({ user }) {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { api.sites.list().then(r => setSites(r.data||[])); }, []);

  useEffect(() => {
    if (!selectedSite) { setSections([]); return; }
    setLoading(true);
    api.instructions.get(selectedSite).then(r => {
      setSections(r.data?.sections || []);
      setLoading(false);
    });
  }, [selectedSite]);

  function addSection() { setSections(s => [...s, { title:'', content:'' }]); }
  function update(i, field, val) { setSections(s => s.map((sec,j) => j===i ? {...sec,[field]:val} : sec)); }
  function remove(i) { setSections(s => s.filter((_,j) => j!==i)); }

  async function save() {
    if (!selectedSite) return;
    try {
      setSaving(true); setError(null);
      await api.instructions.update(selectedSite, sections);
      setSuccess(true); setTimeout(()=>setSuccess(false), 2000);
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Site Instructions</div>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <select className="input" style={{width:'200px'}} value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
            <option value="">Select site...</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedSite && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={addSection}>+ Section</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
            </>
          )}
        </div>
      </div>
      <div className="page-content">
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>Instructions saved</div>}
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        {!selectedSite ? (
          <div className="empty-state"><p>Select a site to edit its instructions</p></div>
        ) : loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {sections.length === 0 && (
              <div className="empty-state">
                <p>No instructions yet</p>
                <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={addSection}>Add First Section</button>
              </div>
            )}
            {sections.map((sec,i) => (
              <div key={i} className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                  <input className="input" value={sec.title} onChange={e=>update(i,'title',e.target.value)} placeholder="Section title" style={{fontWeight:600}} />
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',marginLeft:'0.5rem'}} onClick={()=>remove(i)}>Remove</button>
                </div>
                <textarea className="input" rows={5} value={sec.content} onChange={e=>update(i,'content',e.target.value)} placeholder="Instructions content..." />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
function MessagesScreen({ user }) {
  const [messages, setMessages] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [mr, ur] = await Promise.all([api.messages.list(), api.users.list()]);
    setMessages(mr.data||[]);
    setOfficers((ur.data||[]).filter(u => u.id !== user.id));
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Messages</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> New Message
        </button>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        : messages.length===0 ? <div className="empty-state"><p>No messages yet</p></div>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
            {messages.map(m => (
              <div key={m.id} className="card" style={{padding:'0.875rem'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
                      <span style={{fontWeight:600,fontSize:'0.875rem'}}>
                        {m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'Unknown'}
                      </span>
                      {m.recipient && (
                        <span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>
                          to {m.recipient.first_name} {m.recipient.last_name}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:'0.875rem',color:'var(--text-2)'}}>{m.body}</div>
                  </div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>
                    {new Date(m.created_at||'').toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && <NewMessageModal officers={officers} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();}} />}
    </div>
  );
}

function NewMessageModal({ officers, onClose, onSaved }) {
  const [form, setForm] = useState({ recipient_id:'', body:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    if (!form.body.trim()) { setError('Message body required'); return; }
    try {
      setSaving(true);
      await api.messages.create({ recipient_id: form.recipient_id||null, body: form.body });
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">New Message</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">To (leave blank for all)</label>
          <select className="input" value={form.recipient_id} onChange={e=>setForm(f=>({...f,recipient_id:e.target.value}))}>
            <option value="">All officers</option>
            {officers.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
          </select>
        </div>
        <div className="field"><label className="label">Message</label>
          <textarea className="input" rows={4} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} placeholder="Your message..." />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving}>{saving?'Sending...':'Send'}</button>
        </div>
      </div>
    </div>
  );
}

export { DocumentsScreen };
export { PatrolRoutesScreen };
export { ShiftPatternsScreen };
export { RatesScreen };
export { AlertsScreen };
export { PoliciesScreen };
export { SiteInstructionsScreen };
export { MessagesScreen };
