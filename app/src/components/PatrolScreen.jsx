import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function PatrolScreen({ user, site, shift }) {
  const navigate = useNavigate();
  const watchRef = useRef(null);

  const [route, setRoute] = useState(null);
  const [session, setSession] = useState(null);
  const [completedCps, setCompletedCps] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showOccurrence, setShowOccurrence] = useState(false);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointSaving, setCheckpointSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [patrolStarted, setPatrolStarted] = useState(false);
  const [isRoutePlanner, setIsRoutePlanner] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [plannerMode, setPlannerMode] = useState(false);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(pos => {
      setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    }, err => console.log('GPS error:', err.message), { enableHighAccuracy: true, maximumAge: 5000 });
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // GPS pings during patrol
  const gpsCountRef = useRef(0);
  useEffect(() => {
    if (!session || !patrolStarted || !currentPos) return;
    gpsCountRef.current++;
    if (gpsCountRef.current % 10 === 0) api.patrols.gps(session.id, currentPos.lat, currentPos.lng).catch(() => {});
  }, [currentPos, session, patrolStarted]);

  // Load route + session
  useEffect(() => {
    if (!site?.id) return;
    async function load() {
      setLoading(true);
      try {
        const [routesRes, activeRes] = await Promise.allSettled([
          api.patrols.getRoutes(site.id),
          api.patrols.activeSession(site.id),
        ]);
        if (activeRes.status === 'fulfilled' && activeRes.value?.data) {
          setSession(activeRes.value.data);
          setPatrolStarted(true);
        }
        const routes = (routesRes.status === 'fulfilled' ? routesRes.value : null)?.data || [];
        if (routes.length > 0) setRoute(routes[0]);
        setIsRoutePlanner(user.is_route_planner || ['COMPANY','OPS_MANAGER','SUPER_ADMIN'].includes(user.role));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [site?.id]);

  async function reloadRoute() {
    try {
      const res = await api.patrols.getRoutes(site.id);
      const routes = res.data || [];
      if (routes.length > 0) setRoute(routes[0]);
      else setRoute(null);
    } catch {}
  }

  async function startPatrol() {
    if (!site) return;
    try {
      const res = await api.patrols.startSession(site.id, route?.id);
      setSession(res.data);
      setPatrolStarted(true);
      setCompletedCps([]);
    } catch (e) { alert('Could not start patrol: ' + e.message); }
  }

  async function markCheckpoint(cp) {
    setCompletedCps(prev => prev.includes(cp.id) ? prev : [...prev, cp.id]);
    if (session?.id) {
      try { await api.patrols.checkpoint(session.id, cp.id, cp.name, currentPos?.lat, currentPos?.lng); }
      catch (e) { console.error('Checkpoint sync failed:', e.message); }
    }
  }

  async function endPatrol() {
    try { if (session?.id) await api.patrols.endSession(session.id); } catch {}
    setPatrolStarted(false); setSession(null); setShowEndConfirm(false); setCompletedCps([]); navigate('/');
  }

  const checkpoints = route?.checkpoints ? [...route.checkpoints].sort((a,b) => a.order_index - b.order_index) : [];
  const nextCp = checkpoints.find(cp => !completedCps.includes(cp.id));

  // ── ROUTE PLANNER MODE ──────────────────────────────────────────────
  if (plannerMode) {
    return <RoutePlannerScreen site={site} existingRoute={route} currentPos={currentPos}
      onClose={() => { setPlannerMode(false); reloadRoute(); }} />;
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#0b1222',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'#0f1929',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        <div>
          <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{site?.name || 'Patrol'}</div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>
            {route ? route.name : 'Free patrol — no fixed route'}
            {patrolStarted && <span style={{color:'#4ade80'}}> · ACTIVE</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {currentPos && <div style={{background:'rgba(0,0,0,0.4)',borderRadius:'999px',padding:'3px 8px',fontSize:'10px',color:'rgba(255,255,255,0.5)'}}>GPS ±{Math.round(currentPos.accuracy)}m</div>}
          {patrolStarted && <div style={{background:'rgba(74,222,128,0.15)',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'999px',padding:'3px 8px',fontSize:'10px',color:'#4ade80',fontWeight:700}}>● LIVE</div>}
        </div>
      </div>

      {/* Pre-patrol buttons */}
      {!patrolStarted && (
        <div style={{padding:'10px 14px',flexShrink:0,display:'flex',flexDirection:'column',gap:'8px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <button onClick={startPatrol}
            style={{width:'100%',padding:'15px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'16px',fontWeight:700,cursor:'pointer'}}>
            ▶ START PATROL
          </button>
          {isRoutePlanner && (
            <button onClick={() => setPlannerMode(true)}
              style={{width:'100%',padding:'12px',background:'rgba(167,139,250,0.12)',border:'1.5px solid rgba(167,139,250,0.4)',borderRadius:'10px',color:'#c4b5fd',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
              🗺 Create / Edit Patrol Route
            </button>
          )}
        </div>
      )}

      {/* Main scrollable content */}
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',minHeight:0}}>
        {/* Progress bar */}
        {patrolStarted && checkpoints.length > 0 && (
          <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
              <span style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>Progress</span>
              <span style={{fontSize:'11px',color:'#fff',fontWeight:500}}>{completedCps.length} / {checkpoints.length}</span>
            </div>
            <div style={{height:'3px',background:'rgba(255,255,255,0.07)',borderRadius:'999px'}}>
              <div style={{height:'100%',width:`${checkpoints.length?completedCps.length/checkpoints.length*100:0}%`,background:'#3b82f6',borderRadius:'999px',transition:'width 0.4s'}} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {patrolStarted && (
          <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'#0b1222'}}>
            {nextCp && (
              <button onClick={() => markCheckpoint(nextCp)}
                style={{width:'100%',padding:'14px',background:'rgba(251,191,36,0.15)',border:'2px solid rgba(251,191,36,0.5)',borderRadius:'10px',color:'#fbbf24',fontSize:'15px',fontWeight:700,cursor:'pointer',marginBottom:'8px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                ✓ REACHED: {nextCp.name}
              </button>
            )}
            <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
              <button disabled={checkpointSaving} onClick={() => setShowCheckpointModal(true)}
                style={{flex:1,padding:'13px',background:checkpointSaving?'rgba(74,222,128,0.12)':'rgba(59,130,246,0.12)',border:`1.5px solid ${checkpointSaving?'rgba(74,222,128,0.35)':'rgba(59,130,246,0.35)'}`,borderRadius:'10px',color:checkpointSaving?'#4ade80':'#60a5fa',fontSize:'12px',fontWeight:700,cursor:checkpointSaving?'default':'pointer'}}>
                {checkpointSaving ? '✓ Saved' : '📍 CHECKPOINT'}
              </button>
              <button onClick={() => setShowReport(true)}
                style={{flex:1,padding:'13px',background:'rgba(239,68,68,0.12)',border:'1.5px solid rgba(239,68,68,0.4)',borderRadius:'10px',color:'#ef4444',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
                ⚠ INCIDENT
              </button>
            </div>
            <button onClick={() => setShowOccurrence(true)}
              style={{width:'100%',padding:'13px',background:'rgba(74,222,128,0.1)',border:'1.5px solid rgba(74,222,128,0.3)',borderRadius:'10px',color:'#4ade80',fontSize:'12px',fontWeight:700,cursor:'pointer',marginBottom:'8px'}}>
              📋 LOG OCCURRENCE
            </button>
            <button onClick={() => setShowEndConfirm(true)}
              style={{width:'100%',padding:'12px',background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.12)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
              END PATROL
            </button>
          </div>
        )}

        {/* Checkpoints */}
        <div style={{padding:'12px 14px',flex:1}}>
          {checkpoints.length > 0 ? (
            <>
              <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Checkpoints</div>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {checkpoints.map((cp, i) => {
                  const done = completedCps.includes(cp.id);
                  const canMark = patrolStarted && !done;
                  return (
                    <div key={cp.id} style={{
                      padding:'12px',
                      background:done?'rgba(74,222,128,0.06)':canMark?'rgba(251,191,36,0.05)':'rgba(255,255,255,0.02)',
                      border:`1px solid ${done?'rgba(74,222,128,0.15)':canMark?'rgba(251,191,36,0.25)':'rgba(255,255,255,0.06)'}`,
                      borderRadius:'10px',
                    }}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                        <div style={{width:24,height:24,borderRadius:'50%',background:done?'rgba(74,222,128,0.2)':canMark?'#fbbf24':'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'11px',fontWeight:700,color:done?'#4ade80':canMark?'#0b1222':'rgba(255,255,255,0.3)'}}>
                          {done ? '✓' : i+1}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',fontWeight:600,color:done?'rgba(255,255,255,0.45)':'#fff'}}>{cp.name}</div>
                          {cp.what_to_look_for && (
                            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'3px',lineHeight:1.4}}>{cp.what_to_look_for}</div>
                          )}
                        </div>
                        {cp.image_url && (
                          <img src={cp.image_url} style={{width:48,height:48,borderRadius:'6px',objectFit:'cover',flexShrink:0,border:'1px solid rgba(255,255,255,0.1)'}} />
                        )}
                      </div>
                      {/* Action buttons for active patrol */}
                      {canMark && (
                        <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                          <button onClick={() => markCheckpoint(cp)}
                            style={{flex:1,padding:'9px',background:'rgba(74,222,128,0.12)',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'8px',color:'#4ade80',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>
                            ✓ All Clear
                          </button>
                          <button onClick={() => { setShowOccurrence(true); }}
                            style={{flex:1,padding:'9px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'8px',color:'#fbbf24',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>
                            ⚠ Observation
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : !loading && (
            <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.25)',fontSize:'13px'}}>
              No fixed route — use the Checkpoint button above to log locations as you patrol
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEndConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px',textAlign:'center'}}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>End Patrol?</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.45)',marginBottom:'20px',lineHeight:1.5}}>This will end your current patrol session.</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowEndConfirm(false)} style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Cancel</button>
              <button onClick={endPatrol} style={{flex:1,padding:'13px',background:'rgba(239,68,68,0.15)',border:'1.5px solid rgba(239,68,68,0.4)',borderRadius:'10px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>End Patrol</button>
            </div>
          </div>
        </div>
      )}
      {showCheckpointModal && <CheckpointModal site={site} session={session} currentPos={currentPos} route={route} isRoutePlanner={isRoutePlanner} onClose={() => setShowCheckpointModal(false)} onSaved={() => { setShowCheckpointModal(false); setCheckpointSaving(true); setTimeout(() => setCheckpointSaving(false), 3000); }} />}
      {showReport && <ReportModal user={user} site={site} session={session} onClose={() => setShowReport(false)} />}
      {showOccurrence && <OccurrenceModal site={site} shift={shift} onClose={() => setShowOccurrence(false)} />}
    </div>
  );
}

// ── ROUTE PLANNER SCREEN ─────────────────────────────────────────────────────
function RoutePlannerScreen({ site, existingRoute, currentPos, onClose }) {
  const [routeName, setRouteName] = useState(existingRoute?.name || '');
  const [checkpoints, setCheckpoints] = useState(
    existingRoute?.checkpoints
      ? [...existingRoute.checkpoints].sort((a,b) => a.order_index - b.order_index).map(cp => ({ name: cp.name || '', what_to_look_for: cp.what_to_look_for || '', image_url: cp.image_url || '', lat: cp.lat, lng: cp.lng }))
      : []
  );
  const [addingCp, setAddingCp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveRoute() {
    if (!routeName.trim()) { setError('Route name is required'); return; }
    if (checkpoints.length < 1) { setError('Add at least one checkpoint'); return; }
    setSaving(true); setError('');
    try {
      const cps = checkpoints.map((cp, i) => ({ ...cp, order_index: i }));
      if (existingRoute?.id) {
        await api.patrols.updateRoute(existingRoute.id, routeName, '', cps);
      } else {
        await api.patrols.createRoute(site.id, routeName, '', cps);
      }
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function moveCheckpoint(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= checkpoints.length) return;
    const arr = [...checkpoints];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setCheckpoints(arr);
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#0b1222',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'rgba(167,139,250,0.08)',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(167,139,250,0.2)',flexShrink:0}}>
        <div>
          <div style={{fontSize:'13px',fontWeight:700,color:'#c4b5fd'}}>Route Planner</div>
          <div style={{fontSize:'10px',color:'rgba(167,139,250,0.5)',marginTop:'1px'}}>{site?.name}</div>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'1.25rem',cursor:'pointer'}}>×</button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
        {/* Guidance */}
        <div style={{padding:'12px',background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:'10px',marginBottom:'14px',fontSize:'12px',color:'rgba(167,139,250,0.8)',lineHeight:1.5}}>
          Plan this route as if you're training a new officer. Walk the site and mark every vulnerable point as a checkpoint. For each one: name it clearly, describe what to check, and take a photo so the next officer knows exactly what they're looking at.
        </div>

        {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}

        {/* Route name */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Route Name *</div>
          <input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="e.g. Main Perimeter Check"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px 11px',fontSize:'13px',color:'#fff',boxSizing:'border-box',fontFamily:'inherit'}} />
        </div>

        {/* GPS */}
        {currentPos && (
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'10px'}}>
            GPS: {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)} (±{Math.round(currentPos.accuracy)}m)
          </div>
        )}

        {/* Add checkpoint button */}
        <button onClick={() => setAddingCp(true)}
          style={{width:'100%',padding:'12px',background:'rgba(167,139,250,0.12)',border:'1.5px solid rgba(167,139,250,0.4)',borderRadius:'10px',color:'#c4b5fd',fontSize:'13px',fontWeight:700,cursor:'pointer',marginBottom:'14px'}}>
          📍 Add Checkpoint Here
        </button>

        {/* Checkpoint list */}
        {checkpoints.length > 0 && (
          <>
            <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Checkpoints ({checkpoints.length})</div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
              {checkpoints.map((cp, i) => (
                <div key={i} style={{padding:'10px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:'#a78bfa',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#0b1222',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{cp.name}</div>
                      {cp.what_to_look_for && <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px',lineHeight:1.4}}>{cp.what_to_look_for}</div>}
                    </div>
                    {cp.image_url && <img src={cp.image_url} style={{width:40,height:40,borderRadius:'5px',objectFit:'cover',flexShrink:0}} />}
                  </div>
                  <div style={{display:'flex',gap:'6px',marginTop:'8px',justifyContent:'flex-end'}}>
                    {i > 0 && <button onClick={() => moveCheckpoint(i, -1)} style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'4px',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'2px 8px',fontSize:'11px'}}>↑</button>}
                    {i < checkpoints.length - 1 && <button onClick={() => moveCheckpoint(i, 1)} style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'4px',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'2px 8px',fontSize:'11px'}}>↓</button>}
                    <button onClick={() => setCheckpoints(prev => prev.filter((_, j) => j !== i))} style={{background:'none',border:'1px solid rgba(220,38,38,0.2)',borderRadius:'4px',color:'rgba(220,38,38,0.6)',cursor:'pointer',padding:'2px 8px',fontSize:'11px'}}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Save */}
        <button onClick={saveRoute} disabled={saving}
          style={{width:'100%',padding:'14px',background:'#a78bfa',border:'none',borderRadius:'10px',color:'#0b1222',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:saving?0.7:1}}>
          {saving ? 'Saving...' : existingRoute?.id ? 'Update Route' : 'Save Route'}
        </button>
      </div>

      {/* Add checkpoint modal */}
      {addingCp && (
        <AddCheckpointModal currentPos={currentPos}
          onSave={(cp) => { setCheckpoints(prev => [...prev, cp]); setAddingCp(false); }}
          onClose={() => setAddingCp(false)} />
      )}
    </div>
  );
}

// ── Add Checkpoint Modal ─────────────────────────────────────────────────────
function AddCheckpointModal({ currentPos, onSave, onClose }) {
  const [name, setName] = useState('');
  const [whatToLookFor, setWhatToLookFor] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.patrols.uploadCheckpointImage(file);
      setImageUrl(res.url);
    } catch (err) { console.error('Image upload failed:', err.message); }
    finally { setUploading(false); }
  }

  function save() {
    if (!name.trim() || !whatToLookFor.trim()) return;
    onSave({
      name: name.trim(),
      what_to_look_for: whatToLookFor.trim(),
      image_url: imageUrl || null,
      lat: currentPos?.lat || null,
      lng: currentPos?.lng || null,
    });
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#0f1929',borderRadius:'16px 16px 0 0',padding:'0 0 20px',width:'100%',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{width:'40px',height:'4px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',margin:'10px auto 0'}} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{fontSize:'14px',fontWeight:700,color:'#c4b5fd'}}>Add Checkpoint</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'14px 16px'}}>
          {currentPos && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'10px'}}>GPS: {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}</div>}

          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'5px'}}>Name *</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder='e.g. "Rear Gate Unit 48-50"'
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px 11px',fontSize:'13px',color:'#fff',boxSizing:'border-box',fontFamily:'inherit'}} />
          </div>

          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'5px'}}>What to look for *</div>
            <textarea value={whatToLookFor} onChange={e => setWhatToLookFor(e.target.value)} rows={3}
              placeholder='e.g. "Check gate is padlocked, no signs of forced entry, no vehicles parked against fence"'
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'9px 11px',fontSize:'13px',color:'#fff',resize:'none',boxSizing:'border-box',fontFamily:'inherit'}} />
          </div>

          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'5px'}}>Photo (optional)</div>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              {imageUrl && <img src={imageUrl} style={{width:56,height:56,borderRadius:'8px',objectFit:'cover',border:'1px solid rgba(255,255,255,0.1)'}} />}
              <label style={{padding:'8px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',cursor:'pointer',fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>
                {uploading ? 'Uploading...' : imageUrl ? 'Change photo' : 'Take / upload photo'}
                <input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={uploadImage} disabled={uploading} />
              </label>
            </div>
          </div>

          <button onClick={save} disabled={!name.trim() || !whatToLookFor.trim()}
            style={{width:'100%',padding:'14px',background:'#a78bfa',border:'none',borderRadius:'10px',color:'#0b1222',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:(!name.trim()||!whatToLookFor.trim())?0.5:1}}>
            Save Checkpoint
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Checkpoint Log Modal ─────────────────────────────────────────────────────
function CheckpointModal({ site, session, currentPos, route, isRoutePlanner, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savePermanent, setSavePermanent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.logs.create({ site_id: site?.id, log_type: 'PATROL', title: name.trim(), description: description.trim() || `Checkpoint: ${name.trim()}`, occurred_at: new Date().toISOString(), latitude: currentPos?.lat, longitude: currentPos?.lng, type_data: { checkpoint: true, patrol_session_id: session?.id } });
      if (savePermanent && route?.id && currentPos) {
        try {
          const existing = route.checkpoints || [];
          await api.patrols.updateRoute(route.id, route.name, route.instructions || '', [...existing, { lat: currentPos.lat, lng: currentPos.lng, name: name.trim(), order_index: existing.length }]);
        } catch (e) { console.error('Failed to save permanent checkpoint:', e.message); }
      }
      onSaved();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#0f1929',borderRadius:'16px 16px 0 0',padding:'0 0 20px',width:'100%',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{width:'40px',height:'4px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',margin:'10px auto 0'}} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{fontSize:'14px',fontWeight:700,color:'#fff'}}>Log Checkpoint</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'14px 16px'}}>
          {currentPos && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'10px'}}>GPS: {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)} (±{Math.round(currentPos.accuracy)}m)</div>}
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Checkpoint Name *</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rear Gate, Car Park North" style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px 11px',fontSize:'13px',color:'#fff',boxSizing:'border-box',fontFamily:'inherit'}} />
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Description (optional)</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What was checked or found..." style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'9px 11px',fontSize:'13px',color:'#fff',resize:'none',boxSizing:'border-box',fontFamily:'inherit'}} />
          </div>
          {isRoutePlanner && route?.id && currentPos && (
            <div onClick={() => setSavePermanent(p => !p)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',background:savePermanent?'rgba(167,139,250,0.08)':'rgba(255,255,255,0.03)',border:`1px solid ${savePermanent?'rgba(167,139,250,0.3)':'rgba(255,255,255,0.07)'}`,borderRadius:'10px',marginBottom:'14px',cursor:'pointer'}}>
              <div><div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>Save as permanent checkpoint</div><div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>Add to {route.name} for future patrols</div></div>
              <div style={{width:'38px',height:'22px',background:savePermanent?'#a78bfa':'rgba(255,255,255,0.1)',borderRadius:'999px',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:3,left:savePermanent?'auto':'3px',right:savePermanent?'3px':'auto',width:16,height:16,background:'#fff',borderRadius:'50%',transition:'all 0.2s'}} /></div>
            </div>
          )}
          <button onClick={save} disabled={saving || !name.trim()} style={{width:'100%',padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:saving||!name.trim()?0.5:1}}>
            {saving ? 'Saving...' : 'Save Checkpoint'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({ user, site, session, onClose }) {
  const [type, setType] = useState('INCIDENT');
  const [notes, setNotes] = useState('');
  const [clientReportable, setClientReportable] = useState(false);
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const types = [
    { key:'INCIDENT', label:'Security Incident', color:'#ef4444' },
    { key:'ALARM', label:'Alarm Activation', color:'#f97316' },
    { key:'ACCESS_CONTROL', label:'Access / Entry', color:'#3b82f6' },
    { key:'GENERAL', label:'Safety / Hazard', color:'#fbbf24' },
    { key:'VEHICLE_CHECK', label:'Suspicious Vehicle', color:'#a78bfa' },
    { key:'MAINTENANCE', label:'Maintenance', color:'rgba(255,255,255,0.5)' },
    { key:'OTHER', label:'Other', color:'rgba(255,255,255,0.35)' },
  ];
  async function handleMedia(e) {
    const files = Array.from(e.target.files);
    const uploads = await Promise.all(files.map(async file => {
      const form = new FormData(); form.append('file', file);
      try {
        const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
        const token = await window.__clerkGetToken?.() || '';
        const res = await fetch(`${API}/api/patrols/media/upload`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json(); return { url: data.url, name: file.name, type: file.type };
      } catch { return null; }
    }));
    setMedia(prev => [...prev, ...uploads.filter(Boolean)]);
  }
  async function submit() {
    if (!notes.trim()) { alert('Please add a description'); return; }
    setSaving(true);
    try {
      await api.logs.create({ site_id: site?.id, log_type: type, title: `Patrol Report: ${types.find(t=>t.key===type)?.label}`, description: notes, client_reportable: clientReportable, type_data: { media, patrol_session_id: session?.id } });
      onClose();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#0f1929',borderRadius:'16px 16px 0 0',padding:'0 0 20px',width:'100%',maxHeight:'90vh',overflowY:'auto',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{width:'40px',height:'4px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',margin:'10px auto 0'}} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div><div style={{fontSize:'14px',fontWeight:700,color:'#fff'}}>Log Occurrence</div><div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>{site?.name}</div></div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'14px 16px'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Type</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'14px'}}>
            {types.map(t => (<button key={t.key} onClick={() => setType(t.key)} style={{padding:'6px 12px',background:type===t.key?`rgba(${hexToRgb(t.color)},0.15)`:'rgba(255,255,255,0.04)',border:`${type===t.key?'1.5':'1'}px solid ${type===t.key?t.color:'rgba(255,255,255,0.08)'}`,borderRadius:'8px',fontSize:'12px',color:type===t.key?t.color:'rgba(255,255,255,0.5)',fontWeight:type===t.key?600:400,cursor:'pointer'}}>{t.label}</button>))}
          </div>
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Description</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Describe what you found..." style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'9px 11px',fontSize:'13px',color:'#fff',resize:'none',boxSizing:'border-box',marginBottom:'14px'}} />
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Photos / Video</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'14px'}}>
            {media.map((m, i) => (<div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>{m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>video</div>}<button onClick={() => setMedia(p => p.filter((_,j)=>j!==i))} style={{position:'absolute',top:2,right:2,width:16,height:16,background:'rgba(239,68,68,0.8)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>))}
            <label style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}><div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div><div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo/Video</div><input type="file" accept="image/*,video/*" multiple style={{display:'none'}} onChange={handleMedia} /></label>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',background:clientReportable?'rgba(59,130,246,0.07)':'rgba(255,255,255,0.03)',border:`1px solid ${clientReportable?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.07)'}`,borderRadius:'10px',marginBottom:'14px',cursor:'pointer'}} onClick={() => setClientReportable(p => !p)}>
            <div><div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>Report to client</div><div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>{clientReportable ? 'Visible in client portal + ops' : 'Ops only'}</div></div>
            <div style={{width:'38px',height:'22px',background:clientReportable?'#3b82f6':'rgba(255,255,255,0.1)',borderRadius:'999px',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:3,left:clientReportable?'auto':'3px',right:clientReportable?'3px':'auto',width:16,height:16,background:'#fff',borderRadius:'50%',transition:'all 0.2s'}} /></div>
          </div>
          <button onClick={submit} disabled={saving} style={{width:'100%',padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:saving?0.7:1}}>{saving ? 'Submitting...' : 'Submit Report'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Occurrence Modal ─────────────────────────────────────────────────────────
function OccurrenceModal({ site, shift, onClose }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const categories = ['Abandoned Vehicle','Fly Tipping','H&S Hazard','Unsecured Building/Door','Suspicious Person','Criminal Damage','Trespass','Theft','Other'];
  async function handleMedia(e) {
    const files = Array.from(e.target.files);
    const uploads = await Promise.all(files.map(async file => {
      const form = new FormData(); form.append('file', file);
      try {
        const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
        const token = await window.__clerkGetToken?.() || '';
        const res = await fetch(`${API}/api/patrols/media/upload`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json(); return { url: data.url, name: file.name, type: file.type };
      } catch { return null; }
    }));
    setMedia(prev => [...prev, ...uploads.filter(Boolean)]);
  }
  async function submit() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await api.logs.create({ log_type: 'GENERAL', title: category || 'Other', description, client_reportable: false, site_id: site?.id, shift_id: shift?.id || null, occurred_at: new Date().toISOString(), type_data: media.length ? { media } : undefined });
      setSaved(true); setTimeout(() => onClose(), 1500);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }
  if (saved) return (<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{background:'#0f1929',borderRadius:'16px',padding:'2rem 3rem',textAlign:'center'}}><div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>✓</div><div style={{fontSize:'15px',fontWeight:700,color:'#4ade80'}}>Logged</div></div></div>);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#0f1929',borderRadius:'16px 16px 0 0',padding:'0 0 20px',width:'100%',maxHeight:'90vh',overflowY:'auto',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{width:'40px',height:'4px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',margin:'10px auto 0'}} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div><div style={{fontSize:'14px',fontWeight:700,color:'#fff'}}>Log Occurrence</div><div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>{site?.name}</div></div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'14px 16px'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Category</div>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px 11px',fontSize:'13px',color:'#fff',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}}><option value="">Select category...</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Description</div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe what you found..." style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'9px 11px',fontSize:'13px',color:'#fff',resize:'none',boxSizing:'border-box',marginBottom:'14px',fontFamily:'inherit'}} />
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Photos / Video</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'14px'}}>
            {media.map((m, i) => (<div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>{m.type?.startsWith('image') ? <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>video</div>}<button onClick={() => setMedia(p => p.filter((_,j)=>j!==i))} style={{position:'absolute',top:2,right:2,width:16,height:16,background:'rgba(239,68,68,0.8)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>))}
            <label style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}><div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div><div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo/Video</div><input type="file" accept="image/*,video/*" multiple style={{display:'none'}} onChange={handleMedia} /></label>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={onClose} style={{flex:1,padding:'14px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Cancel</button>
            <button onClick={submit} disabled={saving || !description.trim()} style={{flex:2,padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:saving||!description.trim()?0.5:1}}>{saving ? 'Submitting...' : 'Submit'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  if (!hex.startsWith('#')) return '255,255,255';
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
