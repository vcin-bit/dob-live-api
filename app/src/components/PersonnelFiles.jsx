import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const BS7858_ITEMS = [
  { key: 'identity_verified', label: 'Identity Verified', desc: 'Passport, driving licence or birth certificate checked' },
  { key: 'right_to_work', label: 'Right to Work', desc: 'UK/EU citizen confirmed or visa/share code verified' },
  { key: 'dbs_check', label: 'DBS Check', desc: 'Disclosure and Barring Service certificate received' },
  { key: 'sia_licence', label: 'SIA Licence Verified', desc: 'Valid SIA licence confirmed on SIA register' },
  { key: 'employment_history_5yr', label: '5-Year Employment History', desc: 'Complete with no unexplained gaps' },
  { key: 'address_history_3yr', label: '3-Year Address History', desc: 'Complete with no unexplained gaps' },
  { key: 'references_verified', label: 'References Verified', desc: 'All employer references received and checked' },
  { key: 'financial_check', label: 'Financial Probity', desc: 'Credit check / bankruptcy search completed' },
  { key: 'gdpr_consent', label: 'GDPR Consent', desc: 'Data processing agreement accepted' },
  { key: 'self_employment_declaration', label: 'Employment Declaration', desc: 'Employment status declared and terms accepted' },
];

const VETTING_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'EXPIRED'];
const STATUS_COLORS = { NOT_STARTED: '#9ca3af', IN_PROGRESS: '#f59e0b', COMPLETE: '#16a34a', EXPIRED: '#dc2626' };

export function PersonnelFilesScreen({ user }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.users.list().then(res => {
      setOfficers((res.data || []).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')));
    }).finally(() => setLoading(false));
  }, []);

  if (selectedId) return <PersonnelFile userId={selectedId} officers={officers} onBack={() => setSelectedId(null)} currentUser={user} />;

  const filtered = officers.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${o.first_name} ${o.last_name}`.toLowerCase().includes(q) || (o.email || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="topbar"><div className="topbar-title">Personnel Files</div></div>
      <div className="page-content">
        <input className="input" style={{ width: '250px', marginBottom: '1rem' }} placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map(o => (
              <button key={o.id} onClick={() => setSelectedId(o.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>{o.first_name} {o.last_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{o.email} · {o.role}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>›</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonnelFile({ userId, officers, onBack, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [noteText, setNoteText] = useState('');
  const [empForm, setEmpForm] = useState(null);
  const [addrForm, setAddrForm] = useState(null);

  async function load() {
    try {
      const res = await api.personnel.get(userId);
      setData(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [userId]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  if (!data) return <div className="page-content">Failed to load personnel file.</div>;

  const { user: officer, hr, employment_history, address_history, vetting, notes, identity_documents } = data;
  const vettingMap = {};
  vetting.forEach(v => { vettingMap[v.item_key] = v; });
  const vettingComplete = BS7858_ITEMS.filter(i => vettingMap[i.key]?.verified).length;
  const vettingTotal = BS7858_ITEMS.length;
  const vettingPct = Math.round((vettingComplete / vettingTotal) * 100);
  const vettingStatus = hr?.vetting_status || 'NOT_STARTED';

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'employment', label: 'Employment' },
    { key: 'addresses', label: 'Addresses' },
    { key: 'vetting', label: 'BS7858' },
    { key: 'documents', label: 'Documents' },
    { key: 'notes', label: 'Notes' },
  ];

  async function toggleVetting(itemKey, currentlyVerified) {
    await api.personnel.setVetting(userId, { item_key: itemKey, verified: !currentlyVerified });
    load();
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await api.personnel.addNote(userId, noteText);
    setNoteText('');
    load();
  }

  async function saveEmployment() {
    if (!empForm) return;
    if (empForm.id) {
      await api.personnel.updateEmployment(userId, empForm.id, empForm);
    } else {
      await api.personnel.addEmployment(userId, empForm);
    }
    setEmpForm(null);
    load();
  }

  async function saveAddress() {
    if (!addrForm) return;
    await api.personnel.addAddress(userId, addrForm);
    setAddrForm(null);
    load();
  }

  async function updateVettingStatus(status) {
    await api.personnel.updateVettingStatus(userId, status);
    load();
  }

  // Gap detection for employment
  function getEmploymentGaps() {
    if (employment_history.length === 0) return [];
    const sorted = [...employment_history].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const gaps = [];
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    if (sorted.length > 0 && new Date(sorted[0].start_date) > fiveYearsAgo) {
      const days = Math.floor((new Date(sorted[0].start_date) - fiveYearsAgo) / 86400000);
      if (days > 30) gaps.push({ from: fiveYearsAgo, to: new Date(sorted[0].start_date), days });
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const end = sorted[i].end_date ? new Date(sorted[i].end_date) : new Date();
      const nextStart = new Date(sorted[i + 1].start_date);
      const days = Math.floor((nextStart - end) / 86400000);
      if (days > 30) gaps.push({ from: end, to: nextStart, days });
    }
    return gaps;
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
          <div>
            <div className="topbar-title">{officer.first_name} {officer.last_name}</div>
            <div className="topbar-sub">{officer.email} · {officer.role}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: STATUS_COLORS[vettingStatus], fontWeight: 700 }}>{vettingStatus.replace(/_/g, ' ')}</span>
          <select value={vettingStatus} onChange={e => updateVettingStatus(e.target.value)}
            style={{ padding: '0.25rem 0.5rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text)' }}>
            {VETTING_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, padding: '0 1.5rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--blue)' : '2px solid transparent', color: tab === t.key ? 'var(--blue)' : 'var(--text-3)', fontSize: '0.8125rem', fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
            {t.key === 'vetting' && <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', color: vettingPct === 100 ? '#16a34a' : 'var(--text-3)' }}>({vettingPct}%)</span>}
          </button>
        ))}
      </div>

      <div className="page-content">
        {/* ── OVERVIEW ──────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            {/* Vetting progress */}
            <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700 }}>BS7858 Vetting</span>
                <span style={{ fontWeight: 700, color: vettingPct === 100 ? '#16a34a' : 'var(--blue)' }}>{vettingPct}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                <div style={{ height: '100%', background: vettingPct === 100 ? '#16a34a' : 'var(--blue)', width: `${vettingPct}%`, borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                {BS7858_ITEMS.map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: vettingMap[item.key]?.verified ? '#16a34a' : 'var(--text-3)' }}>
                    <span>{vettingMap[item.key]?.verified ? '✓' : '○'}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>SIA Licence</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{officer.sia_licence_number || 'Not set'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{officer.sia_licence_type || '—'}</div>
                {officer.sia_expiry_date && <div style={{ fontSize: '0.75rem', color: new Date(officer.sia_expiry_date) < new Date() ? '#dc2626' : '#16a34a', fontWeight: 600 }}>Exp: {fmtDate(officer.sia_expiry_date)}</div>}
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Next of Kin</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{hr?.nok_name || 'Not set'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{hr?.nok_relationship || '—'} · {hr?.nok_phone || '—'}</div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Employment</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{hr?.employment_status === 'self_employed' ? 'Self-Employed' : hr?.employment_status === 'ltd_company' ? 'Ltd Company' : hr?.employment_status === 'employed' ? 'Employed (PAYE)' : 'Not set'}</div>
                {hr?.utr_number && <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>UTR: {hr.utr_number}</div>}
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Onboarding</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: hr?.onboarding_completed ? '#16a34a' : '#f59e0b' }}>{hr?.onboarding_completed ? 'Complete' : 'In Progress'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>GDPR: {hr?.gdpr_consent ? '✓' : '✗'}</div>
              </div>
            </div>

            {/* Gaps warning */}
            {getEmploymentGaps().length > 0 && (
              <div className="card" style={{ padding: '1rem', marginTop: '0.75rem', borderLeft: '3px solid #dc2626' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.375rem' }}>Employment Gaps Detected</div>
                {getEmploymentGaps().map((g, i) => (
                  <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                    {fmtDate(g.from)} — {fmtDate(g.to)} ({g.days} days unexplained)
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── EMPLOYMENT HISTORY ────────────────────────────────── */}
        {tab === 'employment' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700 }}>5-Year Employment History</div>
              <button className="btn btn-primary btn-sm" onClick={() => setEmpForm({ employer_name: '', job_title: '', start_date: '', end_date: '', is_current: false, reason_for_leaving: '', reference_name: '', reference_email: '', reference_phone: '' })}>+ Add</button>
            </div>

            {getEmploymentGaps().length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#dc2626' }}>
                <strong>Gaps detected:</strong> {getEmploymentGaps().map((g, i) => `${fmtDate(g.from)} to ${fmtDate(g.to)} (${g.days} days)`).join(', ')}
              </div>
            )}

            {employment_history.length === 0 ? <div className="empty-state"><p>No employment history recorded</p></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {employment_history.map(e => (
                  <div key={e.id} className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{e.employer_name}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{e.job_title || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{fmtDate(e.start_date)} — {e.is_current ? 'Present' : fmtDate(e.end_date)}</div>
                        {e.reason_for_leaving && <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Reason: {e.reason_for_leaving}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '4px', fontWeight: 600, background: e.reference_status === 'VERIFIED' ? '#dcfce7' : e.reference_status === 'REQUESTED' ? '#fef3c7' : '#f3f4f6', color: e.reference_status === 'VERIFIED' ? '#16a34a' : e.reference_status === 'REQUESTED' ? '#d97706' : '#9ca3af' }}>
                          Ref: {e.reference_status || 'NOT_REQUESTED'}
                        </span>
                        <button onClick={() => api.personnel.deleteEmployment(userId, e.id).then(load)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}>Del</button>
                      </div>
                    </div>
                    {e.reference_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>Ref: {e.reference_name} · {e.reference_email || e.reference_phone || '—'}</div>}
                  </div>
                ))}
              </div>
            )}

            {empForm && (
              <div className="modal-overlay" onClick={() => setEmpForm(null)}>
                <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header"><div className="modal-title">Add Employment</div><button className="modal-close" onClick={() => setEmpForm(null)}>×</button></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="field"><label className="label">Employer Name *</label><input className="input" value={empForm.employer_name} onChange={e => setEmpForm(f => ({ ...f, employer_name: e.target.value }))} /></div>
                    <div className="field"><label className="label">Job Title</label><input className="input" value={empForm.job_title} onChange={e => setEmpForm(f => ({ ...f, job_title: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="field"><label className="label">Start Date *</label><input type="date" className="input" value={empForm.start_date} onChange={e => setEmpForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                      <div className="field"><label className="label">End Date</label><input type="date" className="input" value={empForm.end_date} onChange={e => setEmpForm(f => ({ ...f, end_date: e.target.value }))} disabled={empForm.is_current} /></div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}><input type="checkbox" checked={empForm.is_current} onChange={e => setEmpForm(f => ({ ...f, is_current: e.target.checked }))} /> Currently employed here</label>
                    <div className="field"><label className="label">Reason for Leaving</label><input className="input" value={empForm.reason_for_leaving} onChange={e => setEmpForm(f => ({ ...f, reason_for_leaving: e.target.value }))} /></div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Reference Contact</div>
                      <div className="field"><label className="label">Name</label><input className="input" value={empForm.reference_name} onChange={e => setEmpForm(f => ({ ...f, reference_name: e.target.value }))} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="field"><label className="label">Email</label><input className="input" value={empForm.reference_email} onChange={e => setEmpForm(f => ({ ...f, reference_email: e.target.value }))} /></div>
                        <div className="field"><label className="label">Phone</label><input className="input" value={empForm.reference_phone} onChange={e => setEmpForm(f => ({ ...f, reference_phone: e.target.value }))} /></div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setEmpForm(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveEmployment} disabled={!empForm.employer_name || !empForm.start_date}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ADDRESS HISTORY ──────────────────────────────────── */}
        {tab === 'addresses' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700 }}>3-Year Address History</div>
              <button className="btn btn-primary btn-sm" onClick={() => setAddrForm({ address_line_1: '', address_line_2: '', city: '', postcode: '', start_date: '', end_date: '', is_current: false })}>+ Add</button>
            </div>
            {address_history.length === 0 ? <div className="empty-state"><p>No address history recorded</p></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {address_history.map(a => (
                  <div key={a.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{a.address_line_1}{a.address_line_2 ? `, ${a.address_line_2}` : ''}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{a.city}{a.postcode ? `, ${a.postcode}` : ''}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{fmtDate(a.start_date)} — {a.is_current ? 'Present' : fmtDate(a.end_date)}</div>
                    </div>
                    <button onClick={() => api.personnel.deleteAddress(userId, a.id).then(load)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}>Del</button>
                  </div>
                ))}
              </div>
            )}
            {addrForm && (
              <div className="modal-overlay" onClick={() => setAddrForm(null)}>
                <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header"><div className="modal-title">Add Address</div><button className="modal-close" onClick={() => setAddrForm(null)}>×</button></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="field"><label className="label">Address Line 1 *</label><input className="input" value={addrForm.address_line_1} onChange={e => setAddrForm(f => ({ ...f, address_line_1: e.target.value }))} /></div>
                    <div className="field"><label className="label">Address Line 2</label><input className="input" value={addrForm.address_line_2} onChange={e => setAddrForm(f => ({ ...f, address_line_2: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div className="field"><label className="label">City</label><input className="input" value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} /></div>
                      <div className="field"><label className="label">Postcode</label><input className="input" value={addrForm.postcode} onChange={e => setAddrForm(f => ({ ...f, postcode: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="field"><label className="label">From *</label><input type="date" className="input" value={addrForm.start_date} onChange={e => setAddrForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                      <div className="field"><label className="label">To</label><input type="date" className="input" value={addrForm.end_date} onChange={e => setAddrForm(f => ({ ...f, end_date: e.target.value }))} disabled={addrForm.is_current} /></div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}><input type="checkbox" checked={addrForm.is_current} onChange={e => setAddrForm(f => ({ ...f, is_current: e.target.checked }))} /> Current address</label>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setAddrForm(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveAddress} disabled={!addrForm.address_line_1 || !addrForm.start_date}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── BS7858 VETTING ───────────────────────────────────── */}
        {tab === 'vetting' && (
          <>
            <div style={{ fontWeight: 700, marginBottom: '1rem' }}>BS7858 Vetting Checklist</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {BS7858_ITEMS.map(item => {
                const v = vettingMap[item.key];
                return (
                  <div key={item.key} className="card" style={{ padding: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <input type="checkbox" checked={!!v?.verified} onChange={() => toggleVetting(item.key, v?.verified)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--blue)', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: v?.verified ? '#16a34a' : 'var(--text)' }}>{item.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{item.desc}</div>
                      {v?.verified && v?.verifier && <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>Verified by {v.verifier.first_name} {v.verifier.last_name} on {fmtDate(v.verified_at)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── DOCUMENTS ────────────────────────────────────────── */}
        {tab === 'documents' && (
          <>
            <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Uploaded Documents</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { key: 'sia_front', label: 'SIA Licence (Front)', path: hr?.sia_front_path },
                { key: 'sia_back', label: 'SIA Licence (Back)', path: hr?.sia_back_path },
                { key: 'dbs_certificate', label: 'DBS Certificate', path: hr?.dbs_certificate_path },
              ].map(doc => (
                <div key={doc.key} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{doc.path ? '✓' : '—'}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: doc.path ? '#16a34a' : 'var(--text-3)' }}>{doc.label}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{doc.path ? 'Uploaded' : 'Not uploaded'}</div>
                  {doc.path && <button onClick={() => api.hr.getDocUrl(doc.key, userId).then(r => window.open(r.url, '_blank')).catch(() => alert('Could not load'))} style={{ marginTop: '0.5rem', padding: '0.25rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-2)' }}>View</button>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── NOTES ────────────────────────────────────────────── */}
        {tab === 'notes' && (
          <>
            <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Internal HR Notes</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input className="input" style={{ flex: 1 }} placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
              <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!noteText.trim()}>Add</button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>Notes are internal only — not visible to the officer.</div>
            {notes.length === 0 ? <div className="empty-state"><p>No notes yet</p></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notes.map(n => (
                  <div key={n.id} className="card" style={{ padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{n.content}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{n.author?.first_name} {n.author?.last_name} · {fmtDate(n.created_at)}</div>
                    </div>
                    <button onClick={() => api.personnel.deleteNote(userId, n.id).then(load)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}>Del</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
