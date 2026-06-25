import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { compressImage, isImage } from '../lib/imageUtils';

const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';

export default function OfficerVisitorsScreen({ site }) {
  const [visitors, setVisitors] = useState([]);
  const [expected, setExpected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exitModal, setExitModal] = useState(null);
  const [passReturned, setPassReturned] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [arrivalModal, setArrivalModal] = useState(null);

  async function load() {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
      const [onSiteRes, expectedRes] = await Promise.all([
        api.visitors.list({ site_id: site?.id, status: 'on_site', limit: 50 }),
        api.expectedVisitors.list({ site_id: site?.id, date: today }),
      ]);
      setVisitors(onSiteRes.data || []);
      setExpected(expectedRes.data || []);
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

      {/* Expected today */}
      {!loading && expected.length > 0 && (
        <div style={{marginBottom:'1.5rem'}}>
          <div style={{marginBottom:'0.75rem'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Expected Today</div>
            <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',marginTop:'4px'}}>{expected.length} expected</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {expected.map(v => (
              <div key={v.id} style={{padding:'12px',background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'10px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{v.visitor_name}</div>
                    {v.company_name && <div style={{fontSize:'11px',color:'rgba(255,255,255,0.45)',marginTop:'1px'}}>{v.company_name}</div>}
                    {v.who_visiting && <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>Purpose: {v.who_visiting}</div>}
                    <div style={{display:'flex',gap:'12px',marginTop:'4px',fontSize:'11px',color:'rgba(255,255,255,0.35)'}}>
                      {v.expected_time && <span>ETA: {v.expected_time.slice(0,5)}</span>}
                      {v.vehicle_reg && <span>Reg: {v.vehicle_reg}</span>}
                      {v.personnel_count > 1 && <span>{v.personnel_count} persons</span>}
                    </div>
                  </div>
                  <button onClick={() => setArrivalModal(v)}
                    style={{padding:'10px 14px',background:'rgba(16,185,129,0.12)',border:'1.5px solid rgba(16,185,129,0.4)',borderRadius:'8px',color:'#10b981',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}}>
                    ARRIVED
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Arrival modal */}
      {arrivalModal && <ArrivalModal visitor={arrivalModal} onClose={() => setArrivalModal(null)} onArrived={() => { setArrivalModal(null); load(); }} />}
    </div>
  );
}

function ArrivalModal({ visitor, onClose, onArrived }) {
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const mediaInputRef = useRef(null);

  async function handlePhoto(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const rawFile = files[0];
    setPhotoPreview(URL.createObjectURL(rawFile));
    setUploading(true);
    try {
      const file = isImage(rawFile) ? await compressImage(rawFile) : rawFile;
      const fd = new FormData();
      fd.append('file', file);
      const token = await window.__clerkGetToken?.() || '';
      const r = await fetch(`${API}/api/patrols/media/upload`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      const d = await r.json();
      if (d.url) setPhotoUrl(d.url);
      else throw new Error('No URL in response');
    } catch (err) {
      console.error('Photo upload error:', err);
      setError('Photo upload failed');
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function confirmArrival() {
    setSubmitting(true);
    setError('');
    try {
      const body = {};
      if (notes.trim()) body.notes = notes.trim();
      if (photoUrl) body.arrival_photo_url = photoUrl;
      await api.expectedVisitors.arrive(visitor.id, body);
      onArrived();
    } catch (err) {
      if (err.status === 404) {
        setError('Already arrived or not found');
        setTimeout(() => onArrived(), 1500);
      } else {
        setError(err.message || 'Failed to mark arrival');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
      <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px'}}>
        <div style={{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'4px'}}>Mark Arrival</div>
        <div style={{fontSize:'13px',color:'rgba(255,255,255,0.45)',marginBottom:'16px'}}>{visitor.visitor_name}{visitor.company_name ? ` — ${visitor.company_name}` : ''}</div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          style={{width:'100%',padding:'10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'#fff',fontSize:'13px',resize:'none',marginBottom:'12px',boxSizing:'border-box'}}
        />

        {/* Photo */}
        {createPortal(<input ref={mediaInputRef} type="file" accept="image/*" capture="environment" style={{position:'absolute',top:0,left:0,width:'1px',height:'1px',opacity:0,pointerEvents:'none'}} onChange={handlePhoto} />, document.body)}
        <div style={{marginBottom:'12px'}}>
          {photoPreview ? (
            <div style={{position:'relative',display:'inline-block'}}>
              <img src={photoPreview} alt="Arrival" style={{width:64,height:64,objectFit:'cover',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.15)'}} />
              {uploading && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',borderRadius:'8px',fontSize:'9px',color:'#fff'}}>Uploading...</div>}
            </div>
          ) : (
            <button type="button" onClick={() => mediaInputRef.current?.click()}
              style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
              <div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
              <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo</div>
            </button>
          )}
        </div>

        {error && <div style={{fontSize:'12px',color:'#ef4444',marginBottom:'8px'}}>{error}</div>}

        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={onClose}
            style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
            Cancel
          </button>
          <button onClick={confirmArrival} disabled={submitting || uploading}
            style={{flex:1,padding:'13px',background:'rgba(16,185,129,0.15)',border:'1.5px solid rgba(16,185,129,0.4)',borderRadius:'10px',color:'#10b981',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity: (submitting || uploading) ? 0.5 : 1}}>
            {submitting ? 'Logging...' : uploading ? 'Uploading...' : 'Confirm Arrival'}
          </button>
        </div>
      </div>
    </div>
  );
}
