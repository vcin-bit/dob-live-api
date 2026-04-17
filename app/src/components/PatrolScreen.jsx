import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const SUPABASE_URL = 'https://bxesqjzkuredqzvepomn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZXNxanprdXJlZHF6dmVwb21uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1OTI1NzMsImV4cCI6MjA1OTE2ODU3M30.cOTbJpb3GDpCTClCBbOTCmNxaSJiQIupAiCVEoLsEjM';

export default function PatrolScreen({ user, site, shift }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const watchRef = useRef(null);
  const trailRef = useRef([]);
  const polylineRef = useRef(null);

  const [route, setRoute] = useState(null);
  const [session, setSession] = useState(null);
  const [completedCps, setCompletedCps] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [mapType, setMapType] = useState('satellite');
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [patrolStarted, setPatrolStarted] = useState(false);
  const [isRoutePlanner, setIsRoutePlanner] = useState(false);
  const [plannerMode, setPlannerMode] = useState(false);
  const [plannerPoints, setPlannerPoints] = useState([]);
  const [plannerName, setPlannerName] = useState('');
  const [cpNames, setCpNames] = useState({});

  // Load Leaflet
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      setTimeout(() => initMap(), 100);
    }
    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false });

    const tiles = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      map: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
    };
    tiles.satellite.addTo(map);
    mapInstanceRef.current = map;
    mapInstanceRef.current._tiles = tiles;
    map.setView([52.48, -1.89], 16);
    L.control.zoom({ position: 'topright' }).addTo(map);
    startGPS();
  }

  function switchMapType(type) {
    setMapType(type);
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map) return;
    map.eachLayer(l => { if (l._url) map.removeLayer(l); });
    if (type === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    }
  }

  function startGPS() {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      setCurrentPos({ lat, lng, accuracy });
      const L = window.L;
      const map = mapInstanceRef.current;
      if (!map) return;
      if (!markerRef.current) {
        const icon = L.divIcon({ html: '<div style="width:14px;height:14px;background:#3b82f6;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>', iconSize: [14,14], iconAnchor: [7,7] });
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        map.setView([lat, lng], 18);
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      // Track trail if patrol active
      if (session && patrolStarted) {
        trailRef.current.push([lat, lng]);
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(trailRef.current);
        } else {
          polylineRef.current = L.polyline(trailRef.current, { color: '#3b82f6', weight: 2.5, dashArray: '6,4' }).addTo(map);
        }
        // Ping GPS to server every 10 points
        if (trailRef.current.length % 10 === 0) {
          api.patrols.gps(session.id, lat, lng).catch(() => {});
        }
      }
    }, err => console.log('GPS error:', err.message), { enableHighAccuracy: true, maximumAge: 5000 });
  }

  // Load route for site
  useEffect(() => {
    if (!site?.id) return;
    async function load() {
      setLoading(true);
      try {
        const res = await api.patrols.getRoutes(site.id);
        const routes = res.data || [];
        if (routes.length > 0) {
          const r = routes[0];
          setRoute(r);
          drawRouteOnMap(r);
        }
        setIsRoutePlanner(user.is_route_planner || ['COMPANY','OPS_MANAGER','SUPER_ADMIN'].includes(user.role));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [site?.id]);

  function drawRouteOnMap(r) {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !r?.checkpoints?.length) return;
    const sorted = [...r.checkpoints].sort((a,b) => a.order_index - b.order_index);
    const coords = sorted.filter(cp => cp.lat && cp.lng).map(cp => [cp.lat, cp.lng]);
    if (!coords.length) return;
    L.polyline(coords, { color: '#a78bfa', weight: 2, dashArray: '6,3', opacity: 0.7 }).addTo(map);
    sorted.forEach((cp, i) => {
      if (!cp.lat || !cp.lng) return;
      const icon = L.divIcon({ html: `<div style="width:22px;height:22px;background:#a78bfa;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0b1222">${i+1}</div>`, iconSize:[22,22], iconAnchor:[11,11] });
      L.marker([cp.lat, cp.lng], { icon }).addTo(map).bindPopup(cp.name || `Checkpoint ${i+1}`);
    });
    if (coords.length) map.fitBounds(coords, { padding: [30,30] });
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
    if (!session) return;
    try {
      await api.patrols.checkpoint(session.id, cp.id, cp.name, currentPos?.lat, currentPos?.lng);
      setCompletedCps(prev => [...prev, cp.id]);
    } catch (e) { console.error(e); }
  }

  async function endPatrol() {
    if (!session) return;
    if (!window.confirm('End this patrol?')) return;
    try {
      await api.patrols.endSession(session.id);
      setPatrolStarted(false);
      setSession(null);
      navigate('/');
    } catch (e) { alert('Error ending patrol'); }
  }

  // Planner mode
  function enablePlannerMode() {
    setPlannerMode(true);
    setPlannerPoints([]);
    const map = mapInstanceRef.current;
    if (!map) return;
    map.on('click', e => {
      const { lat, lng } = e.latlng;
      const L = window.L;
      setPlannerPoints(prev => {
        const idx = prev.length;
        const icon = L.divIcon({ html: `<div style="width:22px;height:22px;background:#a78bfa;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0b1222">${idx+1}</div>`, iconSize:[22,22], iconAnchor:[11,11] });
        L.marker([lat,lng], { icon }).addTo(map);
        return [...prev, { lat, lng, name: '' }];
      });
    });
  }

  function disablePlannerMode() {
    setPlannerMode(false);
    mapInstanceRef.current?.off('click');
  }

  async function saveRoute() {
    if (!plannerName.trim() || plannerPoints.length < 2) {
      alert('Route needs a name and at least 2 checkpoints');
      return;
    }
    const checkpoints = plannerPoints.map((p, i) => ({ ...p, name: cpNames[i] || `Checkpoint ${i+1}` }));
    try {
      await api.patrols.createRoute(site.id, plannerName, '', checkpoints);
      disablePlannerMode();
      const res = await api.patrols.getRoutes(site.id);
      if (res.data?.length) { setRoute(res.data[0]); drawRouteOnMap(res.data[0]); }
      alert('Route saved!');
    } catch (e) { alert('Error saving route: ' + e.message); }
  }

  const checkpoints = route?.checkpoints ? [...route.checkpoints].sort((a,b) => a.order_index - b.order_index) : [];
  const nextCp = checkpoints.find(cp => !completedCps.includes(cp.id));

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#0b1222',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'#0f1929',padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        <div>
          <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{site?.name || 'Patrol'}</div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>
            {route ? route.name : 'No route configured'}
            {patrolStarted && ' · ACTIVE'}
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {patrolStarted && <div style={{background:'rgba(74,222,128,0.15)',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'999px',padding:'3px 8px',fontSize:'10px',color:'#4ade80',fontWeight:600}}>ACTIVE</div>}
          {isRoutePlanner && !patrolStarted && (
            <button onClick={() => plannerMode ? disablePlannerMode() : enablePlannerMode()}
              style={{padding:'4px 8px',background:plannerMode?'rgba(167,139,250,0.2)':'rgba(255,255,255,0.08)',border:`1px solid ${plannerMode?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.12)'}`,borderRadius:'6px',color:plannerMode?'#a78bfa':'rgba(255,255,255,0.6)',fontSize:'10px',fontWeight:600,cursor:'pointer'}}>
              {plannerMode ? 'Exit Planner' : 'Plan Route'}
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{position:'relative',height:'45vh',flexShrink:0}}>
        <div ref={mapRef} style={{width:'100%',height:'100%'}} />
        {/* Map type toggle */}
        <div style={{position:'absolute',top:'8px',left:'8px',zIndex:1000,display:'flex',background:'rgba(0,0,0,0.65)',borderRadius:'6px',overflow:'hidden',border:'1px solid rgba(255,255,255,0.1)'}}>
          {['satellite','map'].map(t => (
            <button key={t} onClick={() => switchMapType(t)}
              style={{padding:'4px 10px',fontSize:'10px',color:mapType===t?'#fff':'rgba(255,255,255,0.4)',background:mapType===t?'rgba(59,130,246,0.5)':'transparent',border:'none',cursor:'pointer',fontWeight:600,textTransform:'uppercase'}}>
              {t==='satellite'?'SAT':'MAP'}
            </button>
          ))}
        </div>
        {/* GPS accuracy */}
        {currentPos && (
          <div style={{position:'absolute',bottom:'8px',left:'8px',zIndex:1000,background:'rgba(0,0,0,0.55)',borderRadius:'5px',padding:'3px 7px',fontSize:'10px',color:'rgba(255,255,255,0.6)'}}>
            GPS ±{Math.round(currentPos.accuracy)}m
          </div>
        )}
        {/* Planner hint */}
        {plannerMode && (
          <div style={{position:'absolute',top:'8px',right:'8px',zIndex:1000,background:'rgba(167,139,250,0.9)',borderRadius:'6px',padding:'5px 10px',fontSize:'11px',color:'#fff',fontWeight:600}}>
            Tap map to add checkpoint
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>

        {/* Planner panel */}
        {plannerMode && (
          <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'rgba(167,139,250,0.7)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Route Planner — {plannerPoints.length} points</div>
            <input value={plannerName} onChange={e=>setPlannerName(e.target.value)}
              placeholder="Route name (e.g. Main Perimeter)"
              style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',padding:'8px 10px',fontSize:'12px',color:'#fff',marginBottom:'8px',boxSizing:'border-box'}} />
            {plannerPoints.map((p, i) => (
              <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px',alignItems:'center'}}>
                <div style={{width:'22px',height:'22px',borderRadius:'50%',background:'#a78bfa',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#0b1222',flexShrink:0}}>{i+1}</div>
                <input value={cpNames[i]||''} onChange={e=>setCpNames(prev=>({...prev,[i]:e.target.value}))}
                  placeholder={`Checkpoint ${i+1} name`}
                  style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'6px 8px',fontSize:'11px',color:'#fff'}} />
              </div>
            ))}
            {plannerPoints.length >= 2 && (
              <button onClick={saveRoute} style={{width:'100%',padding:'10px',background:'#a78bfa',border:'none',borderRadius:'8px',color:'#0b1222',fontSize:'13px',fontWeight:700,cursor:'pointer',marginTop:'6px'}}>
                Save Route
              </button>
            )}
          </div>
        )}

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

        {/* Checkpoints */}
        {!plannerMode && (
          <div style={{padding:'12px 14px',flex:1}}>
            {checkpoints.length > 0 ? (
              <>
                <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Checkpoints</div>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {checkpoints.map((cp, i) => {
                    const done = completedCps.includes(cp.id);
                    const isCurrent = patrolStarted && !done && cp.id === nextCp?.id;
                    return (
                      <div key={cp.id} onClick={() => isCurrent && markCheckpoint(cp)}
                        style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 11px',
                          background:done?'rgba(74,222,128,0.06)':isCurrent?'rgba(251,191,36,0.08)':'rgba(255,255,255,0.02)',
                          border:`${isCurrent?'1.5':'1'}px solid ${done?'rgba(74,222,128,0.15)':isCurrent?'rgba(251,191,36,0.35)':'rgba(255,255,255,0.06)'}`,
                          borderRadius:'9px',cursor:isCurrent?'pointer':'default',
                          opacity:(!patrolStarted||done||isCurrent)?1:0.45}}>
                        {done ? (
                          <div style={{width:20,height:20,borderRadius:'50%',background:'rgba(74,222,128,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3 5.5L8 1" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                        ) : isCurrent ? (
                          <div style={{width:20,height:20,borderRadius:'50%',background:'#fbbf24',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <div style={{width:6,height:6,borderRadius:'50%',background:'#0b1222'}} />
                          </div>
                        ) : (
                          <div style={{width:20,height:20,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.2)',flexShrink:0}} />
                        )}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',fontWeight:isCurrent?600:400,color:done?'rgba(255,255,255,0.45)':isCurrent?'#fff':'rgba(255,255,255,0.5)'}}>{cp.name}</div>
                          {isCurrent && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginTop:'1px'}}>Tap to mark reached</div>}
                          {cp.instructions && !done && !isCurrent && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cp.instructions}</div>}
                        </div>
                        {done && completedCps[completedCps.indexOf(cp.id)] && (
                          <div style={{fontSize:'10px',color:'rgba(74,222,128,0.5)',flexShrink:0}}>✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : !loading && (
              <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.25)',fontSize:'13px'}}>
                {isRoutePlanner ? 'Tap "Plan Route" to create a patrol route' : 'No patrol route configured for this site'}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!plannerMode && (
          <div style={{padding:'12px 14px',flexShrink:0}}>
            {!patrolStarted ? (
              <div>
                <div style={{textAlign:'center',marginBottom:'12px'}}>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.35)',marginBottom:'4px'}}>Ready to begin patrol?</div>
                </div>
                <button onClick={startPatrol}
                  style={{width:'100%',padding:'16px',background:'linear-gradient(135deg,#1a52a8,#2563eb)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'16px',fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(59,130,246,0.4)',letterSpacing:'0.01em'}}>
                  ▶ Start Patrol
                </button>
              </div>
            ) : (
              <div>
                <button onClick={() => setShowReport(true)}
                  style={{width:'100%',padding:'13px',background:'rgba(239,68,68,0.1)',border:'1.5px solid rgba(239,68,68,0.3)',borderRadius:'10px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer',marginBottom:'8px',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                  <span style={{fontSize:'16px'}}>⚠</span> Log Occurrence / Incident
                </button>
                {nextCp && (
                  <button onClick={() => markCheckpoint(nextCp)}
                    style={{width:'100%',padding:'13px',background:'rgba(251,191,36,0.12)',border:'1.5px solid rgba(251,191,36,0.35)',borderRadius:'10px',color:'#fbbf24',fontSize:'14px',fontWeight:700,cursor:'pointer',marginBottom:'8px'}}>
                    ✓ Mark Checkpoint Reached — {nextCp.name}
                  </button>
                )}
                <button onClick={endPatrol}
                  style={{width:'100%',padding:'11px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',color:'rgba(255,255,255,0.35)',fontSize:'12px',cursor:'pointer'}}>
                  End Patrol
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report issue modal */}
      {showReport && (
        <ReportModal user={user} site={site} session={session} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

function ReportModal({ user, site, session, onClose }) {
  const [type, setType] = useState('INCIDENT');
  const [notes, setNotes] = useState('');
  const [clientReportable, setClientReportable] = useState(false);
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);

  const types = [
    { key:'INCIDENT',      label:'Security Incident', color:'#ef4444' },
    { key:'ALARM',          label:'Alarm Activation',  color:'#f97316' },
    { key:'ACCESS_CONTROL', label:'Access / Entry',    color:'#3b82f6' },
    { key:'GENERAL',        label:'Safety / Hazard',   color:'#fbbf24' },
    { key:'VEHICLE_CHECK',  label:'Suspicious Vehicle',color:'#a78bfa' },
    { key:'MAINTENANCE',    label:'Maintenance',       color:'rgba(255,255,255,0.5)' },
    { key:'OTHER',          label:'Other',             color:'rgba(255,255,255,0.35)' },
  ];

  async function handleMedia(e) {
    const files = Array.from(e.target.files);
    const uploads = await Promise.all(files.map(async file => {
      const form = new FormData();
      form.append('file', file);
      try {
        const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
        const res = await fetch(`${API}/api/patrols/media/upload`, {
          method: 'POST',
          body: form,
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        const data = await res.json();
        return { url: data.url, name: file.name, type: file.type };
      } catch { return null; }
    }));
    setMedia(prev => [...prev, ...uploads.filter(Boolean)]);
  }

  async function getToken() {
    if (window.Clerk?.session) return window.Clerk.session.getToken();
    return '';
  }

  async function submit() {
    if (!notes.trim()) { alert('Please add a description'); return; }
    setSaving(true);
    try {
      await api.logs.create({
        site_id: site?.id,
        log_type: type,
        title: `Patrol Report: ${types.find(t=>t.key===type)?.label}`,
        description: notes,
        client_reportable: clientReportable,
        type_data: { media, patrol_session_id: session?.id },
      });
      onClose();
    } catch (e) { alert('Error submitting: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#0f1929',borderRadius:'16px 16px 0 0',padding:'0 0 20px',width:'100%',maxHeight:'90vh',overflowY:'auto',border:'1px solid rgba(255,255,255,0.08)'}}>
        {/* Handle */}
        <div style={{width:'40px',height:'4px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',margin:'10px auto 0'}} />
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#fff'}}>Log Occurrence</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>{site?.name}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>

        <div style={{padding:'14px 16px'}}>
          {/* Type */}
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Type</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'14px'}}>
            {types.map(t => (
              <button key={t.key} onClick={() => setType(t.key)}
                style={{padding:'6px 12px',background:type===t.key?`rgba(${hexToRgb(t.color)},0.15)`:'rgba(255,255,255,0.04)',
                  border:`${type===t.key?'1.5':'1'}px solid ${type===t.key?t.color:'rgba(255,255,255,0.08)'}`,
                  borderRadius:'8px',fontSize:'12px',color:type===t.key?t.color:'rgba(255,255,255,0.5)',fontWeight:type===t.key?600:400,cursor:'pointer'}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'6px'}}>Description</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
            placeholder="Describe what you found..."
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'9px 11px',fontSize:'13px',color:'#fff',resize:'none',boxSizing:'border-box',marginBottom:'14px'}} />

          {/* Media */}
          <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Photos / Video</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'14px'}}>
            {media.map((m, i) => (
              <div key={i} style={{width:64,height:64,borderRadius:'8px',background:'#1a2535',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
                {m.type?.startsWith('image') ? (
                  <img src={m.url} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                ) : (
                  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>video</div>
                )}
                <button onClick={() => setMedia(p => p.filter((_,j)=>j!==i))}
                  style={{position:'absolute',top:2,right:2,width:16,height:16,background:'rgba(239,68,68,0.8)',borderRadius:'50%',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
            ))}
            <label style={{width:64,height:64,borderRadius:'8px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(59,130,246,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:'2px'}}>
              <div style={{fontSize:'18px',color:'rgba(59,130,246,0.5)',lineHeight:1}}>+</div>
              <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>Photo/Video</div>
              <input type="file" accept="image/*,video/*" multiple style={{display:'none'}} onChange={handleMedia} />
            </label>
          </div>

          {/* Client reportable */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',background:clientReportable?'rgba(59,130,246,0.07)':'rgba(255,255,255,0.03)',border:`1px solid ${clientReportable?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.07)'}`,borderRadius:'10px',marginBottom:'6px',cursor:'pointer'}}
            onClick={() => setClientReportable(p => !p)}>
            <div>
              <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>Report to client</div>
              <div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'1px'}}>
                {clientReportable ? 'Visible in client portal + ops' : 'Ops only'}
              </div>
            </div>
            <div style={{width:'38px',height:'22px',background:clientReportable?'#3b82f6':'rgba(255,255,255,0.1)',borderRadius:'999px',position:'relative',transition:'background 0.2s',flexShrink:0}}>
              <div style={{position:'absolute',top:3,left:clientReportable?'auto':'3px',right:clientReportable?'3px':'auto',width:16,height:16,background:'#fff',borderRadius:'50%',transition:'all 0.2s'}} />
            </div>
          </div>
          {clientReportable && (
            <div style={{fontSize:'11px',color:'rgba(59,130,246,0.7)',padding:'6px 10px',background:'rgba(59,130,246,0.06)',borderRadius:'6px',marginBottom:'14px'}}>
              → This report will appear in the client portal
            </div>
          )}

          <button onClick={submit} disabled={saving}
            style={{width:'100%',padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:saving?0.7:1}}>
            {saving ? 'Submitting...' : 'Submit Report'}
          </button>
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
