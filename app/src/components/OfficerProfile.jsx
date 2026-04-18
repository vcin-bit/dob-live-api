import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { api } from '../lib/api';

export default function OfficerProfile({ user }) {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    phone:      user?.phone      || '',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  async function saveProfile() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.users.updateMe(form);
      setSuccess('Profile updated successfully.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function changePassword() {
    if (pwForm.newPw !== pwForm.confirm) { setError('New passwords do not match.'); return; }
    if (pwForm.newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await clerkUser.updatePassword({ currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setSuccess('Password changed successfully.');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setChangingPw(false);
    } catch (e) { setError(e.message || 'Password change failed.'); }
    finally { setSaving(false); }
  }

  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'11px 12px', fontSize:'14px', color:'#fff', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'5px', display:'block' };

  return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>My Profile</div>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}
      {success && <div style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#4ade80',marginBottom:'12px'}}>{success}</div>}

      {/* Name */}
      <div style={{marginBottom:'10px'}}>
        <label style={lbl}>First Name</label>
        <input value={form.first_name} onChange={e=>setForm(p=>({...p,first_name:e.target.value}))} style={inp} />
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={lbl}>Last Name</label>
        <input value={form.last_name} onChange={e=>setForm(p=>({...p,last_name:e.target.value}))} style={inp} />
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={lbl}>Mobile Number</label>
        <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="+44 7700 000000" style={inp} />
      </div>

      <button onClick={saveProfile} disabled={saving}
        style={{width:'100%',padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',marginBottom:'20px',letterSpacing:'0.02em'}}>
        {saving ? 'SAVING...' : 'SAVE PROFILE'}
      </button>

      {/* Email — display only, managed by Clerk */}
      <div style={{marginBottom:'20px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px'}}>
        <label style={lbl}>Email Address</label>
        <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)'}}>{user?.email}</div>
        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'4px'}}>Contact your manager to change email</div>
      </div>

      {/* Password */}
      <div style={{marginBottom:'20px',padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:changingPw?'12px':'0'}}>
          <label style={{...lbl,marginBottom:0}}>Password</label>
          <button onClick={()=>{setChangingPw(!changingPw);setError('');}}
            style={{fontSize:'12px',fontWeight:600,color:'#60a5fa',background:'none',border:'none',cursor:'pointer'}}>
            {changingPw ? 'Cancel' : 'Change'}
          </button>
        </div>
        {changingPw && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <input type="password" value={pwForm.current} onChange={e=>setPwForm(p=>({...p,current:e.target.value}))} placeholder="Current password" style={inp} />
            <input type="password" value={pwForm.newPw} onChange={e=>setPwForm(p=>({...p,newPw:e.target.value}))} placeholder="New password (min 8 chars)" style={inp} />
            <input type="password" value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} placeholder="Confirm new password" style={inp} />
            <button onClick={changePassword} disabled={saving}
              style={{width:'100%',padding:'12px',background:'rgba(59,130,246,0.2)',border:'1.5px solid rgba(59,130,246,0.4)',borderRadius:'8px',color:'#60a5fa',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
              {saving ? 'CHANGING...' : 'CHANGE PASSWORD'}
            </button>
          </div>
        )}
      </div>

      {/* SIA */}
      {user?.sia_licence_number && (
        <div style={{padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px'}}>
          <label style={lbl}>SIA Licence Number</label>
          <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)',fontFamily:'monospace'}}>{user.sia_licence_number}</div>
        </div>
      )}
    </div>
  );
}
