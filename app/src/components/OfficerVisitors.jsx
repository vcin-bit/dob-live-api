import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function OfficerVisitorsScreen({ site }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exitModal, setExitModal] = useState(null);
  const [passReturned, setPassReturned] = useState(true);
  const [exiting, setExiting] = useState(false);

  async function load() {
    try {
      const res = await api.visitors.list({ site_id: site?.id, status: 'on_site', limit: 50 });
      setVisitors(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (site?.id) load(); }, [site?.id]);

  async function signOut(v) {
    setExiting(true);
    try {
      await api.visitors.update(v.id, {
        time_out: new Date().toISOString(),
        status: 'off_site',
        notes: passReturned ? 'Pass returned' : 'Pass NOT returned',
      });
      setExitModal(null);
      load();
    } catch (err) { alert(err.message); }
    finally { setExiting(false); }
  }

  const fmtTime = t => new Date(t).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' });

  return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>On Site Now</div>
        <div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'2px'}}>{site?.name}</div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      ) : visitors.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>👥</div>
          <div style={{fontSize:'0.875rem'}}>No visitors currently on site</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>{visitors.length} visitor{visitors.length!==1?'s':''} on site</div>
          {visitors.map(v => (
            <div key={v.id} style={{padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{v.visitor_name}</div>
                  {v.who_visiting && <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>Visiting: {v.who_visiting}</div>}
                  <div style={{display:'flex',gap:'12px',marginTop:'4px',fontSize:'11px',color:'rgba(255,255,255,0.35)'}}>
                    {v.pass_number && <span>Pass: {v.pass_number}</span>}
                    {v.vehicle_reg && <span>Reg: {v.vehicle_reg}</span>}
                    <span>In: {fmtTime(v.time_in)}</span>
                    {v.personnel_count > 1 && <span>{v.personnel_count} persons</span>}
                  </div>
                </div>
                <button onClick={() => { setExitModal(v); setPassReturned(true); }}
                  style={{padding:'10px 16px',background:'rgba(239,68,68,0.12)',border:'1.5px solid rgba(239,68,68,0.4)',borderRadius:'8px',color:'#ef4444',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}}>
                  EXIT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exit confirmation modal */}
      {exitModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px'}}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'4px'}}>Sign Out Visitor</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.45)',marginBottom:'16px'}}>{exitModal.visitor_name}</div>

            <div onClick={() => setPassReturned(p => !p)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px',background:passReturned?'rgba(74,222,128,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${passReturned?'rgba(74,222,128,0.25)':'rgba(239,68,68,0.25)'}`,borderRadius:'10px',marginBottom:'16px',cursor:'pointer'}}>
              <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>Pass returned?</div>
              <div style={{width:'38px',height:'22px',background:passReturned?'#4ade80':'#ef4444',borderRadius:'999px',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                <div style={{position:'absolute',top:3,left:passReturned?'auto':'3px',right:passReturned?'3px':'auto',width:16,height:16,background:'#fff',borderRadius:'50%',transition:'all 0.2s'}} />
              </div>
            </div>

            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setExitModal(null)}
                style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={() => signOut(exitModal)} disabled={exiting}
                style={{flex:1,padding:'13px',background:'rgba(239,68,68,0.15)',border:'1.5px solid rgba(239,68,68,0.4)',borderRadius:'10px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                {exiting ? 'Logging...' : 'Log Exit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
