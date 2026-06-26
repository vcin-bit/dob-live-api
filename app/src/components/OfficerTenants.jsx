import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

function formatTel(phone) {
  const digits = phone.replace(/\s+/g, '');
  if (digits.startsWith('0')) return '+44' + digits.slice(1);
  return digits;
}

export default function OfficerTenantsScreen({ site }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const res = await api.tenants.list({ site_id: site?.id });
      setTenants(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (site?.id) load(); }, [site?.id]);

  const filtered = search
    ? tenants.filter(t => {
        const q = search.toLowerCase();
        return (t.unit_ref || '').toLowerCase().includes(q) ||
          (t.tenant_name || '').toLowerCase().includes(q) ||
          (t.contacts || []).some(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
          );
      })
    : tenants;

  return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{marginBottom:'0.75rem'}}>
        <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Site Contacts</div>
        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'2px'}}>{site?.name}</div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search tenant, unit, contact name or number..."
        style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'10px',color:'#fff',fontSize:'14px',marginBottom:'0.75rem',boxSizing:'border-box',outline:'none'}}
      />

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>📇</div>
          <div style={{fontSize:'0.875rem'}}>No tenants found</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>{filtered.length} tenant{filtered.length!==1?'s':''}</div>
          {filtered.map(t => {
            const contacts = (t.contacts || []).sort((a, b) => (a.position || 99) - (b.position || 99));
            const isInactive = t.status === 'vacant' || t.status === 'void';
            return (
              <div key={t.id} style={{padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',opacity: isInactive && contacts.length === 0 ? 0.5 : 1}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px',marginBottom: contacts.length > 0 ? '8px' : 0}}>
                  <div style={{flex:1,minWidth:0}}>
                    {t.unit_ref && <div style={{fontSize:'12px',fontFamily:'monospace',fontWeight:700,color:'#60a5fa',letterSpacing:'0.02em'}}>{t.unit_ref}</div>}
                    <div style={{fontSize:'14px',fontWeight:600,color:'#fff',marginTop: t.unit_ref ? '2px' : 0}}>{t.tenant_name}</div>
                  </div>
                  {isInactive && (
                    <span style={{fontSize:'10px',fontWeight:600,padding:'2px 6px',borderRadius:'4px',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',flexShrink:0}}>{t.status}</span>
                  )}
                </div>
                {contacts.length === 0 ? (
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',marginTop:'4px'}}>No contacts on file</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                    {contacts.map(c => (
                      <div key={c.id} style={{padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.06)'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
                          <div style={{flex:1,minWidth:0}}>
                            <span style={{fontSize:'12px',fontWeight:700,color:'rgba(255,255,255,0.5)',marginRight:'6px'}}>{c.position}.</span>
                            <span style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{c.name || '—'}</span>
                            {c.label && <span style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginLeft:'6px',fontWeight:500}}>({c.label})</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:'12px',marginTop:'4px',flexWrap:'wrap'}}>
                          {c.phone && (
                            <a href={`tel:${formatTel(c.phone)}`} style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#4ade80',textDecoration:'none',fontFamily:'monospace',fontWeight:600}}>
                              📞 {c.phone}
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'12px',color:'#60a5fa',textDecoration:'none'}}>
                              ✉ {c.email}
                            </a>
                          )}
                        </div>
                        {c.notes && <div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',marginTop:'3px'}}>{c.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
