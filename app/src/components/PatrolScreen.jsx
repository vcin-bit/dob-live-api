import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { MapPinIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// ── PATROL SCREEN ─────────────────────────────────────────────────────────────
function PatrolScreen({ user, site, shift }) {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [patrolState, setPatrolState] = useState('idle'); // idle | active | done
  const [checkpoints, setCheckpoints] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completedAt, setCompletedAt] = useState([]);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const startTime = useRef(null);

  useEffect(() => {
    if (!site?.id) { setLoading(false); return; }
    api.patrols.list({ site_id: site.id })
      .then(r => setRoutes(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [site?.id]);

  function startPatrol(route) {
    setSelectedRoute(route);
    setCheckpoints(route.checkpoints || []);
    setCurrentIdx(0);
    setCompletedAt([]);
    setPatrolState('active');
    startTime.current = new Date();
  }

  async function confirmCheckpoint() {
    if (locating) return;
    const cp = checkpoints[currentIdx];

    // If checkpoint has GPS coords, verify proximity
    if (cp.lat && cp.lng) {
      setLocating(true);
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true })
        );
        const dist = calcDistance(pos.coords.latitude, pos.coords.longitude, cp.lat, cp.lng);
        if (dist > 100) { // 100m tolerance
          setError(`You appear to be ${Math.round(dist)}m from checkpoint "${cp.name}". Move closer and try again, or tap again to override.`);
          setLocating(false);
          return;
        }
      } catch {
        // GPS unavailable — allow confirm without location
      }
      setLocating(false);
    }

    setError(null);
    const now = new Date();
    setCompletedAt(prev => [...prev, now.toISOString()]);

    if (currentIdx + 1 >= checkpoints.length) {
      setPatrolState('done');
    } else {
      setCurrentIdx(i => i + 1);
    }
  }

  function skipCheckpoint() {
    setError(null);
    setCompletedAt(prev => [...prev, null]); // null = skipped
    if (currentIdx + 1 >= checkpoints.length) {
      setPatrolState('done');
    } else {
      setCurrentIdx(i => i + 1);
    }
  }

  async function submitPatrol() {
    setSubmitting(true);
    setError(null);
    try {
      const duration = startTime.current
        ? Math.round((new Date() - startTime.current) / 60000)
        : null;

      const completedCount = completedAt.filter(Boolean).length;
      const summary = `Patrol completed: ${completedCount}/${checkpoints.length} checkpoints confirmed.${duration ? ` Duration: ${duration} min.` : ''}${notes ? ` Notes: ${notes}` : ''}`;

      await api.logs.create({
        site_id: site?.id,
        shift_id: shift?.id || null,
        log_type: 'PATROL',
        title: `Patrol — ${selectedRoute.name}`,
        description: summary,
        occurred_at: startTime.current?.toISOString() || new Date().toISOString(),
        type_data: {
          route_name: selectedRoute.name,
          checkpoints_total: checkpoints.length,
          checkpoints_completed: completedCount,
          duration_minutes: duration,
        },
      });

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!site) return (
    <div style={{padding:'1.25rem',color:'rgba(255,255,255,0.4)',textAlign:'center',paddingTop:'3rem',fontSize:'0.875rem'}}>
      Select a site first
    </div>
  );

  // Route selection
  if (patrolState === 'idle') return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>Start Patrol</h2>
      <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',marginBottom:'1.25rem'}}>{site.name}</p>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}>
          <div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} />
        </div>
      ) : routes.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)'}}>
          <MapPinIcon style={{width:'2.5rem',height:'2.5rem',margin:'0 auto 0.75rem'}} />
          <p style={{fontSize:'0.875rem'}}>No patrol routes configured for this site</p>
          <p style={{fontSize:'0.75rem',marginTop:'0.375rem'}}>Contact your manager to set up routes</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          {routes.map(route => (
            <button
              key={route.id}
              onClick={() => startPatrol(route)}
              style={{background:'#1a2235',border:'1.5px solid rgba(255,255,255,0.08)',borderRadius:'10px',padding:'1rem',textAlign:'left',cursor:'pointer',width:'100%',transition:'border-color 0.15s'}}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              <div style={{fontSize:'1rem',fontWeight:600,color:'#fff',marginBottom:'0.375rem'}}>{route.name}</div>
              {route.instructions && (
                <div style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.375rem'}}>{route.instructions}</div>
              )}
              <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)'}}>
                {(route.checkpoints || []).length} checkpoint{(route.checkpoints || []).length !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Active patrol
  if (patrolState === 'active') {
    const cp = checkpoints[currentIdx];
    const progress = (currentIdx / checkpoints.length) * 100;

    return (
      <div style={{padding:'1rem',paddingBottom:'5rem',display:'flex',flexDirection:'column',minHeight:'calc(100vh - 120px)'}}>
        {/* Header */}
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff'}}>{selectedRoute.name}</h2>
            <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)'}}>{currentIdx + 1} / {checkpoints.length}</span>
          </div>
          {/* Progress bar */}
          <div style={{height:'4px',background:'rgba(255,255,255,0.1)',borderRadius:'2px',overflow:'hidden'}}>
            <div style={{height:'100%',background:'var(--blue)',borderRadius:'2px',width:`${progress}%`,transition:'width 0.3s'}} />
          </div>
        </div>

        {/* Completed checkpoints */}
        {currentIdx > 0 && (
          <div style={{marginBottom:'1rem'}}>
            {checkpoints.slice(0, currentIdx).map((c, i) => (
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.5rem 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{width:'1.25rem',height:'1.25rem',borderRadius:'50%',background:completedAt[i]?'#4ade80':'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {completedAt[i] ? <span style={{fontSize:'0.625rem',color:'#fff'}}>✓</span> : <span style={{fontSize:'0.5rem',color:'rgba(255,255,255,0.4)'}}>–</span>}
                </div>
                <span style={{fontSize:'0.8125rem',color:completedAt[i]?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.3)',textDecoration:!completedAt[i]?'line-through':'none'}}>{c.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Current checkpoint */}
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
          <div style={{background:'#1a2235',border:'2px solid var(--blue)',borderRadius:'12px',padding:'1.5rem',marginBottom:'1rem'}}>
            <div style={{fontSize:'0.6875rem',fontWeight:600,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>
              Current Checkpoint
            </div>
            <div style={{fontSize:'1.25rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem'}}>{cp.name}</div>
            {cp.instructions && (
              <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',lineHeight:1.5}}>{cp.instructions}</div>
            )}
            {cp.lat && cp.lng && (
              <div style={{marginTop:'0.75rem',fontSize:'0.75rem',color:'rgba(255,255,255,0.35)'}}>
                GPS: {cp.lat.toFixed(5)}, {cp.lng.toFixed(5)}
              </div>
            )}
          </div>

          {error && (
            <div style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'8px',padding:'0.75rem',marginBottom:'0.875rem',fontSize:'0.8125rem',color:'#fca5a5'}}>
              {error}
            </div>
          )}

          <button
            onClick={confirmCheckpoint}
            disabled={locating}
            style={{width:'100%',padding:'1rem',background:'var(--blue)',color:'#fff',border:'none',borderRadius:'10px',fontSize:'1rem',fontWeight:700,cursor:'pointer',marginBottom:'0.75rem',opacity:locating?0.7:1}}
          >
            {locating ? 'Verifying location...' : `Confirm — ${cp.name}`}
          </button>
          <button
            onClick={skipCheckpoint}
            style={{width:'100%',padding:'0.75rem',background:'transparent',color:'rgba(255,255,255,0.35)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',fontSize:'0.875rem',fontWeight:500,cursor:'pointer'}}
          >
            Skip checkpoint
          </button>
        </div>
      </div>
    );
  }

  // Done screen
  const completedCount = completedAt.filter(Boolean).length;
  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <div style={{textAlign:'center',marginBottom:'1.5rem',paddingTop:'1rem'}}>
        <div style={{width:'4rem',height:'4rem',borderRadius:'50%',background:'rgba(74,222,128,0.15)',border:'2px solid #4ade80',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
          <span style={{fontSize:'1.5rem',color:'#4ade80'}}>✓</span>
        </div>
        <h2 style={{fontSize:'1.25rem',fontWeight:700,color:'#fff',marginBottom:'0.375rem'}}>Patrol Complete</h2>
        <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.5)'}}>
          {completedCount} of {checkpoints.length} checkpoints confirmed
        </p>
      </div>

      {/* Checkpoint summary */}
      <div className="officer-card" style={{marginBottom:'1rem'}}>
        {checkpoints.map((cp, i) => (
          <div key={cp.id} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.5rem 0',borderBottom:i<checkpoints.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
            <div style={{width:'1.25rem',height:'1.25rem',borderRadius:'50%',background:completedAt[i]?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontSize:'0.625rem',color:completedAt[i]?'#4ade80':'rgba(255,255,255,0.3)'}}>{completedAt[i]?'✓':'–'}</span>
            </div>
            <span style={{fontSize:'0.875rem',color:completedAt[i]?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.3)',textDecoration:!completedAt[i]?'line-through':'none'}}>{cp.name}</span>
            {completedAt[i] && (
              <span style={{marginLeft:'auto',fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)'}}>
                {new Date(completedAt[i]).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{marginBottom:'1rem'}}>
        <label className="officer-label">Additional Notes</label>
        <textarea
          className="officer-input"
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any observations or issues during patrol..."
        />
      </div>

      {error && <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>}

      <button
        onClick={submitPatrol}
        disabled={submitting}
        style={{width:'100%',padding:'1rem',background:'#4ade80',color:'#0b1222',border:'none',borderRadius:'10px',fontSize:'1rem',fontWeight:700,cursor:'pointer',marginBottom:'0.75rem',opacity:submitting?0.7:1}}
      >
        {submitting ? 'Saving...' : 'Save Patrol Log'}
      </button>
      <button
        onClick={() => setPatrolState('idle')}
        style={{width:'100%',padding:'0.75rem',background:'transparent',color:'rgba(255,255,255,0.35)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',fontSize:'0.875rem',cursor:'pointer'}}
      >
        Back to routes
      </button>
    </div>
  );
}

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export { PatrolScreen };
