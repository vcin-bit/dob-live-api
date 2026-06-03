import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, ApiError } from '../lib/api';
import { LOG_TYPES, LOG_TYPE_CONFIG, formatDateTime, getRelativeTime } from '../lib/constants';
import {
  HomeIcon, ClipboardDocumentListIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, Cog6ToothIcon, PlusIcon, ArrowRightOnRectangleIcon,
  BuildingOfficeIcon, ChartBarIcon, DocumentTextIcon, BellAlertIcon,
  UsersIcon, EyeIcon, FunnelIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

function OfficerInstructionsScreen({ user, site }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!site?.id) { setLoading(false); return; }
    api.instructions.get(site.id).then(r => { setData(r.data); setLoading(false); });
  }, [site?.id]);

  if (!site) return (
    <div style={{padding:'1.25rem',paddingBottom:'5rem'}}>
      <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>Select a site first</div>
    </div>
  );

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <h2 style={{fontWeight:700,marginBottom:'1rem',fontSize:'1.125rem',color:'#fff'}}>{site.name}</h2>
      <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:'0.875rem'}}>Site Instructions</p>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      : !data || data.sections?.length===0 ? <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>No instructions for this site</div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
          {data.sections.map((sec, i) => (
            <div key={i} className="officer-card">
              <div style={{fontWeight:600,marginBottom:'0.375rem',color:'#fff'}}>{sec.title}</div>
              <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',whiteSpace:'pre-line',lineHeight:1.6}}>{sec.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OfficerPoliciesScreen({ user }) {
  const [sections, setSections] = useState([]);
  const [controlledDocs, setControlledDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.policies.get(),
      api.controlledDocs.list({ audience: 'Officer', status: 'Approved' }).catch(() => ({ data: [] })),
    ]).then(([polRes, cdRes]) => {
      setSections(polRes.data?.sections || []);
      setControlledDocs(cdRes.data || []);
      setLoading(false);
    });
  }, []);

  async function viewPolicyDoc(index) {
    try { const res = await api.policies.downloadUrl(index); if (res?.url) window.open(res.url, '_blank'); }
    catch { alert('Could not load document'); }
  }

  async function viewControlledDoc(id) {
    try { const res = await api.controlledDocs.download(id); if (res?.url) window.open(res.url, '_blank'); }
    catch { alert('Could not load document'); }
  }

  async function acknowledge(id) {
    try { await api.controlledDocs.acknowledge(id); setControlledDocs(prev => prev.map(d => d.id === id ? { ...d, _acked: true } : d)); }
    catch (e) { alert(e.message); }
  }

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:'0.875rem'}}>Company Policies & Documents</p>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
          {/* Controlled docs requiring acknowledgement */}
          {controlledDocs.map(d => (
            <div key={d.id} className="officer-card" style={{borderLeft: d._acked ? '3px solid #16a34a' : '3px solid #f59e0b'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'0.625rem',color:'rgba(255,255,255,0.35)',fontWeight:600}}>{d.doc_number} · Rev {d.revision}</div>
                  <div style={{fontWeight:600,color:'#fff',marginTop:'2px'}}>{d.title}</div>
                </div>
                <span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'0.625rem',fontWeight:700,background:'rgba(16,185,129,0.15)',color:'#4ade80'}}>Approved</span>
              </div>
              <div style={{display:'flex',gap:'0.5rem',marginTop:'0.625rem'}}>
                {d.storage_path && <button onClick={() => viewControlledDoc(d.id)} style={{flex:1,padding:'0.5rem',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer'}}>View Document</button>}
                {!d._acked && (
                  <button onClick={() => acknowledge(d.id)} style={{flex:1,padding:'0.5rem',background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'6px',color:'#4ade80',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer'}}>I Have Read This</button>
                )}
                {d._acked && <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#4ade80',fontSize:'0.8125rem',fontWeight:600}}>Acknowledged</div>}
              </div>
            </div>
          ))}

          {/* Policy text sections + uploaded PDFs */}
          {sections.map((sec, i) => (
            <div key={`pol-${i}`} className="officer-card">
              {sec.type === 'document' ? (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600,color:'#fff'}}>{sec.title || sec.file_name}</div>
                    <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{sec.file_name}</div>
                  </div>
                  <button onClick={() => viewPolicyDoc(i)} style={{padding:'0.375rem 0.75rem',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>View</button>
                </div>
              ) : (
                <>
                  <div style={{fontWeight:600,marginBottom:'0.375rem',color:'#fff'}}>{sec.title}</div>
                  <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',whiteSpace:'pre-line',lineHeight:1.6}}>{sec.content}</div>
                </>
              )}
            </div>
          ))}

          {sections.length === 0 && controlledDocs.length === 0 && (
            <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>No policies published yet</div>
          )}
        </div>
      )}
    </div>
  );
}


function OfficerNavigation({ onSignOut }) {
  const location = useLocation();
  const [confirmingSignOut, setConfirmingSignOut] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    async function poll() {
      try {
        const res = await api.tasks.list({ status: 'PENDING' });
        setPendingCount((res.data || []).length);
      } catch {}
    }
    poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
  }, []);

  const nav = [
    { to: '/',        icon: HomeIcon,                   label: 'Home' },
    { to: '/patrol',  icon: MapPinIcon,                 label: 'Patrol' },
    { to: '/logs',    icon: ClipboardDocumentListIcon,  label: 'History' },
    { to: '/policies', icon: DocumentTextIcon,           label: 'Policies' },
    { to: '/my-hours', icon: ClockIcon,                  label: 'My Hours' },
    { to: '/profile', icon: UserGroupIcon,              label: 'Profile' },
  ];

  return (
    <>
      {/* In-app sign out confirmation — works on all devices */}
      {confirmingSignOut && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px',textAlign:'center'}}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>Go Off Duty</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.45)',marginBottom:'20px',lineHeight:1.5}}>Going off duty requires control room approval. Contact your manager or the Risk Secured NCC to request early sign off.</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setConfirmingSignOut(false)}
                style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={() => { setConfirmingSignOut(false); onSignOut?.(); }}
                style={{flex:1,padding:'13px',background:'rgba(59,130,246,0.15)',border:'1.5px solid rgba(59,130,246,0.4)',borderRadius:'10px',color:'#60a5fa',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
                Check Status
              </button>
            </div>
          </div>
        </div>
      )}
      <nav className="officer-nav">
        {nav.map(({ to, icon: Icon, label, badge }) => (
          <Link
            key={to}
            to={to}
            className={`officer-nav-item${location.pathname === to ? ' active' : ''}`}
            style={{position:'relative'}}
          >
            <Icon style={{width:'1.25rem',height:'1.25rem'}} />
            {label}
            {badge > 0 && <span style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:'9px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{badge}</span>}
          </Link>
        ))}
        <button
          onClick={() => setConfirmingSignOut(true)}
          style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.25rem',padding:'0.5rem 0.375rem',background:'none',border:'none',cursor:'pointer',color:'rgba(255,90,90,0.8)',fontSize:'0.625rem',fontWeight:600,minWidth:0,flex:'0 0 auto'}}
        >
          <ArrowRightOnRectangleIcon style={{width:'1.25rem',height:'1.25rem'}} />
          Off Duty
        </button>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'0.25rem 0',fontSize:'9px',color:'rgba(255,255,255,0.25)',minWidth:0,flex:'0 0 auto'}}>{typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : ''}</div>
      </nav>
    </>
  );
}



export { OfficerInstructionsScreen };
export { OfficerPoliciesScreen };
export { OfficerNavigation };
