import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

// ── Field groups ──────────────────────────────────────────────────────────────
// Any field in the group being missing → label shown in Outstanding column.

function getMissingGroups(hr) {
  if (!hr) {
    return ['address', 'date of birth', 'NI number', 'emergency contact',
            'bank details', 'declaration', 'data consent', 'terms'];
  }
  const missing = [];
  function check(label, fields) {
    if (fields.some(f => { const v = hr[f]; return v === null || v === undefined || v === '' || v === false; })) {
      missing.push(label);
    }
  }
  check('address',           ['address_line_1', 'city', 'postcode']);
  check('date of birth',     ['date_of_birth']);
  check('NI number',         ['ni_number']);
  check('emergency contact', ['nok_name', 'nok_phone']);
  check('bank details',      ['bank_account_holder', 'bank_sort_code', 'bank_account_number']);
  check('declaration',       ['self_employment_declaration']);
  check('data consent',      ['gdpr_consent']);
  check('terms',             ['terms_accepted']);
  // UTR only expected when invoicing as an individual
  if (hr.invoices_via_company !== true) check('UTR', ['utr_number']);
  return missing;
}

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  no_link:         { label: 'Not set up',    cls: 'badge-neutral' },
  not_sent:        { label: 'Link not sent', cls: 'badge-neutral' },
  sent_not_opened: { label: 'Link sent',     cls: 'badge-blue'    },
  in_progress:     { label: 'In progress',   cls: 'badge-warning' },
  completed:       { label: 'Completed',     cls: 'badge-success' },
  expired:         { label: 'Expired',       cls: 'badge-danger'  },
  revoked:         { label: 'Revoked',       cls: 'badge-danger'  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge-neutral' };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function lastActivity(link) {
  if (!link) return null;
  const candidates = [link.last_seen_at, link.opened_at, link.completed_at, link.created_at]
    .filter(Boolean).map(d => new Date(d));
  return candidates.length ? new Date(Math.max(...candidates)) : null;
}

function sortScore(status, missingCount) {
  if (status === 'completed') return -Infinity;
  return missingCount * 10 + (status === 'no_link' ? 5 : status === 'expired' ? 3 : status === 'revoked' ? 2 : 0);
}

function buildMessage(firstName, url) {
  return `Hi ${firstName}, this is David at Risk Secured. We need a few details from you so we can pay you properly and keep your records right. It takes about five minutes on your phone. ${url}`;
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MissingCell({ hr, isCompleted }) {
  if (isCompleted) return <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Complete</span>;
  const groups = getMissingGroups(hr);
  if (groups.length === 0) return <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ All filled</span>;
  return (
    <span style={{ color: '#92400e', fontSize: '0.8125rem', lineHeight: 1.5 }}>
      No {groups.join(' · no ')}
    </span>
  );
}

function ActionCell({
  row, freshUrl, creating, revoking, fetchingLink, copiedKey,
  officerId, onCreateLink, onRegenerate, onRevoke,
  onCopyFresh, onFetchAndCopy, onFetchAndMsg,
}) {
  const { status, link } = row;
  const isLive = link && !['completed', 'expired', 'revoked'].includes(status);

  // Completed — show date only
  if (status === 'completed') {
    return <span style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>Done {fmtDate(link?.completed_at)}</span>;
  }

  // Fresh URL in session state (link just created/regenerated this session)
  if (freshUrl) {
    const lnkKey = officerId + '_lnk';
    return (
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" style={{ background: '#14233F' }}
          onClick={() => onFetchAndMsg(freshUrl)}>
          Message template
        </button>
        <button className="btn btn-ghost btn-sm"
          onClick={() => onCopyFresh(freshUrl, lnkKey)}>
          {copiedKey === lnkKey ? '✓ Copied' : 'Copy link'}
        </button>
        {isLive && (
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
            disabled={revoking} onClick={onRevoke}>
            Revoke
          </button>
        )}
      </div>
    );
  }

  // Pre-existing live link — fetch token on demand rather than requiring regeneration
  if (isLive) {
    const lnkKey = officerId + '_lnk';
    return (
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm"
          disabled={fetchingLink} onClick={() => onFetchAndCopy(lnkKey)}>
          {fetchingLink ? 'Fetching…' : copiedKey === lnkKey ? '✓ Copied' : 'Copy link'}
        </button>
        <button className="btn btn-ghost btn-sm"
          disabled={fetchingLink} onClick={onFetchAndMsg}>
          Message
        </button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}
          disabled={creating || revoking} onClick={onRegenerate}>
          Regenerate
        </button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: '0.75rem' }}
          disabled={revoking} onClick={onRevoke}>
          Revoke
        </button>
      </div>
    );
  }

  // No live link (no_link, expired, revoked)
  return (
    <button className="btn btn-primary btn-sm" style={{ background: '#14233F' }}
      disabled={creating} onClick={onCreateLink}>
      {creating ? 'Creating…' : 'Create link'}
    </button>
  );
}

function MessageModal({ firstName, url, onClose, copiedKey, onCopy }) {
  const msg    = buildMessage(firstName, url);
  const msgKey = 'modal_msg';
  const lnkKey = 'modal_lnk';
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Send to {firstName}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
          Paste this into a text message.
        </p>
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '1rem', fontSize: '0.9375rem',
          lineHeight: 1.6, color: 'var(--text)', marginBottom: '1rem', wordBreak: 'break-word',
        }}>
          {msg}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button className="btn btn-primary" style={{ flex: 1, background: '#14233F' }}
            onClick={() => onCopy(msg, msgKey)}>
            {copiedKey === msgKey ? '✓ Copied!' : 'Copy message'}
          </button>
          <button className="btn btn-secondary"
            onClick={() => onCopy(url, lnkKey)}>
            {copiedKey === lnkKey ? '✓ Copied' : 'Copy link only'}
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function OnboardingScreen({ user }) {
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [rows, setRows]               = useState([]);
  // freshUrls: { [officerId]: url } — URLs from links created/regenerated this session
  const [freshUrls, setFreshUrls]     = useState({});
  const [creating, setCreating]       = useState({});     // { [officerId]: bool }
  const [revoking, setRevoking]       = useState({});     // { [linkId]: bool }
  const [fetchingLink, setFetchingLink] = useState({});   // { [officerId]: bool }
  const [copiedKey, setCopiedKey]     = useState(null);
  const [msgModal, setMsgModal]       = useState(null);   // { firstName, url } | null

  const load = useCallback(async () => {
    setError(null);
    try {
      const [officersRes, linksRes] = await Promise.all([
        api.users.list({ role: 'OFFICER' }),
        api.onboarding.links(),
      ]);

      const officers = officersRes.data || [];
      const links    = linksRes.data || [];

      // Fetch full HR records for each officer in parallel.
      // The bulk GET /api/hr?all=true only returns a limited field set,
      // so we need individual calls to derive the missing-field summary.
      const hrResults = await Promise.all(
        officers.map(o =>
          api.hr.getForUser(o.id)
            .then(r => ({ userId: o.id, hr: r.data }))
            .catch(() => ({ userId: o.id, hr: null }))
        )
      );
      const hrByUserId = {};
      for (const { userId, hr } of hrResults) hrByUserId[userId] = hr;

      // Index links by user_id — the bulk list now returns user_id.
      // Keep only the most recent link per officer (list is ordered desc by created_at).
      const linksByUserId = {};
      for (const link of links) {
        if (link.user_id && !linksByUserId[link.user_id]) {
          linksByUserId[link.user_id] = link;
        }
      }

      const built = officers.map(officer => {
        const link        = linksByUserId[officer.id] || null;
        const hr          = hrByUserId[officer.id] || null;
        const isCompleted = hr?.onboarding_completed === true;
        const status      = isCompleted ? 'completed' : (link ? link.status : 'no_link');
        const missing     = getMissingGroups(hr);
        const score       = sortScore(status, missing.length);
        return { officer, link, hr, status, missing, isCompleted, score };
      });

      built.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const na = `${a.officer.first_name} ${a.officer.last_name}`;
        const nb = `${b.officer.first_name} ${b.officer.last_name}`;
        return na.localeCompare(nb);
      });

      setRows(built);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateLink(officer) {
    setCreating(prev => ({ ...prev, [officer.id]: true }));
    try {
      const res = await api.onboarding.createLink(officer.id);
      const url = res.data.url;
      setFreshUrls(prev => ({ ...prev, [officer.id]: url }));
      setMsgModal({ firstName: officer.first_name, url });
      setLoading(true);
      await load();
    } catch (err) {
      alert('Could not create link: ' + err.message);
    } finally {
      setCreating(prev => ({ ...prev, [officer.id]: false }));
    }
  }

  async function handleRegenerate(officer) {
    const ok = window.confirm(
      `Regenerate the link for ${officer.first_name} ${officer.last_name}?\n\n` +
      `This will revoke the existing link. If you have already sent it to them, their copy will stop working and they will need the new one.`
    );
    if (!ok) return;
    await handleCreateLink(officer);
  }

  async function handleRevoke(linkId, officerId) {
    if (!window.confirm('Revoke this link? The officer will not be able to use it.')) return;
    setRevoking(prev => ({ ...prev, [linkId]: true }));
    try {
      await api.onboarding.revokeLink(linkId);
      setFreshUrls(prev => { const n = { ...prev }; delete n[officerId]; return n; });
      setLoading(true);
      await load();
    } catch (err) {
      alert('Could not revoke link: ' + err.message);
    } finally {
      setRevoking(prev => ({ ...prev, [linkId]: false }));
    }
  }

  // Fetches the token for an existing link on demand, then copies URL or opens modal.
  async function handleFetchLink(linkId, officerId, firstName, action, copyKey) {
    setFetchingLink(prev => ({ ...prev, [officerId]: true }));
    try {
      const res = await api.onboarding.getToken(linkId);
      const url = res.data.url;
      if (action === 'copy') {
        handleCopy(url, copyKey);
      } else {
        setMsgModal({ firstName, url });
      }
    } catch (err) {
      alert('Could not retrieve link: ' + err.message);
    } finally {
      setFetchingLink(prev => ({ ...prev, [officerId]: false }));
    }
  }

  function handleCopy(text, key) {
    copyToClipboard(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(k => k === key ? null : k), 2000);
  }

  const notCompleted = rows.filter(r => !r.isCompleted);
  const completed    = rows.filter(r => r.isCompleted);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Onboarding</div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); load(); }}>
          Refresh
        </button>
      </div>

      <div className="page-content">
        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.08)', color: 'var(--danger)',
            padding: '0.75rem 1rem', borderRadius: '8px',
            marginBottom: '1.25rem', fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p>No officers found.</p></div>
        ) : (
          <>
            {notCompleted.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{
                  padding: '0.75rem 1rem', background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Needs action — {notCompleted.length} officer{notCompleted.length !== 1 ? 's' : ''}
                </div>
                <OfficerTable
                  rows={notCompleted}
                  freshUrls={freshUrls}
                  creating={creating}
                  revoking={revoking}
                  fetchingLink={fetchingLink}
                  copiedKey={copiedKey}
                  onCreateLink={handleCreateLink}
                  onRegenerate={handleRegenerate}
                  onRevoke={handleRevoke}
                  onFetchLink={handleFetchLink}
                  onCopy={handleCopy}
                  onShowMsg={(firstName, url) => setMsgModal({ firstName, url })}
                />
              </div>
            )}

            {completed.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '0.75rem 1rem', background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Completed — {completed.length} officer{completed.length !== 1 ? 's' : ''}
                </div>
                <OfficerTable
                  rows={completed}
                  freshUrls={freshUrls}
                  creating={creating}
                  revoking={revoking}
                  fetchingLink={fetchingLink}
                  copiedKey={copiedKey}
                  onCreateLink={handleCreateLink}
                  onRegenerate={handleRegenerate}
                  onRevoke={handleRevoke}
                  onFetchLink={handleFetchLink}
                  onCopy={handleCopy}
                  onShowMsg={(firstName, url) => setMsgModal({ firstName, url })}
                />
              </div>
            )}
          </>
        )}
      </div>

      {msgModal && (
        <MessageModal
          firstName={msgModal.firstName}
          url={msgModal.url}
          onClose={() => setMsgModal(null)}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}

function OfficerTable({ rows, freshUrls, creating, revoking, fetchingLink, copiedKey,
                        onCreateLink, onRegenerate, onRevoke, onFetchLink, onCopy, onShowMsg }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Officer</th>
          <th>Status</th>
          <th>Outstanding</th>
          <th>Last activity</th>
          <th style={{ width: '1%' }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const { officer, link, hr, status, isCompleted } = row;
          const freshUrl = freshUrls[officer.id] || null;
          const act = lastActivity(link);
          const lnkKey = officer.id + '_lnk';

          return (
            <tr key={officer.id}>
              <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {officer.first_name} {officer.last_name}
              </td>
              <td><StatusBadge status={status} /></td>
              <td><MissingCell hr={hr} isCompleted={isCompleted} /></td>
              <td style={{ color: 'var(--text-2)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                {act ? fmtDate(act.toISOString()) : '—'}
              </td>
              <td>
                <ActionCell
                  row={row}
                  freshUrl={freshUrl}
                  creating={creating[officer.id]}
                  revoking={revoking[link?.id]}
                  fetchingLink={fetchingLink[officer.id]}
                  copiedKey={copiedKey}
                  officerId={officer.id}
                  onCreateLink={() => onCreateLink(officer)}
                  onRegenerate={() => onRegenerate(officer)}
                  onRevoke={link ? () => onRevoke(link.id, officer.id) : undefined}
                  onCopyFresh={(url, key) => onCopy(url, key)}
                  onFetchAndCopy={(key) => onFetchLink(link.id, officer.id, officer.first_name, 'copy', key)}
                  onFetchAndMsg={() => onFetchLink(link.id, officer.id, officer.first_name, 'message', lnkKey)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
