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
  const nav = [
    { to: '/',        icon: HomeIcon,                   label: 'Home' },
    { to: '/logs',    icon: ClipboardDocumentListIcon,  label: 'History' },
    { to: '/tasks',   icon: ClipboardDocumentListIcon,  label: 'Tasks' },
    { to: '/patrol',  icon: MapPinIcon,                 label: 'Patrol' },
    { to: '/profile', icon: UserGroupIcon,              label: 'Profile' },
  ];
  return (
    <nav className="officer-nav">
      {nav.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          className={`officer-nav-item${location.pathname === to ? ' active' : ''}`}
        >
          <Icon style={{width:'1.25rem',height:'1.25rem'}} />
          {label}
        </Link>
      ))}
      <button
        onClick={() => { if (window.confirm('Sign out of DOB Live?\n\nPlease ensure your handover is complete before signing out.')) onSignOut?.(); }}
        style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.25rem',padding:'0.5rem 0.375rem',background:'none',border:'none',cursor:'pointer',color:'rgba(255,90,90,0.8)',fontSize:'0.625rem',fontWeight:600,minWidth:0,flex:'0 0 auto'}}
      >
        <ArrowRightOnRectangleIcon style={{width:'1.25rem',height:'1.25rem'}} />
        Sign Out
      </button>
    </nav>
  );
}



export { OfficerInstructionsScreen };
export { OfficerPoliciesScreen };
export { OfficerNavigation };
