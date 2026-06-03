import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const STATUS_BADGE = {
  draft: { bg: '#f3f4f6', color: '#374151', label: 'Draft' },
  under_review: { bg: '#fef3c7', color: '#92400e', label: 'Under Review' },
  approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  expired: { bg: '#fee2e2', color: '#991b1b', label: 'Expired' },
  superseded: { bg: '#e0e7ff', color: '#3730a3', label: 'Superseded' },
};

const RISK_COLOUR = { low: '#16a34a', medium: '#f59e0b', high: '#ef4444', very_high: '#991b1b' };
const TYPE_LABEL = { security: 'Security', hse: 'HSE', combined: 'Combined' };

export default function RiskAssessmentList({ siteId, siteName, user }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.riskAssessments.list({ site_id: siteId });
      setAssessments(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [siteId]);

  async function expand(id) {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetailLoading(true);
    try {
      const res = await api.riskAssessments.get(id);
      setDetail(res.data);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  }

  function reviewStatus(a) {
    if (a.status === 'expired' || a.status === 'superseded') return a.status;
    if (!a.review_date) return 'current';
    const review = new Date(a.review_date);
    const now = new Date();
    const daysUntil = (review - now) / 86400000;
    if (daysUntil < 0) return 'overdue';
    if (daysUntil < 30) return 'due_soon';
    return 'current';
  }

  const REVIEW_BADGE = {
    current: { bg: '#dcfce7', color: '#166534', label: 'Current' },
    due_soon: { bg: '#fef3c7', color: '#92400e', label: 'Review Due Soon' },
    overdue: { bg: '#fee2e2', color: '#991b1b', label: 'Overdue' },
  };

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div className="section-title" style={{margin:0}}>Risk Assessments — {siteName}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Assessment</button>
      </div>

      {assessments.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:'2rem',color:'var(--text-3)'}}>
          No risk assessments for this site yet.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
          {assessments.map(a => {
            const sb = STATUS_BADGE[a.status] || STATUS_BADGE.draft;
            const rs = reviewStatus(a);
            const rb = REVIEW_BADGE[rs] || REVIEW_BADGE.current;
            const isExpanded = expanded === a.id;
            return (
              <div key={a.id} className="card" style={{padding:0,overflow:'hidden'}}>
                <div onClick={() => expand(a.id)} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.875rem 1rem',cursor:'pointer',background: isExpanded ? 'rgba(59,130,246,0.04)' : 'transparent'}}>
                  <div style={{width:'4px',height:'40px',borderRadius:'2px',background: RISK_COLOUR[a.overall_risk_level] || '#d1d5db',flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'0.9375rem',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginTop:'2px'}}>
                      {a.reference_number} · {TYPE_LABEL[a.assessment_type] || a.assessment_type} · {new Date(a.assessment_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                    </div>
                  </div>
                  <span style={{padding:'3px 8px',borderRadius:'4px',fontSize:'0.6875rem',fontWeight:600,background:sb.bg,color:sb.color}}>{sb.label}</span>
                  {rs !== 'current' && a.status !== 'expired' && <span style={{padding:'3px 8px',borderRadius:'4px',fontSize:'0.6875rem',fontWeight:600,background:rb.bg,color:rb.color}}>{rb.label}</span>}
                  <span style={{color:'var(--text-3)',fontSize:'0.75rem'}}>{isExpanded ? '▾' : '▸'}</span>
                </div>

                {isExpanded && (
                  <div style={{borderTop:'1px solid var(--border)',padding:'1rem'}}>
                    {detailLoading ? (
                      <div style={{textAlign:'center',padding:'1rem'}}><div className="spinner" /></div>
                    ) : detail ? (
                      <div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1rem',fontSize:'0.8125rem'}}>
                          <div><span style={{color:'var(--text-3)',fontWeight:600}}>Assessor:</span> {detail.assessor ? `${detail.assessor.first_name} ${detail.assessor.last_name}` : '—'}</div>
                          <div><span style={{color:'var(--text-3)',fontWeight:600}}>Review Date:</span> {detail.review_date ? new Date(detail.review_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '—'}</div>
                          {detail.overall_risk_level && <div><span style={{color:'var(--text-3)',fontWeight:600}}>Overall Risk:</span> <span style={{color: RISK_COLOUR[detail.overall_risk_level],fontWeight:700,textTransform:'uppercase'}}>{detail.overall_risk_level.replace('_',' ')}</span></div>}
                          {detail.residual_risk_level && <div><span style={{color:'var(--text-3)',fontWeight:600}}>Residual Risk:</span> <span style={{color: RISK_COLOUR[detail.residual_risk_level],fontWeight:700,textTransform:'uppercase'}}>{detail.residual_risk_level.replace('_',' ')}</span></div>}
                        </div>
                        {detail.scope && <div style={{fontSize:'0.8125rem',color:'var(--text-2)',marginBottom:'0.75rem'}}><strong>Scope:</strong> {detail.scope}</div>}

                        {/* Risks */}
                        {detail.risks?.length > 0 ? (
                          <div>
                            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Identified Risks ({detail.risks.length})</div>
                            {detail.risks.map(r => (
                              <div key={r.id} style={{border:'1px solid var(--border)',borderRadius:'6px',padding:'0.625rem',marginBottom:'0.5rem',borderLeft:`3px solid ${RISK_COLOUR[r.risk_level] || '#d1d5db'}`}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                  <span style={{fontWeight:600,fontSize:'0.8125rem'}}>{r.category?.name || 'General'}</span>
                                  <span style={{fontSize:'0.6875rem',fontWeight:700,color: RISK_COLOUR[r.risk_level],textTransform:'uppercase'}}>{(r.risk_level || '').replace('_',' ')} ({r.risk_score})</span>
                                </div>
                                <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginTop:'0.25rem'}}>{r.hazard_description}</div>
                                {r.existing_controls && <div style={{fontSize:'0.6875rem',color:'var(--text-3)',marginTop:'0.25rem'}}>Controls: {r.existing_controls}</div>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{fontSize:'0.8125rem',color:'var(--text-3)',fontStyle:'italic'}}>No risks identified yet.</div>
                        )}

                        {/* Actions */}
                        <div style={{display:'flex',gap:'0.5rem',marginTop:'1rem',flexWrap:'wrap'}}>
                          <a href={api.riskAssessments.pdfUrl(a.id)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Download PDF</a>
                          {a.status === 'draft' && <button className="btn btn-primary btn-sm" onClick={async () => {
                            await api.riskAssessments.update(a.id, { status: 'approved', approved_date: new Date().toISOString().split('T')[0], approver_id: user.id });
                            load();
                          }}>Approve</button>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <CreateAssessmentModal siteId={siteId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateAssessmentModal({ siteId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', scope: '', assessment_type: 'security', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.title || !form.scope) { setError('Title and scope are required'); return; }
    setSaving(true);
    try {
      await api.riskAssessments.create({ site_id: siteId, ...form });
      onCreated();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'500px'}}>
        <div className="modal-header">
          <div className="modal-title">New Risk Assessment</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          <div className="field">
            <label className="label">Assessment Type</label>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {[['security','Security'],['hse','HSE'],['combined','Combined']].map(([v,l]) => (
                <button key={v} type="button" onClick={() => f('assessment_type', v)}
                  style={{flex:1,padding:'0.5rem',border: form.assessment_type === v ? '2px solid var(--blue)' : '1px solid var(--border)',
                    borderRadius:'6px',background: form.assessment_type === v ? 'rgba(26,82,168,0.06)' : 'var(--surface)',
                    cursor:'pointer',fontSize:'0.8125rem',fontWeight: form.assessment_type === v ? 700 : 500,
                    color: form.assessment_type === v ? 'var(--blue)' : 'var(--text-2)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="e.g. Planetary Ind Estate — Security Risk Assessment 2026" />
          </div>
          <div className="field">
            <label className="label">Scope</label>
            <textarea className="input" rows={3} value={form.scope} onChange={e => f('scope', e.target.value)} placeholder="What areas, activities, and personnel does this assessment cover?" />
          </div>
          <div className="field">
            <label className="label">Description (optional)</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => f('description', e.target.value)} placeholder="Additional context or notes" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create Assessment'}</button>
        </div>
      </div>
    </div>
  );
}
