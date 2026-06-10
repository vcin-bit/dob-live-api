import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

const SERVICE_TYPES = ['Gate Maintenance', 'CCTV Installation', 'CCTV Monitoring', 'Other'];

export default function SubcontractorRegister({ user }) {
  const [subs, setSubs] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');

  async function load() {
    try {
      const [subRes, siteRes] = await Promise.all([api.subcontractors.list(), api.sites.list()]);
      setSubs(subRes.data || []);
      setSites(siteRes.data || []);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = siteFilter
    ? subs.filter(s => s.sites.some(st => st.id === siteFilter))
    : subs;

  if (viewing) return <SubcontractorDetail id={viewing} sites={sites} onBack={() => { setViewing(null); load(); }} user={user} />;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Subcontractor Register</div>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <select className="input" style={{width:'180px'}} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Add Subcontractor</button>
        </div>
      </div>
      <div className="page-content">
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>{subs.length === 0 ? 'No subcontractors registered yet' : 'No subcontractors match this filter'}</p></div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.875rem'}}>
            <thead>
              <tr style={{borderBottom:'2px solid var(--border)'}}>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.75rem',textTransform:'uppercase'}}>Company</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.75rem',textTransform:'uppercase'}}>Service</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.75rem',textTransform:'uppercase'}}>Primary Contact</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.75rem',textTransform:'uppercase'}}>Sites</th>
                <th style={{textAlign:'center',padding:'0.5rem 0.75rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.75rem',textTransform:'uppercase'}}>Docs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setViewing(s.id)} style={{borderBottom:'1px solid var(--border)',cursor:'pointer'}}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{padding:'0.625rem 0.75rem',fontWeight:600}}>{s.company_name}</td>
                  <td style={{padding:'0.625rem 0.75rem'}}>
                    <span style={{fontSize:'0.75rem',padding:'2px 8px',borderRadius:'999px',background:'rgba(99,102,241,0.1)',color:'#6366f1',fontWeight:600,border:'1px solid rgba(99,102,241,0.2)'}}>{s.service_type}</span>
                  </td>
                  <td style={{padding:'0.625rem 0.75rem'}}>
                    {s.primary_name || <span style={{color:'var(--text-3)'}}>—</span>}
                    {s.primary_phone && <span style={{color:'var(--text-3)',marginLeft:'0.5rem',fontSize:'0.8125rem'}}>{s.primary_phone}</span>}
                  </td>
                  <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8125rem',color:'var(--text-2)'}}>
                    {s.sites.length === 0 ? <span style={{color:'var(--text-3)'}}>None</span> : s.sites.map(st => st.name).join(', ')}
                  </td>
                  <td style={{padding:'0.625rem 0.75rem',textAlign:'center',fontWeight:600}}>{s.doc_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <SubcontractorCreateModal sites={sites} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function SubcontractorCreateModal({ sites, onClose, onSaved }) {
  const [form, setForm] = useState({ company_name: '', service_type: 'Other', site_ids: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.company_name.trim()) { setError('Company name required'); return; }
    try {
      setSaving(true); setError(null);
      await api.subcontractors.create(form);
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'480px'}}>
        <div className="modal-header"><div className="modal-title">Add Subcontractor</div><button className="modal-close" onClick={onClose}>x</button></div>
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}
        <div className="field"><label className="label">Company Name *</label><input className="input" value={form.company_name} onChange={e => f('company_name', e.target.value)} /></div>
        <div className="field">
          <label className="label">Service Type</label>
          <select className="input" value={form.service_type} onChange={e => f('service_type', e.target.value)}>
            {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Sites Covered</label>
          <div style={{display:'flex',flexDirection:'column',gap:'0.25rem',maxHeight:'150px',overflow:'auto',border:'1px solid var(--border)',borderRadius:'6px',padding:'0.5rem'}}>
            {sites.map(s => (
              <label key={s.id} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',cursor:'pointer'}}>
                <input type="checkbox" checked={form.site_ids.includes(s.id)} onChange={e => {
                  f('site_ids', e.target.checked ? [...form.site_ids, s.id] : form.site_ids.filter(x => x !== s.id));
                }} style={{accentColor:'var(--blue)'}} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function SubcontractorDetail({ id, sites, onBack, user }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [siteIds, setSiteIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadSiteId, setUploadSiteId] = useState('');
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadShare, setUploadShare] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function load() {
    try {
      const res = await api.subcontractors.get(id);
      setSub(res.data);
      setForm(res.data);
      setSiteIds(res.data.sites.map(s => s.id));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    try {
      setSaving(true); setError(null);
      await api.subcontractors.update(id, form);
      await api.subcontractors.setSites(id, siteIds);
      setSuccess('Saved'); setTimeout(() => setSuccess(null), 2000);
      setEditing(false);
      load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!uploadSiteId) { setError('Select a site for this document'); return; }
    try {
      setUploading(true); setError(null);
      await api.subcontractors.uploadDoc(id, file, uploadSiteId, uploadDocType, uploadShare);
      fileRef.current.value = '';
      setUploadDocType('');
      setUploadShare(false);
      setSuccess('Document uploaded'); setTimeout(() => setSuccess(null), 2000);
      load();
    } catch (e) { setError(e.message); } finally { setUploading(false); }
  }

  async function toggleShare(docId, current) {
    try {
      await api.subcontractors.updateDoc(id, docId, { share_to_portal: !current });
      load();
    } catch (e) { setError(e.message); }
  }

  async function deleteDoc(docId) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.subcontractors.deleteDoc(id, docId);
      load();
    } catch (e) { setError(e.message); }
  }

  async function viewDoc(docId) {
    try {
      const res = await api.subcontractors.docSigned(id, docId);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch { alert('Could not open document'); }
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>;
  if (!sub) return <div className="empty-state"><p>Not found</p></div>;

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>&larr; Back</button>
          <div className="topbar-title">{sub.company_name}</div>
          <span style={{fontSize:'0.75rem',padding:'2px 8px',borderRadius:'999px',background:'rgba(99,102,241,0.1)',color:'#6366f1',fontWeight:600}}>{sub.service_type}</span>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {!editing && <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Edit</button>}
          {editing && <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setForm(sub); setSiteIds(sub.sites.map(s => s.id)); }}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>}
        </div>
      </div>
      <div className="page-content">
        {success && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{success}</div>}
        {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem'}}>
          {/* Left column — details */}
          <div>
            <div className="card" style={{marginBottom:'1rem'}}>
              <div style={{fontWeight:700,marginBottom:'0.75rem'}}>Details</div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                <div className="field" style={{margin:0}}>
                  <label className="label">Company Name</label>
                  {editing ? <input className="input" value={form.company_name||''} onChange={e => f('company_name', e.target.value)} />
                    : <div style={{fontSize:'0.875rem'}}>{sub.company_name}</div>}
                </div>
                <div className="field" style={{margin:0}}>
                  <label className="label">Service Type</label>
                  {editing ? <select className="input" value={form.service_type||''} onChange={e => f('service_type', e.target.value)}>
                    {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select> : <div style={{fontSize:'0.875rem'}}>{sub.service_type}</div>}
                </div>
                <div className="field" style={{margin:0}}>
                  <label className="label">Account / Contract No.</label>
                  {editing ? <input className="input" value={form.account_number||''} onChange={e => f('account_number', e.target.value)} />
                    : <div style={{fontSize:'0.875rem'}}>{sub.account_number || '—'}</div>}
                </div>
                <div className="field" style={{margin:0}}>
                  <label className="label">Out-of-Hours Phone</label>
                  {editing ? <input className="input" value={form.out_of_hours_phone||''} onChange={e => f('out_of_hours_phone', e.target.value)} />
                    : <div style={{fontSize:'0.875rem'}}>{sub.out_of_hours_phone || '—'}</div>}
                </div>
                <div className="field" style={{margin:0}}>
                  <label className="label">Address</label>
                  {editing ? <textarea className="input" rows={2} value={form.address||''} onChange={e => f('address', e.target.value)} />
                    : <div style={{fontSize:'0.875rem',whiteSpace:'pre-line'}}>{sub.address || '—'}</div>}
                </div>
                <div className="field" style={{margin:0}}>
                  <label className="label">Notes</label>
                  {editing ? <textarea className="input" rows={3} value={form.notes||''} onChange={e => f('notes', e.target.value)} />
                    : <div style={{fontSize:'0.875rem',whiteSpace:'pre-line'}}>{sub.notes || '—'}</div>}
                </div>
              </div>
            </div>

            {/* Sites */}
            <div className="card">
              <div style={{fontWeight:700,marginBottom:'0.75rem'}}>Sites Covered</div>
              {editing ? (
                <div style={{display:'flex',flexDirection:'column',gap:'0.25rem',maxHeight:'200px',overflow:'auto'}}>
                  {sites.map(s => (
                    <label key={s.id} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8125rem',cursor:'pointer'}}>
                      <input type="checkbox" checked={siteIds.includes(s.id)} onChange={e => {
                        setSiteIds(e.target.checked ? [...siteIds, s.id] : siteIds.filter(x => x !== s.id));
                      }} style={{accentColor:'var(--blue)'}} />
                      {s.name}
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.375rem'}}>
                  {sub.sites.length === 0 ? <span style={{fontSize:'0.875rem',color:'var(--text-3)'}}>No sites assigned</span> :
                    sub.sites.map(s => <span key={s.id} style={{fontSize:'0.75rem',padding:'2px 8px',borderRadius:'4px',background:'var(--surface)',border:'1px solid var(--border)',fontWeight:500}}>{s.name}</span>)}
                </div>
              )}
            </div>
          </div>

          {/* Right column — contacts */}
          <div>
            {[
              { label: 'Primary Contact', prefix: 'primary' },
              { label: 'Secondary Contact', prefix: 'secondary' },
              { label: 'Backup Contact', prefix: 'backup' },
            ].map(({ label, prefix }) => (
              <div key={prefix} className="card" style={{marginBottom:'1rem'}}>
                <div style={{fontWeight:700,marginBottom:'0.5rem',fontSize:'0.875rem'}}>{label}</div>
                {editing ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
                    <input className="input" placeholder="Name" value={form[`${prefix}_name`]||''} onChange={e => f(`${prefix}_name`, e.target.value)} />
                    <input className="input" placeholder="Phone" value={form[`${prefix}_phone`]||''} onChange={e => f(`${prefix}_phone`, e.target.value)} />
                    <input className="input" placeholder="Email" value={form[`${prefix}_email`]||''} onChange={e => f(`${prefix}_email`, e.target.value)} />
                  </div>
                ) : (
                  <div style={{fontSize:'0.875rem'}}>
                    <div style={{fontWeight:500}}>{sub[`${prefix}_name`] || <span style={{color:'var(--text-3)'}}>Not set</span>}</div>
                    {sub[`${prefix}_phone`] && <div style={{color:'var(--text-2)'}}>{sub[`${prefix}_phone`]}</div>}
                    {sub[`${prefix}_email`] && <div style={{color:'var(--text-2)'}}>{sub[`${prefix}_email`]}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div className="card" style={{marginTop:'1.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
            <div style={{fontWeight:700}}>Documents</div>
          </div>

          {/* Upload row */}
          <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',padding:'0.75rem',background:'var(--surface)',borderRadius:'6px',border:'1px solid var(--border)'}}>
            <input type="file" ref={fileRef} style={{flex:'1 1 200px',fontSize:'0.8125rem'}} />
            <select className="input" style={{width:'160px'}} value={uploadSiteId} onChange={e => setUploadSiteId(e.target.value)}>
              <option value="">Tag to site...</option>
              {sites.filter(s => siteIds.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {sites.filter(s => !siteIds.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="input" style={{width:'120px'}} placeholder="Type (optional)" value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} />
            <label style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.75rem',cursor:'pointer',whiteSpace:'nowrap'}}>
              <input type="checkbox" checked={uploadShare} onChange={e => setUploadShare(e.target.checked)} style={{accentColor:'var(--blue)'}} />
              Share to portal
            </label>
            <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>

          {/* Document list */}
          {(sub.documents || []).length === 0 ? (
            <div style={{textAlign:'center',padding:'1rem',color:'var(--text-3)',fontSize:'0.875rem'}}>No documents uploaded</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8125rem'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'0.375rem 0.5rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Name</th>
                  <th style={{textAlign:'left',padding:'0.375rem 0.5rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Site</th>
                  <th style={{textAlign:'left',padding:'0.375rem 0.5rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Type</th>
                  <th style={{textAlign:'center',padding:'0.375rem 0.5rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Portal</th>
                  <th style={{textAlign:'right',padding:'0.375rem 0.5rem',fontWeight:600,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sub.documents.map(d => (
                  <tr key={d.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'0.5rem',fontWeight:500}}>{d.name}</td>
                    <td style={{padding:'0.5rem',color:'var(--text-2)'}}>{d.site?.name || '—'}</td>
                    <td style={{padding:'0.5rem',color:'var(--text-2)'}}>{d.doc_type || '—'}</td>
                    <td style={{padding:'0.5rem',textAlign:'center'}}>
                      <button onClick={() => toggleShare(d.id, d.share_to_portal)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,color:d.share_to_portal?'#16a34a':'var(--text-3)'}}>
                        {d.share_to_portal ? 'Shared' : 'Private'}
                      </button>
                    </td>
                    <td style={{padding:'0.5rem',textAlign:'right'}}>
                      <button onClick={() => viewDoc(d.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--blue)',fontWeight:600,marginRight:'0.5rem'}}>View</button>
                      <button onClick={() => deleteDoc(d.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--danger)',fontWeight:600}}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
