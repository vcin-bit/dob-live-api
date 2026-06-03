import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const RISK_COLOUR = { low: '#16a34a', medium: '#f59e0b', high: '#ef4444', very_high: '#991b1b' };
const STATUS_BADGE = {
  draft: { bg: '#f3f4f6', color: '#374151', label: 'Draft' },
  under_review: { bg: '#fef3c7', color: '#92400e', label: 'Under Review' },
  approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  expired: { bg: '#fee2e2', color: '#991b1b', label: 'Expired' },
  superseded: { bg: '#e0e7ff', color: '#3730a3', label: 'Superseded' },
};
const TYPE_LABEL = { security: 'Security', hse: 'HSE', combined: 'Combined' };

function riskLevel(score) { return score >= 20 ? 'very_high' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low'; }
function riskLabel(level) { return (level || '').replace('_', ' ').toUpperCase(); }

// ── 5x5 Risk Matrix ────────────────────────────────────────────────────────
function RiskMatrix({ likelihood, severity, onSelect }) {
  const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const cellColour = (l, s) => { const sc = l * s; return sc >= 20 ? '#991b1b' : sc >= 12 ? '#ef4444' : sc >= 6 ? '#f59e0b' : '#16a34a'; };
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',fontSize:'0.6875rem',textAlign:'center',width:'100%',maxWidth:'320px'}}>
        <thead>
          <tr><th style={{width:'60px'}} />{labels.map((l,i) => <th key={i} style={{padding:'4px 2px',color:'var(--text-3)',fontWeight:600}}>{i+1}</th>)}</tr>
          <tr><th style={{fontSize:'0.5625rem',color:'var(--text-3)'}}>L / S</th>{labels.map((l,i) => <th key={i} style={{padding:'0 2px 4px',fontSize:'0.5rem',color:'var(--text-3)'}}>{l}</th>)}</tr>
        </thead>
        <tbody>
          {[5,4,3,2,1].map(l => (
            <tr key={l}>
              <td style={{padding:'4px',fontWeight:600,color:'var(--text-3)',textAlign:'right'}}>{l}</td>
              {[1,2,3,4,5].map(s => {
                const sc = l * s;
                const sel = likelihood === l && severity === s;
                return (
                  <td key={s} onClick={() => onSelect(l, s)}
                    style={{padding:0,cursor:'pointer'}}>
                    <div style={{margin:'1px',padding:'6px 2px',borderRadius:'4px',fontWeight:700,color:'#fff',
                      background: cellColour(l, s), opacity: sel ? 1 : 0.5, outline: sel ? '2px solid var(--text)' : 'none',
                      fontSize:'0.75rem'}}>{sc}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{fontSize:'0.5625rem',color:'var(--text-3)',marginTop:'2px'}}>Likelihood (rows) x Severity (columns)</div>
    </div>
  );
}

// ── Add Risk Form ───────────────────────────────────────────────────────────
function AddRiskForm({ assessmentId, assessmentType, categories, onAdded, onCancel }) {
  const cats = categories.filter(c => c.assessment_type === assessmentType || c.assessment_type === 'combined');
  const [form, setForm] = useState({
    risk_category_id: cats[0]?.id || '', hazard_description: '', who_at_risk: '', potential_consequences: '',
    existing_controls: '', additional_controls: '', likelihood_score: 3, severity_score: 3,
    residual_likelihood: 2, residual_severity: 2,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showResidual, setShowResidual] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const score = form.likelihood_score * form.severity_score;
  const level = riskLevel(score);
  const rScore = form.residual_likelihood * form.residual_severity;
  const rLevel = riskLevel(rScore);

  async function save() {
    if (!form.hazard_description) { setError('Hazard description is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await api.riskAssessments.addRisk(assessmentId, form);
      if (res?.data) {
        onAdded();
      } else {
        setError('Risk may have been saved. Please close and reopen the assessment to check.');
      }
    } catch (e) {
      console.error('[RiskAssessment] Add risk failed:', e);
      setError(e.message || 'Failed to save risk. Please try again.');
    }
    finally { setSaving(false); }
  }

  return (
    <div style={{border:'2px solid var(--blue)',borderRadius:'8px',padding:'1rem',background:'rgba(59,130,246,0.02)',marginBottom:'1rem'}}>
      <div style={{fontWeight:700,color:'var(--text)',marginBottom:'0.75rem',fontSize:'0.875rem'}}>Add Risk</div>
      {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
        <div className="field">
          <label className="label">Category</label>
          <select className="input" value={form.risk_category_id} onChange={e => f('risk_category_id', e.target.value)}>
            <option value="">General</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Hazard Description</label>
          <textarea className="input" rows={2} value={form.hazard_description} onChange={e => f('hazard_description', e.target.value)} placeholder="What is the hazard? Describe the potential danger." />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">Who Could Be Harmed</label>
            <input className="input" value={form.who_at_risk} onChange={e => f('who_at_risk', e.target.value)} placeholder="e.g. Officers, visitors, public" />
          </div>
          <div className="field">
            <label className="label">Potential Consequences</label>
            <input className="input" value={form.potential_consequences} onChange={e => f('potential_consequences', e.target.value)} placeholder="e.g. Injury, financial loss, death" />
          </div>
        </div>
        <div className="field">
          <label className="label">Existing Controls</label>
          <textarea className="input" rows={2} value={form.existing_controls} onChange={e => f('existing_controls', e.target.value)} placeholder="What controls are already in place to manage this risk?" />
        </div>

        {/* Initial Risk Scoring */}
        <div style={{borderTop:'1px solid var(--border)',paddingTop:'0.75rem'}}>
          <div style={{fontWeight:700,fontSize:'0.75rem',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Initial Risk Score</div>
          <div style={{display:'flex',gap:'1.5rem',alignItems:'flex-start',flexWrap:'wrap'}}>
            <RiskMatrix likelihood={form.likelihood_score} severity={form.severity_score} onSelect={(l,s) => { f('likelihood_score', l); f('severity_score', s); }} />
            <div style={{padding:'0.75rem',background: RISK_COLOUR[level] + '15', borderRadius:'8px',border:`1.5px solid ${RISK_COLOUR[level]}`,textAlign:'center',minWidth:'100px'}}>
              <div style={{fontSize:'2rem',fontWeight:800,color:RISK_COLOUR[level]}}>{score}</div>
              <div style={{fontSize:'0.75rem',fontWeight:700,color:RISK_COLOUR[level],textTransform:'uppercase'}}>{riskLabel(level)}</div>
              <div style={{fontSize:'0.625rem',color:'var(--text-3)',marginTop:'4px'}}>L:{form.likelihood_score} x S:{form.severity_score}</div>
            </div>
          </div>
        </div>

        <div className="field">
          <label className="label">Additional Controls Needed</label>
          <textarea className="input" rows={2} value={form.additional_controls} onChange={e => f('additional_controls', e.target.value)} placeholder="What further measures should be implemented?" />
        </div>

        {/* Residual Risk */}
        <div style={{borderTop:'1px solid var(--border)',paddingTop:'0.75rem'}}>
          <button type="button" onClick={() => setShowResidual(!showResidual)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',padding:0,display:'flex',alignItems:'center',gap:'0.25rem'}}>
            <span>{showResidual ? '▾' : '▸'}</span> Residual Risk Score (after additional controls)
          </button>
          {showResidual && (
            <div style={{marginTop:'0.75rem',display:'flex',gap:'1.5rem',alignItems:'flex-start',flexWrap:'wrap'}}>
              <RiskMatrix likelihood={form.residual_likelihood} severity={form.residual_severity} onSelect={(l,s) => { f('residual_likelihood', l); f('residual_severity', s); }} />
              <div style={{padding:'0.75rem',background: RISK_COLOUR[rLevel] + '15', borderRadius:'8px',border:`1.5px solid ${RISK_COLOUR[rLevel]}`,textAlign:'center',minWidth:'100px'}}>
                <div style={{fontSize:'2rem',fontWeight:800,color:RISK_COLOUR[rLevel]}}>{rScore}</div>
                <div style={{fontSize:'0.75rem',fontWeight:700,color:RISK_COLOUR[rLevel],textTransform:'uppercase'}}>{riskLabel(rLevel)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem',justifyContent:'flex-end'}}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Add Risk'}</button>
      </div>
    </div>
  );
}

// ── Assessment Detail / Editor ──────────────────────────────────────────────
function AssessmentDetail({ assessment, user, onBack, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [addingRisk, setAddingRisk] = useState(false);

  async function loadDetail() {
    setLoading(true);
    try {
      const [res, catRes] = await Promise.all([
        api.riskAssessments.get(assessment.id),
        api.riskAssessments.categories(),
      ]);
      setDetail(res.data);
      setCategories(catRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDetail(); }, [assessment.id]);

  async function deleteRisk(riskId) {
    if (!confirm('Remove this risk?')) return;
    try {
      await api.riskAssessments.deleteRisk(assessment.id, riskId);
      loadDetail();
    } catch (e) { alert(e.message); }
  }

  async function updateStatus(status) {
    try {
      const updates = { status };
      if (status === 'approved') { updates.approved_date = new Date().toISOString().split('T')[0]; updates.approver_id = user.id; }
      await api.riskAssessments.update(assessment.id, updates);
      onUpdated();
      loadDetail();
    } catch (e) { alert(e.message); }
  }

  // Calculate overall risk from individual risks
  function overallLevel() {
    if (!detail?.risks?.length) return null;
    const maxScore = Math.max(...detail.risks.map(r => r.risk_score || 0));
    return riskLevel(maxScore);
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>;
  if (!detail) return null;

  const sb = STATUS_BADGE[detail.status] || STATUS_BADGE.draft;
  const ol = overallLevel();

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1rem'}}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:'1.125rem',color:'var(--text)'}}>{detail.title}</div>
          <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>{detail.reference_number} · {TYPE_LABEL[detail.assessment_type]} · {detail.site?.name}</div>
        </div>
        <span style={{padding:'4px 10px',borderRadius:'4px',fontSize:'0.75rem',fontWeight:600,background:sb.bg,color:sb.color}}>{sb.label}</span>
      </div>

      {/* Info cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:'0.75rem',marginBottom:'1rem'}}>
        <div className="card" style={{padding:'0.75rem'}}>
          <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Assessment Date</div>
          <div style={{fontWeight:600,marginTop:'0.25rem'}}>{new Date(detail.assessment_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
        <div className="card" style={{padding:'0.75rem'}}>
          <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Review Due</div>
          <div style={{fontWeight:600,marginTop:'0.25rem'}}>{detail.review_date ? new Date(detail.review_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}</div>
        </div>
        <div className="card" style={{padding:'0.75rem'}}>
          <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Assessor</div>
          <div style={{fontWeight:600,marginTop:'0.25rem'}}>{detail.assessor ? `${detail.assessor.first_name} ${detail.assessor.last_name}` : '—'}</div>
        </div>
        {ol && <div className="card" style={{padding:'0.75rem',borderLeft:`3px solid ${RISK_COLOUR[ol]}`}}>
          <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Overall Risk</div>
          <div style={{fontWeight:700,color:RISK_COLOUR[ol],marginTop:'0.25rem',textTransform:'uppercase'}}>{riskLabel(ol)}</div>
        </div>}
        <div className="card" style={{padding:'0.75rem'}}>
          <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Risks Identified</div>
          <div style={{fontWeight:700,fontSize:'1.25rem',marginTop:'0.25rem'}}>{detail.risks?.length || 0}</div>
        </div>
      </div>

      {/* Scope */}
      {detail.scope && (
        <div className="card" style={{padding:'0.75rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'0.625rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.375rem'}}>Scope</div>
          <div style={{fontSize:'0.8125rem',color:'var(--text-2)',lineHeight:1.6}}>{detail.scope}</div>
        </div>
      )}

      {/* Risk Register */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
        <div style={{fontWeight:700,color:'var(--text)',fontSize:'0.9375rem'}}>Risk Register</div>
        {detail.status === 'draft' && !addingRisk && (
          <button className="btn btn-primary btn-sm" onClick={() => setAddingRisk(true)}>+ Add Risk</button>
        )}
      </div>

      {addingRisk && (
        <AddRiskForm assessmentId={assessment.id} assessmentType={detail.assessment_type}
          categories={categories} onAdded={() => { setAddingRisk(false); loadDetail(); }} onCancel={() => setAddingRisk(false)} />
      )}

      {detail.risks?.length > 0 ? (
        <div className="card" style={{padding:0,overflow:'hidden',marginBottom:'1rem'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8125rem'}}>
            <thead>
              <tr style={{background:'var(--surface-2)'}}>
                <th style={{textAlign:'left',padding:'0.625rem 0.75rem',fontWeight:700,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Hazard</th>
                <th style={{textAlign:'left',padding:'0.625rem 0.5rem',fontWeight:700,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Who</th>
                <th style={{textAlign:'center',padding:'0.625rem 0.5rem',fontWeight:700,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Risk</th>
                <th style={{textAlign:'left',padding:'0.625rem 0.5rem',fontWeight:700,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Controls</th>
                <th style={{textAlign:'center',padding:'0.625rem 0.5rem',fontWeight:700,color:'var(--text-3)',fontSize:'0.6875rem',textTransform:'uppercase'}}>Residual</th>
                {detail.status === 'draft' && <th style={{width:'32px'}} />}
              </tr>
            </thead>
            <tbody>
              {detail.risks.map(r => (
                <tr key={r.id} style={{borderTop:'1px solid var(--border)'}}>
                  <td style={{padding:'0.625rem 0.75rem',verticalAlign:'top'}}>
                    <div style={{fontWeight:600,fontSize:'0.75rem',color:RISK_COLOUR[r.risk_level]}}>{r.category?.name || 'General'}</div>
                    <div style={{marginTop:'2px'}}>{r.hazard_description}</div>
                  </td>
                  <td style={{padding:'0.625rem 0.5rem',verticalAlign:'top',fontSize:'0.75rem',color:'var(--text-2)'}}>{r.who_at_risk || '—'}</td>
                  <td style={{padding:'0.625rem 0.5rem',textAlign:'center',verticalAlign:'top'}}>
                    <div style={{display:'inline-block',padding:'3px 8px',borderRadius:'4px',fontWeight:700,fontSize:'0.6875rem',color:'#fff',background:RISK_COLOUR[r.risk_level]}}>{r.risk_score}</div>
                  </td>
                  <td style={{padding:'0.625rem 0.5rem',verticalAlign:'top',fontSize:'0.75rem',color:'var(--text-2)'}}>
                    {r.existing_controls && <div>{r.existing_controls}</div>}
                    {r.additional_controls && <div style={{color:'#1a52a8',marginTop:'4px'}}>+ {r.additional_controls}</div>}
                  </td>
                  <td style={{padding:'0.625rem 0.5rem',textAlign:'center',verticalAlign:'top'}}>
                    {r.residual_score ? <div style={{display:'inline-block',padding:'3px 8px',borderRadius:'4px',fontWeight:700,fontSize:'0.6875rem',color:'#fff',background:RISK_COLOUR[r.residual_level]}}>{r.residual_score}</div> : '—'}
                  </td>
                  {detail.status === 'draft' && <td style={{padding:'0.625rem 0.25rem',verticalAlign:'top'}}>
                    <button onClick={() => deleteRisk(r.id)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'0.75rem',padding:'2px'}}>x</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !addingRisk && (
        <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--text-3)',marginBottom:'1rem'}}>
          No risks identified yet. Click "+ Add Risk" to begin.
        </div>
      )}

      {/* Actions */}
      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
        <button className="btn btn-secondary btn-sm" onClick={async () => {
                          try {
                            const token = await (window.__clerkGetToken ? window.__clerkGetToken() : window.Clerk?.session?.getToken?.());
                            const res = await fetch(api.riskAssessments.pdfUrl(assessment.id), { headers: { Authorization: `Bearer ${token}` } });
                            if (!res.ok) throw new Error('PDF download failed');
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          } catch (e) { alert('Could not download PDF: ' + e.message); }
                        }}>Download PDF</button>
        {detail.status === 'draft' && detail.risks?.length > 0 && (
          <button className="btn btn-sm" style={{background:'#fef3c7',border:'1px solid #f59e0b',color:'#92400e'}} onClick={() => updateStatus('under_review')}>Submit for Review</button>
        )}
        {(detail.status === 'draft' || detail.status === 'under_review') && (
          <button className="btn btn-primary btn-sm" onClick={() => updateStatus('approved')}>Approve</button>
        )}
      </div>
    </div>
  );
}

// ── Main List Component ─────────────────────────────────────────────────────
export default function RiskAssessmentList({ siteId, siteName, user }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.riskAssessments.list({ site_id: siteId });
      setAssessments(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [siteId]);

  function reviewStatus(a) {
    if (a.status === 'expired' || a.status === 'superseded') return a.status;
    if (!a.review_date) return 'current';
    const days = (new Date(a.review_date) - new Date()) / 86400000;
    return days < 0 ? 'overdue' : days < 30 ? 'due_soon' : 'current';
  }

  const REVIEW_BADGE = {
    current: { bg: '#dcfce7', color: '#166534', label: 'Current' },
    due_soon: { bg: '#fef3c7', color: '#92400e', label: 'Due Soon' },
    overdue: { bg: '#fee2e2', color: '#991b1b', label: 'Overdue' },
  };

  if (viewing) return <AssessmentDetail assessment={viewing} user={user} onBack={() => { setViewing(null); load(); }} onUpdated={load} />;
  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div className="section-title" style={{margin:0}}>Risk Assessments</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Assessment</button>
      </div>

      {assessments.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:'2.5rem',color:'var(--text-3)'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>No risk assessments yet</div>
          <div style={{fontSize:'0.875rem'}}>Create your first assessment to identify and manage risks at {siteName}.</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
          {assessments.map(a => {
            const sb = STATUS_BADGE[a.status] || STATUS_BADGE.draft;
            const rs = reviewStatus(a);
            const rb = REVIEW_BADGE[rs];
            return (
              <div key={a.id} className="card" style={{padding:'0.875rem 1rem',cursor:'pointer'}} onClick={() => setViewing(a)}>
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                  <div style={{width:'4px',height:'40px',borderRadius:'2px',background:RISK_COLOUR[a.overall_risk_level] || '#d1d5db',flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'2px'}}>
                      {a.reference_number} · {TYPE_LABEL[a.assessment_type] || a.assessment_type} · {new Date(a.assessment_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                    </div>
                  </div>
                  <span style={{padding:'3px 8px',borderRadius:'4px',fontSize:'0.6875rem',fontWeight:600,background:sb.bg,color:sb.color}}>{sb.label}</span>
                  {rs !== 'current' && rb && <span style={{padding:'3px 8px',borderRadius:'4px',fontSize:'0.6875rem',fontWeight:600,background:rb.bg,color:rb.color}}>{rb.label}</span>}
                  <span style={{color:'var(--text-3)'}}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal siteId={siteId} siteName={siteName} onClose={() => setShowCreate(false)} onCreated={(a) => { setShowCreate(false); load(); if (a?.id) setViewing(a); }} />}
    </div>
  );
}

// ── Create Modal ────────────────────────────────────────────────────────────
function CreateModal({ siteId, siteName, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: `${siteName} — Security Risk Assessment ${new Date().getFullYear()}`,
    scope: `Assessment of security risks at ${siteName} covering all areas accessible to security personnel, visitors, and staff.`,
    assessment_type: 'security',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.title || !form.scope) { setError('Title and scope are required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await api.riskAssessments.create({ site_id: siteId, ...form });
      if (res?.data) {
        onCreated(res.data);
      } else {
        setError('Assessment created but no data returned. Please refresh and check the list.');
        onCreated(null);
      }
    } catch (e) {
      console.error('[RiskAssessment] Create failed:', e);
      setError(e.message || 'Failed to save. Please try again.');
    }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'520px'}}>
        <div className="modal-header">
          <div className="modal-title">New Risk Assessment — {siteName}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">Type</label>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {[['security','Security'],['hse','HSE'],['combined','Combined']].map(([v,l]) => (
                <button key={v} type="button" onClick={() => { f('assessment_type', v); f('title', `${siteName} — ${l} Risk Assessment ${new Date().getFullYear()}`); }}
                  style={{flex:1,padding:'0.5rem',border: form.assessment_type === v ? '2px solid var(--blue)' : '1px solid var(--border)',
                    borderRadius:'6px',background: form.assessment_type === v ? 'rgba(26,82,168,0.06)' : 'var(--surface)',
                    cursor:'pointer',fontSize:'0.8125rem',fontWeight: form.assessment_type === v ? 700 : 500,
                    color: form.assessment_type === v ? 'var(--blue)' : 'var(--text-2)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Title</label><input className="input" value={form.title} onChange={e => f('title', e.target.value)} /></div>
          <div className="field"><label className="label">Scope</label><textarea className="input" rows={3} value={form.scope} onChange={e => f('scope', e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create & Add Risks'}</button>
        </div>
      </div>
    </div>
  );
}
