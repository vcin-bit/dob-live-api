import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const BS7858_ITEMS = [
  { key: 'application_form', label: 'Step 1: Application Form', desc: 'Signed application/consent form authorising screening checks', evidence: 'Signed application form' },
  { key: 'identity_verified', label: 'Step 2: Identity Verification', desc: 'Confirmed via passport, driving licence, or birth certificate. Must verify full legal name, DOB, and photo ID', evidence: 'Copy of passport/driving licence/birth certificate' },
  { key: 'right_to_work', label: 'Step 3: Right to Work', desc: 'Verified UK/EU citizen, settled status, or valid work visa. Check via GOV.UK share code if applicable', evidence: 'Passport, share code result, or visa copy' },
  { key: 'address_history_3yr', label: 'Step 4: Address History (3 Years)', desc: 'Full 3-year address history with no unexplained gaps. Verified via utility bills, council tax, or bank statements', evidence: 'Utility bills or council tax statements per address' },
  { key: 'employment_history_5yr', label: 'Step 5: Employment History (5 Years)', desc: 'Complete 5-year employment history with no gaps exceeding 31 days. All periods accounted for including unemployment, education, travel', evidence: 'Employment references, P45/P60, payslips' },
  { key: 'references_verified', label: 'Step 6: References', desc: 'Written references obtained from all employers in the 5-year history. Each reference must confirm dates, role, and reason for leaving', evidence: 'Signed reference letters or completed reference forms' },
  { key: 'criminal_record_check', label: 'Step 7: Criminal Record Check (DBS)', desc: 'Enhanced DBS certificate obtained. Must be less than 3 years old or registered on DBS Update Service', evidence: 'DBS certificate or Update Service check result' },
  { key: 'financial_check', label: 'Step 8: Financial Probity Check', desc: 'Credit check and bankruptcy/IVA/CCJ search completed. Identifies financial vulnerability that could pose a security risk', evidence: 'Credit check report (Experian/Equifax/TransUnion)' },
  { key: 'sia_licence', label: 'Step 9: SIA Licence Verification', desc: 'Valid SIA licence confirmed on the SIA public register. Licence type, number, and expiry verified', evidence: 'SIA register screenshot or licence copy (front + back)' },
  { key: 'interview_assessment', label: 'Step 10: Interview & Assessment', desc: 'Face-to-face or video screening interview conducted. Assessed character, suitability, and any discrepancies in application', evidence: 'Interview notes signed by screener' },
  { key: 'gdpr_consent', label: 'Data Protection Consent', desc: 'Written consent for data processing, storage, and sharing with third parties for vetting purposes under UK GDPR', evidence: 'Signed GDPR consent form' },
  { key: 'self_employment_declaration', label: 'Employment Declaration', desc: 'Employment status confirmed (PAYE/self-employed/Ltd). Terms of engagement accepted', evidence: 'Signed declaration' },
];

const VETTING_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'EXPIRED'];
const STATUS_COLORS = { NOT_STARTED: '#9ca3af', IN_PROGRESS: '#f59e0b', COMPLETE: '#16a34a', EXPIRED: '#dc2626' };

export function PersonnelFilesScreen({ user }) {
  const [officers, setOfficers] = useState([]);
  const [hrRecords, setHrRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([api.users.list(), api.hr.listAll()])
      .then(([usersRes, hrRes]) => {
        setOfficers((usersRes.data || []).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')));
        const hrMap = {};
        (hrRes.data || []).forEach(h => { hrMap[h.user_id] = h; });
        setHrRecords(hrMap);
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
            {filtered.map(o => {
              const hrRec = hrRecords[o.id];
              const vs = hrRec?.vetting_status || 'NOT_STARTED';
              const isVetted = vs === 'COMPLETE';
              return (
                <button key={o.id} onClick={() => setSelectedId(o.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    {isVetted && <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', border: '1.5px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
                    {!isVetted && <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: vs === 'IN_PROGRESS' ? '#fef3c7' : '#f3f4f6', border: `1.5px solid ${vs === 'IN_PROGRESS' ? '#fde68a' : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.625rem', fontWeight: 700, color: vs === 'IN_PROGRESS' ? '#d97706' : '#9ca3af' }}>{vs === 'IN_PROGRESS' ? '…' : '○'}</div>}
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
                        {o.first_name} {o.last_name}
                        {isVetted && <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a' }}>BS7858 ✓</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{o.email} · {o.role}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: STATUS_COLORS[vs], whiteSpace: 'nowrap' }}>{vs.replace(/_/g, ' ')}</div>
                </button>
              );
            })}
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
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

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

  function startEdit() {
    setEditForm({
      first_name: officer.first_name || '', last_name: officer.last_name || '',
      email: officer.email || '', phone: officer.phone || '',
      sia_licence_number: officer.sia_licence_number || '', sia_licence_type: officer.sia_licence_type || '',
      sia_expiry_date: officer.sia_expiry_date ? officer.sia_expiry_date.split('T')[0] : '',
      // HR fields
      nok_name: hr?.nok_name || '', nok_relationship: hr?.nok_relationship || '', nok_phone: hr?.nok_phone || '',
      address_line_1: hr?.address_line_1 || '', address_line_2: hr?.address_line_2 || '', city: hr?.city || '', postcode: hr?.postcode || '',
      date_of_birth: hr?.date_of_birth ? hr.date_of_birth.split('T')[0] : '', ni_number: hr?.ni_number || '',
      personal_email: hr?.personal_email || '',
      bank_name: hr?.bank_name || '', bank_sort_code: hr?.bank_sort_code || '', bank_account_number: hr?.bank_account_number || '', bank_account_holder: hr?.bank_account_holder || '',
      employment_status: hr?.employment_status || '', utr_number: hr?.utr_number || '',
      nationality: hr?.nationality || '', right_to_work_status: hr?.right_to_work_status || '',
    });
  }

  async function saveEdit() {
    if (!editForm) return;
    setSaving(true);
    try {
      // Update user record
      await api.users.update(userId, {
        first_name: editForm.first_name, last_name: editForm.last_name, phone: editForm.phone,
        sia_licence_number: editForm.sia_licence_number || null, sia_licence_type: editForm.sia_licence_type || null,
        sia_expiry_date: editForm.sia_expiry_date || null,
      });
      // Update HR record
      await api.personnel.updateHR(userId, {
        nok_name: editForm.nok_name, nok_relationship: editForm.nok_relationship, nok_phone: editForm.nok_phone,
        address_line_1: editForm.address_line_1, address_line_2: editForm.address_line_2, city: editForm.city, postcode: editForm.postcode,
        date_of_birth: editForm.date_of_birth, ni_number: editForm.ni_number, personal_email: editForm.personal_email,
        bank_name: editForm.bank_name, bank_sort_code: editForm.bank_sort_code, bank_account_number: editForm.bank_account_number, bank_account_holder: editForm.bank_account_holder,
        employment_status: editForm.employment_status, utr_number: editForm.utr_number,
        nationality: editForm.nationality, right_to_work_status: editForm.right_to_work_status,
        gdpr_consent: hr?.gdpr_consent || false, gdpr_consent_at: hr?.gdpr_consent_at || null,
      });
      setEditForm(null);
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
    finally { setSaving(false); }
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'details', label: 'Details' },
    { key: 'employment', label: 'Employment' },
    { key: 'addresses', label: 'Addresses' },
    { key: 'vetting', label: 'BS7858' },
    { key: 'documents', label: 'Documents' },
    { key: 'training', label: 'Training' },
    { key: 'idcard', label: 'ID Card' },
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
            <div className="topbar-title">{officer.first_name} {officer.last_name}{officer.employee_number && <span style={{color:'var(--text-3)',fontWeight:400,fontSize:'0.875rem',marginLeft:'0.5rem'}}>({officer.employee_number})</span>}</div>
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

        {/* ── DETAILS (EDITABLE) ──────────────────────────────── */}
        {tab === 'details' && (
          <>
            {!editForm ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700 }}>Personal Details</div>
                  <button className="btn btn-primary btn-sm" onClick={startEdit}>Edit</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    ['Name', `${officer.first_name} ${officer.last_name}`],
                    ['Email', officer.email],
                    ['Phone', officer.phone || '—'],
                    ['DOB', hr?.date_of_birth ? fmtDate(hr.date_of_birth) : '—'],
                    ['NI Number', hr?.ni_number || '—'],
                    ['Personal Email', hr?.personal_email || '—'],
                    ['Nationality', hr?.nationality || '—'],
                    ['Right to Work', hr?.right_to_work_status || '—'],
                    ['Employment Status', hr?.employment_status === 'self_employed' ? 'Self-Employed' : hr?.employment_status === 'ltd_company' ? 'Ltd Company' : hr?.employment_status === 'employed' ? 'Employed (PAYE)' : '—'],
                    ['UTR', hr?.utr_number || '—'],
                  ].map(([label, value], i) => (
                    <div key={i} className="card" style={{ padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Home Address</div>
                  <div className="card" style={{ padding: '0.75rem' }}>
                    <div>{hr?.address_line_1 || '—'}{hr?.address_line_2 ? `, ${hr.address_line_2}` : ''}</div>
                    <div style={{ color: 'var(--text-2)' }}>{hr?.city || ''} {hr?.postcode || ''}</div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Next of Kin</div>
                  <div className="card" style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{hr?.nok_name || '—'}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{hr?.nok_relationship || '—'} · {hr?.nok_phone || '—'}</div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Bank Details</div>
                  <div className="card" style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{hr?.bank_account_holder || '—'}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{hr?.bank_name || '—'} · {hr?.bank_sort_code || '—'} · {hr?.bank_account_number || '—'}</div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>SIA Licence</div>
                  <div className="card" style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{officer.sia_licence_number || '—'}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '0.8125rem' }}>{officer.sia_licence_type || '—'} · Exp: {officer.sia_expiry_date ? fmtDate(officer.sia_expiry_date) : '—'}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700 }}>Edit Personal Details</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field"><label className="label">First Name</label><input className="input" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                  <div className="field"><label className="label">Last Name</label><input className="input" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                  <div className="field"><label className="label">Phone</label><input className="input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div className="field"><label className="label">Personal Email</label><input className="input" value={editForm.personal_email} onChange={e => setEditForm(f => ({ ...f, personal_email: e.target.value }))} /></div>
                  <div className="field"><label className="label">Date of Birth</label><input type="date" className="input" value={editForm.date_of_birth} onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
                  <div className="field"><label className="label">NI Number</label><input className="input" value={editForm.ni_number} onChange={e => setEditForm(f => ({ ...f, ni_number: e.target.value.toUpperCase() }))} /></div>
                  <div className="field"><label className="label">Nationality</label><input className="input" value={editForm.nationality} onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))} placeholder="e.g. British" /></div>
                  <div className="field"><label className="label">Right to Work</label>
                    <select className="input" value={editForm.right_to_work_status} onChange={e => setEditForm(f => ({ ...f, right_to_work_status: e.target.value }))}>
                      <option value="">Select...</option>
                      <option value="British Citizen">British Citizen</option>
                      <option value="EU Settled Status">EU Settled Status</option>
                      <option value="EU Pre-Settled Status">EU Pre-Settled Status</option>
                      <option value="Work Visa">Work Visa</option>
                      <option value="Indefinite Leave">Indefinite Leave to Remain</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="field"><label className="label">Employment Status</label>
                    <select className="input" value={editForm.employment_status} onChange={e => setEditForm(f => ({ ...f, employment_status: e.target.value }))}>
                      <option value="">Select...</option>
                      <option value="employed">Employed (PAYE)</option>
                      <option value="self_employed">Self-Employed</option>
                      <option value="ltd_company">Ltd Company</option>
                    </select>
                  </div>
                  {(editForm.employment_status === 'self_employed' || editForm.employment_status === 'ltd_company') && (
                    <div className="field"><label className="label">UTR Number</label><input className="input" value={editForm.utr_number} onChange={e => setEditForm(f => ({ ...f, utr_number: e.target.value }))} /></div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Home Address</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="field" style={{ gridColumn: '1/-1' }}><label className="label">Address Line 1</label><input className="input" value={editForm.address_line_1} onChange={e => setEditForm(f => ({ ...f, address_line_1: e.target.value }))} /></div>
                    <div className="field" style={{ gridColumn: '1/-1' }}><label className="label">Address Line 2</label><input className="input" value={editForm.address_line_2} onChange={e => setEditForm(f => ({ ...f, address_line_2: e.target.value }))} /></div>
                    <div className="field"><label className="label">City</label><input className="input" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div>
                    <div className="field"><label className="label">Postcode</label><input className="input" value={editForm.postcode} onChange={e => setEditForm(f => ({ ...f, postcode: e.target.value }))} /></div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Next of Kin</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="field"><label className="label">Name</label><input className="input" value={editForm.nok_name} onChange={e => setEditForm(f => ({ ...f, nok_name: e.target.value }))} /></div>
                    <div className="field"><label className="label">Relationship</label>
                      <select className="input" value={editForm.nok_relationship} onChange={e => setEditForm(f => ({ ...f, nok_relationship: e.target.value }))}>
                        <option value="">Select...</option>
                        {['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="field"><label className="label">Phone</label><input className="input" value={editForm.nok_phone} onChange={e => setEditForm(f => ({ ...f, nok_phone: e.target.value }))} /></div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Bank Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="field"><label className="label">Account Holder</label><input className="input" value={editForm.bank_account_holder} onChange={e => setEditForm(f => ({ ...f, bank_account_holder: e.target.value }))} /></div>
                    <div className="field"><label className="label">Bank Name</label><input className="input" value={editForm.bank_name} onChange={e => setEditForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
                    <div className="field"><label className="label">Sort Code</label><input className="input" value={editForm.bank_sort_code} onChange={e => setEditForm(f => ({ ...f, bank_sort_code: e.target.value }))} /></div>
                    <div className="field"><label className="label">Account Number</label><input className="input" value={editForm.bank_account_number} onChange={e => setEditForm(f => ({ ...f, bank_account_number: e.target.value }))} /></div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>SIA Licence</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="field"><label className="label">Licence Number</label><input className="input" value={editForm.sia_licence_number} onChange={e => setEditForm(f => ({ ...f, sia_licence_number: e.target.value }))} /></div>
                    <div className="field"><label className="label">Licence Type</label>
                      <select className="input" value={editForm.sia_licence_type} onChange={e => setEditForm(f => ({ ...f, sia_licence_type: e.target.value }))}>
                        <option value="">Select...</option>
                        {['Security Guarding','Door Supervisor','CCTV Operator','Close Protection','Vehicle Immobiliser','Key Holding'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="field"><label className="label">Expiry Date</label><input type="date" className="input" value={editForm.sia_expiry_date} onChange={e => setEditForm(f => ({ ...f, sia_expiry_date: e.target.value }))} /></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => setEditForm(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save All Changes'}</button>
                </div>
              </>
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
            {/* Current address from HR record */}
            {hr?.address_line_1 && (
              <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid #16a34a' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Current Home Address</div>
                <div style={{ fontWeight: 600 }}>{hr.address_line_1}{hr.address_line_2 ? `, ${hr.address_line_2}` : ''}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{hr.city}{hr.postcode ? `, ${hr.postcode}` : ''}</div>
                {(() => {
                  const currentAddr = address_history.find(a => a.is_current);
                  if (currentAddr?.start_date) {
                    const months = Math.floor((new Date() - new Date(currentAddr.start_date)) / (30.44 * 86400000));
                    const yrs = Math.floor(months / 12);
                    const mths = months % 12;
                    return <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>At this address: {yrs > 0 ? `${yrs} year${yrs !== 1 ? 's' : ''} ` : ''}{mths} month{mths !== 1 ? 's' : ''} (since {fmtDate(currentAddr.start_date)})</div>;
                  }
                  return <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.25rem' }}>Duration at this address not recorded — add to address history below</div>;
                })()}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700 }}>3-Year Address History</div>
              <button className="btn btn-primary btn-sm" onClick={() => setAddrForm({ address_line_1: '', address_line_2: '', city: '', postcode: '', start_date: '', end_date: '', is_current: false })}>+ Add</button>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#1e40af', lineHeight: 1.5 }}>
              <strong>BS7858 Requirement:</strong> A complete 3-year address history must be provided with no unexplained gaps. Each address should be verified with a utility bill, council tax statement, or bank statement showing the address and date.
            </div>

            {address_history.length === 0 ? <div className="empty-state"><p>No address history recorded</p></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {address_history.map(a => {
                  const months = a.start_date ? Math.floor(((a.is_current ? new Date() : a.end_date ? new Date(a.end_date) : new Date()) - new Date(a.start_date)) / (30.44 * 86400000)) : 0;
                  const yrs = Math.floor(months / 12);
                  const mths = months % 12;
                  return (
                    <div key={a.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', borderLeft: a.is_current ? '3px solid #16a34a' : '3px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.address_line_1}{a.address_line_2 ? `, ${a.address_line_2}` : ''}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{a.city}{a.postcode ? `, ${a.postcode}` : ''}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                          {fmtDate(a.start_date)} — {a.is_current ? 'Present' : fmtDate(a.end_date)}
                          <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>({yrs > 0 ? `${yrs}y ` : ''}{mths}m)</span>
                          {a.is_current && <span style={{ marginLeft: '0.5rem', color: '#16a34a', fontWeight: 600 }}>Current</span>}
                        </div>
                      </div>
                      <button onClick={() => api.personnel.deleteAddress(userId, a.id).then(load)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}>Del</button>
                    </div>
                  );
                })}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>BS7858 Vetting Checklist</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: vettingPct === 100 ? '#16a34a' : 'var(--blue)' }}>{vettingComplete}/{vettingTotal} ({vettingPct}%)</div>
            </div>
            <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ height: '100%', background: vettingPct === 100 ? '#16a34a' : 'var(--blue)', width: `${vettingPct}%`, borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#1e40af', lineHeight: 1.5 }}>
              <strong>BS7858:2019</strong> — Screening of individuals working in a secure environment. All items must be verified and evidenced before an officer can be deployed. Tick each item once the evidence has been obtained and checked.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {BS7858_ITEMS.map(item => {
                const v = vettingMap[item.key];
                return (
                  <div key={item.key} className="card" style={{ padding: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', borderLeft: v?.verified ? '3px solid #16a34a' : '3px solid #d1d5db' }}>
                    <input type="checkbox" checked={!!v?.verified} onChange={() => toggleVetting(item.key, v?.verified)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--blue)', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: v?.verified ? '#16a34a' : 'var(--text)' }}>{item.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.125rem' }}>{item.desc}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem', fontStyle: 'italic' }}>Evidence required: {item.evidence}</div>
                      {v?.verified && v?.verifier && <div style={{ fontSize: '0.6875rem', color: '#16a34a', marginTop: '0.25rem', fontWeight: 600 }}>✓ Verified by {v.verifier.first_name} {v.verifier.last_name} — {fmtDate(v.verified_at)}</div>}
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

        {/* ── TRAINING & COMPLIANCE ─────────────────────────── */}
        {tab === 'training' && <TrainingComplianceTab userId={userId} />}

        {/* ── ID CARD ──────────────────────────────────────────── */}
        {tab === 'idcard' && <IDCardTab userId={userId} user={currentUser} />}

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

// ── Training & Compliance Tab ──────────────────────────────────────────────
function TrainingComplianceTab({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.controlledDocs.officerCompliance(userId)
      .then(res => setData(res))
      .catch(e => console.error('Compliance load failed:', e))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>;

  const acked = data?.acknowledged || [];
  const outstanding = data?.outstanding || [];
  const summary = data?.summary || { total: 0, acknowledged: 0, outstanding: 0 };

  return (
    <div>
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1rem'}}>Training & Compliance</div>

      {/* Summary */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.25rem'}}>
        <div style={{flex:1,padding:'0.75rem',background:'var(--surface)',borderRadius:'8px',border:'1px solid var(--border)',textAlign:'center'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--text)'}}>{summary.total}</div>
          <div style={{fontSize:'0.6875rem',color:'var(--text-3)',fontWeight:600,textTransform:'uppercase'}}>Total Docs</div>
        </div>
        <div style={{flex:1,padding:'0.75rem',background:'rgba(16,185,129,0.05)',borderRadius:'8px',border:'1px solid rgba(16,185,129,0.2)',textAlign:'center'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,color:'#16a34a'}}>{summary.acknowledged}</div>
          <div style={{fontSize:'0.6875rem',color:'#16a34a',fontWeight:600,textTransform:'uppercase'}}>Acknowledged</div>
        </div>
        <div style={{flex:1,padding:'0.75rem',background: summary.outstanding > 0 ? 'rgba(239,68,68,0.05)' : 'var(--surface)',borderRadius:'8px',border: summary.outstanding > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border)',textAlign:'center'}}>
          <div style={{fontSize:'1.5rem',fontWeight:800,color: summary.outstanding > 0 ? '#ef4444' : 'var(--text)'}}>{summary.outstanding}</div>
          <div style={{fontSize:'0.6875rem',color: summary.outstanding > 0 ? '#ef4444' : 'var(--text-3)',fontWeight:600,textTransform:'uppercase'}}>Outstanding</div>
        </div>
      </div>

      {/* Outstanding */}
      {outstanding.length > 0 && (
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#ef4444',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Outstanding ({outstanding.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            {outstanding.map(d => (
              <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.75rem',background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:'6px',fontSize:'0.8125rem'}}>
                <div>
                  <span style={{fontWeight:600,color:'var(--blue)',marginRight:'0.5rem',fontSize:'0.75rem'}}>{d.doc_number}</span>
                  <span>{d.title}</span>
                </div>
                <span style={{fontSize:'0.6875rem',color:'#ef4444',fontWeight:600,whiteSpace:'nowrap'}}>Rev {d.revision}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged */}
      {acked.length > 0 && (
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'#16a34a',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Acknowledged ({acked.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
            {acked.map(d => (
              <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.75rem',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'0.8125rem'}}>
                <div>
                  <span style={{fontWeight:600,color:'var(--blue)',marginRight:'0.5rem',fontSize:'0.75rem'}}>{d.doc_number}</span>
                  <span>{d.title}</span>
                </div>
                <span style={{fontSize:'0.6875rem',color:'#16a34a',fontWeight:600,whiteSpace:'nowrap'}}>{new Date(d.acknowledged_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.total === 0 && (
        <div style={{textAlign:'center',padding:'1.5rem',color:'var(--text-3)',fontSize:'0.875rem'}}>No controlled documents require acknowledgement.</div>
      )}

      {/* Site Training placeholder */}
      <div style={{marginTop:'1rem',padding:'1rem',background:'var(--surface)',borderRadius:'8px',border:'1px dashed var(--border)'}}>
        <div style={{fontWeight:700,color:'var(--text)',marginBottom:'0.25rem'}}>Site Training</div>
        <div style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>Coming soon — site-specific training records, competence assessments, and deployment readiness will appear here.</div>
      </div>
    </div>
  );
}

// ── ID Card Tab ────────────────────────────────────────────────────────────
function IDCardTab({ userId, user }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [issueForm, setIssueForm] = useState({ expiry_date: '', notes: '' });
  const [issueSaving, setIssueSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await api.idCards.list(userId); setCards(res.data || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [userId]);

  const current = cards.find(c => c.status === 'active');
  const history = cards.filter(c => c.status !== 'active');

  function daysUntilExpiry(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

  async function issueCard() {
    if (!issueForm.expiry_date) return;
    setIssueSaving(true);
    try {
      await api.idCards.issue({ user_id: userId, expiry_date: issueForm.expiry_date, notes: issueForm.notes || null });
      setIssuing(false); setIssueForm({ expiry_date: '', notes: '' }); load();
    } catch (e) { alert(e.message); }
    finally { setIssueSaving(false); }
  }

  async function changeStatus(id, status, reason) {
    try { await api.idCards.updateStatus(id, status, reason); load(); }
    catch (e) { alert(e.message); }
  }

  async function downloadPdf(id) {
    try {
      const token = await (window.__clerkGetToken ? window.__clerkGetToken() : window.Clerk?.session?.getToken?.());
      const res = await fetch(api.idCards.pdfUrl(id), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" /></div>;

  const STATUS_CHIP = {
    active: { bg: '#dcfce7', color: '#166534', label: 'Active' },
    lost: { bg: '#fee2e2', color: '#991b1b', label: 'Lost/Stolen' },
    returned: { bg: '#f3f4f6', color: '#374151', label: 'Returned' },
    revoked: { bg: '#fee2e2', color: '#991b1b', label: 'Revoked' },
    expired: { bg: '#fef3c7', color: '#92400e', label: 'Expired' },
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div style={{fontWeight:700,fontSize:'1rem'}}>ID Card</div>
        {!current && !issuing && <button className="btn btn-primary btn-sm" onClick={() => { setIssuing(true); setIssueForm({ expiry_date: new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0], notes: '' }); }}>Issue New Card</button>}
      </div>

      {/* Issue form */}
      {issuing && (
        <div className="card" style={{marginBottom:'1rem',border:'2px solid var(--blue)',padding:'1rem'}}>
          <div style={{fontWeight:600,marginBottom:'0.75rem'}}>Issue New ID Card</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div className="field"><label className="label">Expiry Date</label><input type="date" className="input" value={issueForm.expiry_date} onChange={e => setIssueForm(p=>({...p,expiry_date:e.target.value}))} /></div>
            <div className="field"><label className="label">Notes</label><input className="input" value={issueForm.notes} onChange={e => setIssueForm(p=>({...p,notes:e.target.value}))} placeholder="Optional" /></div>
          </div>
          <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem'}}>
            <button className="btn btn-primary btn-sm" onClick={issueCard} disabled={issueSaving}>{issueSaving ? 'Issuing...' : 'Issue Card'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setIssuing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Current card */}
      {current ? (
        <div className="card" style={{marginBottom:'1rem',borderLeft:'4px solid #16a34a'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.75rem'}}>
            <div>
              <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Current Card</div>
              <div style={{fontSize:'1.25rem',fontWeight:800,color:'var(--blue)',marginTop:'0.25rem'}}>{current.card_number}</div>
            </div>
            <span style={{padding:'3px 8px',borderRadius:'4px',fontSize:'0.6875rem',fontWeight:600,...STATUS_CHIP.active}}>{STATUS_CHIP.active.label}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',fontSize:'0.8125rem',marginBottom:'0.75rem'}}>
            <div><span style={{color:'var(--text-3)',fontWeight:600}}>Issued:</span> {new Date(current.issue_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
            <div>
              <span style={{color:'var(--text-3)',fontWeight:600}}>Expires:</span>{' '}
              <span style={{color: daysUntilExpiry(current.expiry_date) <= 30 ? '#ef4444' : 'var(--text)', fontWeight: daysUntilExpiry(current.expiry_date) <= 30 ? 700 : 400}}>
                {new Date(current.expiry_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
              </span>
              {daysUntilExpiry(current.expiry_date) <= 30 && daysUntilExpiry(current.expiry_date) > 0 && (
                <span style={{fontSize:'0.6875rem',color:'#ef4444',fontWeight:700,marginLeft:'0.375rem'}}>({daysUntilExpiry(current.expiry_date)} days!)</span>
              )}
              {daysUntilExpiry(current.expiry_date) <= 0 && <span style={{fontSize:'0.6875rem',color:'#991b1b',fontWeight:700,marginLeft:'0.375rem'}}>EXPIRED</span>}
            </div>
            <div><span style={{color:'var(--text-3)',fontWeight:600}}>Issued by:</span> {current.issued_by_user ? `${current.issued_by_user.first_name} ${current.issued_by_user.last_name}` : '—'}</div>
          </div>
          {current.notes && <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.75rem'}}>Notes: {current.notes}</div>}
          <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
            <button className="btn btn-secondary btn-sm" onClick={() => downloadPdf(current.id)}>Download Card PDF</button>
            <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#dc2626'}} onClick={() => { if (confirm('Report this card as lost or stolen?')) changeStatus(current.id, 'lost', 'Reported lost/stolen'); }}>Report Lost</button>
            <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#dc2626'}} onClick={() => { if (confirm('Revoke this card?')) changeStatus(current.id, 'revoked', 'Revoked by manager'); }}>Revoke</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Mark as returned?')) changeStatus(current.id, 'returned'); }}>Mark Returned</button>
          </div>
        </div>
      ) : !issuing && (
        <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--text-3)',marginBottom:'1rem'}}>
          No active ID card. Click "Issue New Card" to create one.
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div style={{fontSize:'0.6875rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Card History ({history.length})</div>
          {history.map(c => {
            const sc = STATUS_CHIP[c.status] || STATUS_CHIP.returned;
            return (
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.75rem',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',marginBottom:'0.375rem',fontSize:'0.8125rem'}}>
                <div>
                  <span style={{fontWeight:600,marginRight:'0.5rem'}}>{c.card_number}</span>
                  <span style={{color:'var(--text-3)'}}>{new Date(c.issue_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} → {new Date(c.expiry_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
                </div>
                <span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'0.625rem',fontWeight:600,...sc}}>{sc.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
