import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function VisitorManagementScreen({ user }) {
  const [visitors, setVisitors] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (siteFilter) params.site_id = siteFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.from = new Date(dateFrom).toISOString();
      if (dateTo) params.to = new Date(dateTo + 'T23:59:59').toISOString();
      if (search) params.search = search;
      const [vRes, sRes] = await Promise.all([
        api.visitors.list(params),
        api.sites.list(),
      ]);
      setVisitors(vRes.data || []);
      setSites(sRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [siteFilter, statusFilter, dateFrom, dateTo]);

  // Client-side search filter for instant results
  const filtered = search
    ? visitors.filter(v => {
        const q = search.toLowerCase();
        return (v.visitor_name || '').toLowerCase().includes(q) ||
               (v.company_name || '').toLowerCase().includes(q) ||
               (v.vehicle_reg || '').toLowerCase().includes(q) ||
               (v.pass_number || '').toLowerCase().includes(q);
      })
    : visitors;

  function exportCSV() {
    const headers = ['Name','Company','Site','Pass','Vehicle','Personnel','Time In','Time Out','Status','Officer'];
    const rows = filtered.map(v => [
      v.visitor_name, v.company_name || '', v.site?.name || '', v.pass_number || '', v.vehicle_reg || '',
      v.personnel_count, v.time_in ? new Date(v.time_in).toLocaleString('en-GB', { timeZone:'Europe/London' }) : '',
      v.time_out ? new Date(v.time_out).toLocaleString('en-GB', { timeZone:'Europe/London' }) : '',
      v.status, v.officer ? `${v.officer.first_name} ${v.officer.last_name}` : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `visitors-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  }

  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' }) : '—';
  const fmtDate = t => t ? new Date(t).toLocaleDateString('en-GB', { day:'2-digit', month:'short', timeZone:'Europe/London' }) : '—';

  // Quick filters
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Visitor Management</div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={filtered.length === 0}>Export CSV</button>
      </div>
      <div className="page-content">
        {/* Search + filters */}
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
          <input className="input" style={{width:'200px'}} placeholder="Search name, company, reg..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{width:'150px'}} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
            <option value="">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{display:'flex',gap:'2px',background:'var(--surface-2)',borderRadius:'6px',padding:'2px'}}>
            {[['','All'],['on_site','On Site']].map(([k,l]) => (
              <button key={k} onClick={() => { setStatusFilter(k); setDateFrom(''); setDateTo(''); }}
                style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                  background: statusFilter===k && !dateFrom ? 'var(--blue)' : 'transparent',
                  color: statusFilter===k && !dateFrom ? '#fff' : 'var(--text-2)'}}>
                {l}
              </button>
            ))}
            <button onClick={() => { setDateFrom(today); setDateTo(today); setStatusFilter(''); }}
              style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                background: dateFrom===today && dateTo===today ? 'var(--blue)' : 'transparent',
                color: dateFrom===today && dateTo===today ? '#fff' : 'var(--text-2)'}}>
              Today
            </button>
            <button onClick={() => { setDateFrom(weekAgo); setDateTo(today); setStatusFilter(''); }}
              style={{padding:'0.375rem 0.75rem',borderRadius:'4px',border:'none',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600,
                background: dateFrom===weekAgo ? 'var(--blue)' : 'transparent',
                color: dateFrom===weekAgo ? '#fff' : 'var(--text-2)'}}>
              This Week
            </button>
          </div>
          <input type="date" className="input" style={{width:'130px'}} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" style={{width:'130px'}} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <span style={{fontSize:'0.8125rem',color:'var(--text-3)'}}>{filtered.length} visitor{filtered.length!==1?'s':''}</span>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={load} style={{marginBottom:'1rem'}}>Refresh</button>

        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No visitors found</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Company</th><th>Site</th><th>Pass</th><th>Vehicle</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Officer</th></tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} onClick={() => setSelected(v)} style={{cursor:'pointer'}}>
                  <td style={{fontWeight:500}}>{v.visitor_name}</td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.company_name || v.who_visiting || '—'}</td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.site?.name || '—'}</td>
                  <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{v.pass_number || '—'}</td>
                  <td style={{fontFamily:'monospace',fontSize:'0.8125rem',color:'var(--text-2)'}}>{v.vehicle_reg || '—'}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{fmtDate(v.time_in)} {fmtTime(v.time_in)}</td>
                  <td style={{fontSize:'0.8125rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>{v.time_out ? `${fmtDate(v.time_out)} ${fmtTime(v.time_out)}` : '—'}</td>
                  <td>
                    <span className={`badge ${v.status==='on_site'?'badge-success':'badge-neutral'}`}>
                      {v.status === 'on_site' ? 'ON SITE' : 'OFF SITE'}
                    </span>
                  </td>
                  <td style={{color:'var(--text-2)',fontSize:'0.8125rem'}}>{v.officer ? `${v.officer.first_name} ${v.officer.last_name}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Visitor Details</div>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Name</div><div style={{fontWeight:500}}>{selected.visitor_name}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Company / Visiting</div><div>{selected.company_name || selected.who_visiting || '—'}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Site</div><div>{selected.site?.name || '—'}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Pass Number</div><div style={{fontFamily:'monospace'}}>{selected.pass_number || '—'}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Vehicle</div><div style={{fontFamily:'monospace'}}>{selected.vehicle_reg || '—'}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Personnel</div><div>{selected.personnel_count || 1}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Time In</div><div>{fmtDate(selected.time_in)} {fmtTime(selected.time_in)}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Time Out</div><div>{selected.time_out ? `${fmtDate(selected.time_out)} ${fmtTime(selected.time_out)}` : 'Still on site'}</div></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Status</div><span className={`badge ${selected.status==='on_site'?'badge-success':'badge-neutral'}`}>{selected.status==='on_site'?'ON SITE':'OFF SITE'}</span></div>
              <div><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Officer</div><div>{selected.officer ? `${selected.officer.first_name} ${selected.officer.last_name}` : '—'}</div></div>
              {selected.notes && <div style={{gridColumn:'1/-1'}}><div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.25rem'}}>Notes</div><div>{selected.notes}</div></div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
