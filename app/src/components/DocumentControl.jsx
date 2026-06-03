import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

const STATUS_CHIP = {
  Planned: { bg: '#f3f4f6', color: '#374151' },
  'In Progress': { bg: '#dbeafe', color: '#1e40af' },
  Approved: { bg: '#dcfce7', color: '#166534' },
  Superseded: { bg: '#e0e7ff', color: '#3730a3' },
  Archived: { bg: '#f3f4f6', color: '#9ca3af' },
};
const AUDIENCE_CHIP = {
  Officer: { bg: '#fef3c7', color: '#92400e' },
  Client: { bg: '#dbeafe', color: '#1e40af' },
  Internal: { bg: '#f3f4f6', color: '#374151' },
};

export default function DocumentControl({ user }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [res, alertRes] = await Promise.all([
        api.controlledDocs.list(),
        api.controlledDocs.alerts({ count_only: 'true' }).catch(() => ({ count: 0 })),
      ]);
      setDocs(res.data || []);
      setAlertCount(alertRes.count || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (viewing) return <DocDetail docId={viewing} user={user} onBack={() => { setViewing(null); load(); }} />;

  const filtered = docs.filter(d => !filter || d.doc_number.includes(filter) || d.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Document Control{alertCount > 0 && <span style={{marginLeft:'0.5rem',padding:'2px 8px',borderRadius:'10px',fontSize:'0.6875rem',fontWeight:700,background:'#fee2e2',color:'#991b1b'}}>{alertCount} due</span>}</div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search..." className="input" style={{width:'160px',fontSize:'0.8125rem'}} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Document</button>
        </div>
      </div>
      <div className="page-content">
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div> : (
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table className="table" style={{margin:0,fontSize:'0.8125rem'}}>
              <thead>
                <tr>
                  <th style={{padding:'0.625rem 0.75rem'}}>Doc #</th>
                  <th>Title</th>
                  <th style={{textAlign:'center'}}>Rev</th>
                  <th>Category</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} style={{textAlign:'center',padding:'2rem',color:'var(--text-3)'}}>No documents found</td></tr>}
                {filtered.map(d => {
                  const sc = STATUS_CHIP[d.status] || STATUS_CHIP.Planned;
                  const ac = AUDIENCE_CHIP[d.audience] || AUDIENCE_CHIP.Internal;
                  const overdue = d.review_date && d.status === 'Approved' && d.review_date < new Date().toISOString().split('T')[0];
                  return (
                    <tr key={d.id} onClick={() => setViewing(d.id)} style={{cursor:'pointer',background: overdue ? 'rgba(220,38,38,0.03)' : 'transparent'}}>
                      <td style={{padding:'0.5rem 0.75rem',fontWeight:600,fontSize:'0.75rem',color:'var(--blue)',whiteSpace:'nowrap'}}>{d.doc_number}</td>
                      <td style={{fontWeight:500}}>{d.title}</td>
                      <td style={{textAlign:'center'}}>{d.revision}</td>
                      <td style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{d.category}</td>
                      <td><span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'0.6875rem',fontWeight:600,...ac}}>{d.audience}</span></td>
                      <td><span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'0.6875rem',fontWeight:600,...sc}}>{d.status}</span></td>
                      <td style={{fontSize:'0.75rem',color: overdue ? '#dc2626' : 'var(--text-3)',fontWeight: overdue ? 700 : 400}}>{d.review_date ? new Date(d.review_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'}) : '—'}</td>
                      <td style={{fontSize:'0.75rem',color:'var(--text-2)'}}>{d.owner ? `${d.owner.first_name} ${d.owner.last_name?.[0]}.` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showCreate && <CreateDocModal user={user} onClose={() => setShowCreate(false)} onCreated={(d) => { setShowCreate(false); load(); if (d?.id) setViewing(d.id); }} />}
    </div>
  );
}

// ── Document Detail ─────────────────────────────────────────────────────────
function DocDetail({ docId, user, onBack }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ackData, setAckData] = useState(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function loadDoc() {
    setLoading(true);
    try {
      const res = await api.controlledDocs.get(docId);
      setDoc(res.data);
      if (res.data?.audience === 'Officer' && res.data?.status === 'Approved') {
        const ackRes = await api.controlledDocs.acknowledgements(docId).catch(() => null);
        if (ackRes) setAckData(ackRes);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadDoc(); }, [docId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { await api.controlledDocs.upload(docId, file); loadDoc(); }
    catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  async function changeStatus(status) {
    try { await api.controlledDocs.setStatus(docId, status); loadDoc(); }
    catch (e) { alert(e.message); }
  }

  async function revise() {
    if (!confirm('Create new revision? Current revision will be superseded.')) return;
    try {
      const res = await api.controlledDocs.revise(docId);
      if (res.data?.id) { onBack(); }
    } catch (e) { alert(e.message); }
  }

  async function download() {
    try {
      const res = await api.controlledDocs.download(docId);
      if (res?.url) window.open(res.url, '_blank');
      else alert('No file uploaded yet');
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>;
  if (!doc) return null;

  const sc = STATUS_CHIP[doc.status] || STATUS_CHIP.Planned;
  const canEdit = ['SUPER_ADMIN','COMPANY','OPS_MANAGER','FD'].includes(user.role);
  const canApprove = ['SUPER_ADMIN','COMPANY','FD'].includes(user.role);

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <div className="topbar-title" style={{margin:0}}>{doc.doc_number}</div>
          <span style={{padding:'3px 8px',borderRadius:'4px',fontSize:'0.6875rem',fontWeight:600,...sc}}>{doc.status}</span>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {doc.storage_path && <button className="btn btn-secondary btn-sm" onClick={download}>View PDF</button>}
          {canEdit && doc.status !== 'Superseded' && doc.status !== 'Archived' && (
            <>
              <input type="file" ref={fileRef} onChange={handleUpload} accept=".pdf,.doc,.docx" style={{display:'none'}} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload File'}</button>
            </>
          )}
        </div>
      </div>
      <div className="page-content">
        {/* Title + meta */}
        <div className="card" style={{marginBottom:'1rem'}}>
          <div style={{fontWeight:700,fontSize:'1.125rem',marginBottom:'0.5rem'}}>{doc.title}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:'0.5rem',fontSize:'0.8125rem',color:'var(--text-2)'}}>
            <div><strong>Revision:</strong> {doc.revision}</div>
            <div><strong>Category:</strong> {doc.category}</div>
            <div><strong>Audience:</strong> {doc.audience}</div>
            <div><strong>Owner:</strong> {doc.owner ? `${doc.owner.first_name} ${doc.owner.last_name}` : '—'}</div>
            <div><strong>Issue Date:</strong> {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('en-GB') : '—'}</div>
            <div><strong>Review Date:</strong> {doc.review_date ? new Date(doc.review_date).toLocaleDateString('en-GB') : '—'}</div>
            {doc.file_name && <div><strong>File:</strong> {doc.file_name}</div>}
          </div>
          {doc.description && <div style={{marginTop:'0.5rem',fontSize:'0.8125rem',color:'var(--text-2)'}}>{doc.description}</div>}
        </div>

        {/* Status actions */}
        {canEdit && (
          <div className="card" style={{marginBottom:'1rem',display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-3)',marginRight:'0.5rem'}}>Change Status:</span>
            {doc.status === 'Planned' && <button className="btn btn-sm" style={{background:'#dbeafe',border:'1px solid #93c5fd',color:'#1e40af'}} onClick={() => changeStatus('In Progress')}>Start Progress</button>}
            {(doc.status === 'Planned' || doc.status === 'In Progress') && canApprove && doc.storage_path && (
              <button className="btn btn-primary btn-sm" onClick={() => changeStatus('Approved')}>Approve</button>
            )}
            {doc.status === 'Approved' && canApprove && <button className="btn btn-sm" style={{background:'#fef3c7',border:'1px solid #f59e0b',color:'#92400e'}} onClick={revise}>New Revision</button>}
            {doc.status !== 'Archived' && doc.status !== 'Superseded' && canApprove && (
              <button className="btn btn-ghost btn-sm" style={{color:'var(--text-3)'}} onClick={() => changeStatus('Archived')}>Archive</button>
            )}
          </div>
        )}

        {/* Acknowledgements (Officer-audience Approved docs) */}
        {ackData && doc.audience === 'Officer' && doc.status === 'Approved' && (
          <div className="card" style={{marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
              <div className="section-title" style={{margin:0}}>Officer Acknowledgements</div>
              <span style={{fontSize:'0.8125rem',fontWeight:600,color: ackData.acknowledged === ackData.total ? '#16a34a' : '#f59e0b'}}>{ackData.acknowledged}/{ackData.total} acknowledged</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.25rem'}}>
              {(ackData.data || []).map(o => (
                <div key={o.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.375rem 0',borderBottom:'1px solid var(--border)',fontSize:'0.8125rem'}}>
                  <span>{o.first_name} {o.last_name}</span>
                  {o.acknowledged ? (
                    <span style={{color:'#16a34a',fontWeight:600,fontSize:'0.75rem'}}>{new Date(o.acknowledged_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                  ) : (
                    <span style={{color:'#9ca3af',fontSize:'0.75rem'}}>Outstanding</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit trail */}
        {doc.audit?.length > 0 && (
          <div className="card">
            <div className="section-title">Audit Trail</div>
            <div style={{fontSize:'0.75rem',color:'var(--text-2)'}}>
              {doc.audit.map(a => (
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'0.25rem 0',borderBottom:'1px solid var(--border)'}}>
                  <span><strong>{a.action}</strong>{a.new_value ? ` — ${a.new_value}` : ''}{a.performer ? ` by ${a.performer.first_name} ${a.performer.last_name}` : ''}</span>
                  <span style={{color:'var(--text-3)',whiteSpace:'nowrap'}}>{new Date(a.performed_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Modal ────────────────────────────────────────────────────────────
function CreateDocModal({ user, onClose, onCreated }) {
  const [form, setForm] = useState({ doc_number: '', title: '', category: 'Policy', audience: 'Internal', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.doc_number || !form.title) { setError('Document number and title required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await api.controlledDocs.create(form);
      onCreated(res.data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'500px'}}>
        <div className="modal-header">
          <div className="modal-title">New Controlled Document</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div className="field"><label className="label">Document Number</label><input className="input" value={form.doc_number} onChange={e => f('doc_number', e.target.value)} placeholder="RS-QMS-XXX-000" /></div>
            <div className="field"><label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
                {['Manual','Policy','Procedure','Statement','Handbook','Form'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label className="label">Title</label><input className="input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Document title" /></div>
          <div className="field"><label className="label">Audience</label>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {['Internal','Officer','Client'].map(a => (
                <button key={a} type="button" onClick={() => f('audience', a)}
                  style={{flex:1,padding:'0.5rem',border: form.audience === a ? '2px solid var(--blue)' : '1px solid var(--border)',borderRadius:'6px',
                    background: form.audience === a ? 'rgba(26,82,168,0.06)' : 'var(--surface)',cursor:'pointer',fontSize:'0.8125rem',
                    fontWeight: form.audience === a ? 700 : 500, color: form.audience === a ? 'var(--blue)' : 'var(--text-2)'}}>{a}</button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Description (optional)</label><textarea className="input" rows={2} value={form.description} onChange={e => f('description', e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
