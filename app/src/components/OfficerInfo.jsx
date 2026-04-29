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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.policies.get().then(r => { setSections(r.data?.sections||[]); setLoading(false); });
  }, []);

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:'0.875rem'}}>Company Policies</p>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
      : sections.length===0 ? <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>No policies published yet</div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
          {sections.map((sec,i) => (
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
    { to: '/logs',    icon: ClipboardDocumentListIcon,  label: 'History' },
    { to: '/instructions', icon: ClipboardDocumentListIcon, label: 'Instructions' },
    { to: '/profile', icon: UserGroupIcon,              label: 'Profile' },
  ];

  return (
    <>
      {/* In-app sign out confirmation — works on all devices */}
      {confirmingSignOut && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#0f1929',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',padding:'1.5rem',width:'100%',maxWidth:'360px',textAlign:'center'}}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>Sign Out?</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.45)',marginBottom:'20px',lineHeight:1.5}}>Please ensure your handover is complete before signing out.</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setConfirmingSignOut(false)}
                style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={() => { setConfirmingSignOut(false); onSignOut?.(); }}
                style={{flex:1,padding:'13px',background:'rgba(220,38,38,0.15)',border:'1.5px solid rgba(220,38,38,0.4)',borderRadius:'10px',color:'#ef4444',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                Sign Out
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
          Sign Out
        </button>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'0.25rem 0',fontSize:'9px',color:'rgba(255,255,255,0.25)',minWidth:0,flex:'0 0 auto'}}>{typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : ''}</div>
      </nav>
    </>
  );
}



export { OfficerInstructionsScreen };
export { OfficerPoliciesScreen };
export { OfficerNavigation };
