import React, { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { api } from '../lib/api';

// ── CONTRACTS SCREEN (Lines + Queries) ───────────────────────────────────────
function ContractsScreen({ user }) {
  const [tab, setTab] = useState('lines');

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Contracts</div>
      </div>
      <div className="page-content">
        <div className="tabs" style={{marginBottom:'1.25rem'}}>
          <button className={`tab${tab==='lines'?' active':''}`} onClick={() => setTab('lines')}>Contract Lines</button>
          <button className={`tab${tab==='queries'?' active':''}`} onClick={() => setTab('queries')}>Queries</button>
        </div>
        {tab === 'lines' ? <ContractLines user={user} /> : <ContractQueries user={user} />}
      </div>
    </div>
  );
}

// ── CONTRACT LINES ────────────────────────────────────────────────────────────
function ContractLines({ user }) {
  const [lines, setLines] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLine, setEditLine] = useState(null);
  const [siteFilter, setSiteFilter] = useState('');

  async function load() {
    const [lr, sr] = await Promise.all([
      api.contracts.lines.list(siteFilter ? { site_id: siteFilter } : {}),
      api.sites.list(),
    ]);
    setLines(lr.data || []);
    setSites(sr.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [siteFilter]);

  const activeLines = lines.filter(l => l.active !== false);
  const totalRevenue = activeLines.reduce((s, l) => s + (l.recurring ? parseFloat(l.charge)||0 : 0), 0);
  const totalCost    = activeLines.reduce((s, l) => s + (l.recurring ? parseFloat(l.cost)||0 : 0), 0);
  const fmt = n => `£${parseFloat(n).toFixed(2)}`;

  const CATEGORIES = ['equipment_hire','installation','monitoring','maintenance','inspection','other'];

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <select className="input" style={{width:'180px'}} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
          <option value="">All sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditLine(null); setShowForm(true); }}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Add Line
        </button>
      </div>

      {/* Summary */}
      {activeLines.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
          <div className="stat-card"><div className="stat-value" style={{color:'var(--blue)'}}>{fmt(totalRevenue)}</div><div className="stat-label">Monthly Revenue</div></div>
          <div className="stat-card"><div className="stat-value" style={{color:'var(--danger)'}}>{fmt(totalCost)}</div><div className="stat-label">Monthly Cost</div></div>
          <div className="stat-card"><div className="stat-value" style={{color:totalRevenue-totalCost>=0?'var(--success)':'var(--danger)'}}>{fmt(totalRevenue-totalCost)}</div><div className="stat-label">Monthly GP</div></div>
        </div>
      )}

      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      : lines.length === 0 ? <div className="empty-state"><p>No contract lines yet</p></div>
      : (
        <table className="table">
          <thead><tr><th>Name</th><th>Site</th><th>Category</th><th>Cost</th><th>Charge</th><th>GP</th><th>Recurring</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id}>
                <td style={{fontWeight:500}}>{l.name}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{l.site?.name||'—'}</td>
                <td style={{fontSize:'0.8125rem',color:'var(--text-2)'}}>{l.category?.replace(/_/g,' ')}</td>
                <td style={{fontSize:'0.8125rem'}}>{fmt(l.cost)}</td>
                <td style={{fontSize:'0.8125rem'}}>{fmt(l.charge)}</td>
                <td style={{fontSize:'0.8125rem',fontWeight:600,color:(l.charge-l.cost)>=0?'var(--success)':'var(--danger)'}}>{fmt(l.charge-l.cost)}</td>
                <td><span className={`badge ${l.recurring?'badge-blue':'badge-neutral'}`}>{l.recurring?'Monthly':'One-off'}</span></td>
                <td><span className={`badge ${l.active!==false?'badge-success':'badge-neutral'}`}>{l.active!==false?'Active':'Inactive'}</span></td>
                <td style={{textAlign:'right',display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditLine(l); setShowForm(true); }}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => {
                    if (!window.confirm('Delete this contract line?')) return;
                    await api.contracts.lines.delete(l.id); load();
                  }}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <ContractLineModal
          line={editLine}
          sites={sites}
          categories={CATEGORIES}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function ContractLineModal({ line, sites, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: line?.name||'', site_id: line?.site_id||'',
    category: line?.category||'other', description: line?.description||'',
    cost: line?.cost||'', charge: line?.charge||'',
    recurring: line?.recurring !== false,
    start_date: line?.start_date||'', end_date: line?.end_date||'',
    notes: line?.notes||'',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    if (!form.name||!form.site_id) { setError('Name and site are required'); return; }
    try {
      setSaving(true);
      const payload = {...form, cost:parseFloat(form.cost)||0, charge:parseFloat(form.charge)||0, start_date:form.start_date||null, end_date:form.end_date||null};
      if (line) await api.contracts.lines.update(line.id, payload);
      else await api.contracts.lines.create(payload);
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'580px'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{line?'Edit Contract Line':'Add Contract Line'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Name</label><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. CCTV Monitoring" /></div>
          <div className="field"><label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">Select site</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Category</label>
            <select className="input" value={form.category} onChange={e=>f('category',e.target.value)}>
              {categories.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Our Cost (£/mo)</label><input type="number" step="0.01" className="input" value={form.cost} onChange={e=>f('cost',e.target.value)} /></div>
          <div className="field"><label className="label">Client Charge (£/mo)</label><input type="number" step="0.01" className="input" value={form.charge} onChange={e=>f('charge',e.target.value)} /></div>
          <div className="field"><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={e=>f('start_date',e.target.value)} /></div>
          <div className="field"><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={e=>f('end_date',e.target.value)} /></div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer'}}>
              <input type="checkbox" checked={form.recurring} onChange={e=>f('recurring',e.target.checked)} style={{width:'1rem',height:'1rem',accentColor:'var(--blue)'}} />
              <span className="label" style={{margin:0}}>Recurring monthly charge</span>
            </label>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── CONTRACT QUERIES ──────────────────────────────────────────────────────────
function ContractQueries({ user }) {
  const [queries, setQueries] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab] = useState('open');
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);

  async function load() {
    const [qr, sr] = await Promise.all([api.contracts.queries.list(), api.sites.list()]);
    setQueries(qr.data || []); setSites(sr.data || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = queries.filter(q => q.status === tab || (tab === 'open' && q.status !== 'resolved'));

  const priorityColor = { low:'badge-neutral', medium:'badge-warning', high:'badge-danger', critical:'badge-danger' };
  const CATEGORIES = ['missed_visit','officer_conduct','payment','response_time','access_issue','documentation','other'];

  async function respond(queryId) {
    if (!responseText.trim()) return;
    setResponding(true);
    try {
      await api.contracts.queries.respond(queryId, { text: responseText });
      setResponseText(''); load();
    } finally { setResponding(false); }
  }

  async function resolve(queryId) {
    await api.contracts.queries.respond(queryId, { text: 'Marked as resolved.', status: 'resolved' });
    load();
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
        <div className="tabs" style={{marginBottom:0}}>
          {[['open','Open'],['resolved','Resolved']].map(([val,label])=>(
            <button key={val} className={`tab${tab===val?' active':''}`} onClick={()=>setTab(val)}>{label}
              {val==='open'&&queries.filter(q=>q.status!=='resolved').length>0&&(
                <span style={{marginLeft:'0.375rem',background:'var(--danger)',color:'#fff',borderRadius:'999px',padding:'1px 5px',fontSize:'0.625rem'}}>{queries.filter(q=>q.status!=='resolved').length}</span>
              )}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <PlusIcon style={{width:'0.875rem',height:'0.875rem'}} /> Raise Query
        </button>
      </div>

      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
      : filtered.length === 0 ? <div className="empty-state"><p>No {tab} queries</p></div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          {filtered.map(q => (
            <div key={q.id} className="card" style={{borderLeft:`3px solid ${q.priority==='high'||q.priority==='critical'?'var(--danger)':q.priority==='medium'?'var(--warning)':'var(--border)'}`}}>
              <div onClick={() => setExpanded(expanded===q.id?null:q.id)} style={{cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.75rem',marginBottom:'0.375rem'}}>
                  <div style={{fontWeight:600}}>{q.subject}</div>
                  <div style={{display:'flex',gap:'0.375rem',flexShrink:0}}>
                    <span className={`badge ${priorityColor[q.priority]||'badge-neutral'}`}>{q.priority}</span>
                    <span className={`badge ${q.status==='resolved'?'badge-success':'badge-warning'}`}>{q.status}</span>
                  </div>
                </div>
                <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>
                  {q.site?.name||''}{q.site?' · ':''}
                  {q.category?.replace(/_/g,' ')} · {new Date(q.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>

              {expanded === q.id && (
                <div style={{marginTop:'0.875rem',paddingTop:'0.875rem',borderTop:'1px solid var(--border)'}}>
                  <p style={{fontSize:'0.875rem',color:'var(--text-2)',marginBottom:'0.875rem'}}>{q.description}</p>

                  {/* Responses */}
                  {(q.responses||[]).length > 0 && (
                    <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'0.875rem'}}>
                      {q.responses.map((r,i) => (
                        <div key={i} style={{padding:'0.625rem',background:r.from==='manager'?'var(--blue-light)':'var(--surface-2)',borderRadius:'6px',fontSize:'0.8125rem'}}>
                          <div style={{fontWeight:500,marginBottom:'0.25rem',color:r.from==='manager'?'var(--blue)':'var(--text-2)'}}>{r.name}</div>
                          <div>{r.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.status !== 'resolved' && (
                    <div>
                      <textarea className="input" rows={2} value={responseText} onChange={e=>setResponseText(e.target.value)} placeholder="Add a response..." style={{marginBottom:'0.5rem'}} />
                      <div style={{display:'flex',gap:'0.5rem'}}>
                        <button className="btn btn-primary btn-sm" onClick={() => respond(q.id)} disabled={responding||!responseText.trim()}>
                          {responding?'Sending...':'Respond'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => resolve(q.id)}>Mark Resolved</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <QueryFormModal sites={sites} categories={CATEGORIES} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function QueryFormModal({ sites, categories, onClose, onSaved }) {
  const [form, setForm] = useState({ site_id:'', category:'other', subject:'', description:'', priority:'medium' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  async function save() {
    if (!form.subject||!form.description) { setError('Subject and description required'); return; }
    try {
      setSaving(true);
      await api.contracts.queries.create({...form, site_id:form.site_id||null});
      onSaved();
    } catch(e){ setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Raise Contract Query</div><button className="modal-close" onClick={onClose}>×</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field"><label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>f('site_id',e.target.value)}>
              <option value="">All / General</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Category</label>
            <select className="input" value={form.category} onChange={e=>f('category',e.target.value)}>
              {categories.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={e=>f('priority',e.target.value)}>
              {['low','medium','high','critical'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Subject</label><input className="input" value={form.subject} onChange={e=>f('subject',e.target.value)} /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label className="label">Description</label><textarea className="input" rows={4} value={form.description} onChange={e=>f('description',e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Raise Query'}</button>
        </div>
      </div>
    </div>
  );
}

export { ContractsScreen };
