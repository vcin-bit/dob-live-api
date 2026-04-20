import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { api } from '../lib/api';

const SIA_TYPES = ['Security Guarding','Door Supervisor','CCTV Operator','Close Protection','Vehicle Immobiliser','Key Holding'];

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
    sia_licence_type:    user?.sia_licence_type || '',
    sia_licence_type_2:  user?.sia_licence_type_2 || '',
    sia_licence_number_2: user?.sia_licence_number_2 || '',
    sia_expiry_date_2:   user?.sia_expiry_date_2 ? user.sia_expiry_date_2.split('T')[0] : '',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  async function saveProfile() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...form };
      if (!payload.sia_expiry_date_2) payload.sia_expiry_date_2 = null;
      if (!payload.sia_licence_number_2) payload.sia_licence_number_2 = null;
      if (!payload.sia_licence_type_2) payload.sia_licence_type_2 = null;
      await api.users.updateMe(payload);
      setSuccess('✓ Profile saved');
      setTimeout(() => setSuccess(''), 3000);
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

  const f = (k, v) => setForm(p => ({...p, [k]: v}));
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'11px 12px', fontSize:'14px', color:'#fff', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'5px', display:'block' };
  const sectionStyle = { marginBottom:'16px', padding:'12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px' };

  return (
    <div style={{padding:'1rem 1rem 5rem'}}>
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>My Profile</div>
      </div>

      {error && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#ef4444',marginBottom:'12px'}}>{error}</div>}
      {success && <div style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'8px',padding:'10px',fontSize:'13px',color:'#4ade80',marginBottom:'12px'}}>{success}</div>}

      {/* Name & Phone */}
      <div style={{marginBottom:'10px'}}>
        <label style={lbl}>First Name</label>
        <input value={form.first_name} onChange={e=>f('first_name',e.target.value)} style={inp} />
      </div>
      <div style={{marginBottom:'10px'}}>
        <label style={lbl}>Last Name</label>
        <input value={form.last_name} onChange={e=>f('last_name',e.target.value)} style={inp} />
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={lbl}>Mobile Number</label>
        <input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+44 7700 000000" style={inp} />
      </div>

      {/* SIA Primary Licence */}
      <div style={sectionStyle}>
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>SIA Licence</div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Licence Type</label>
          <select value={form.sia_licence_type} onChange={e=>f('sia_licence_type',e.target.value)} style={inp}>
            <option value="">Select type...</option>
            {SIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Licence Number</label>
          <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)',fontFamily:'monospace',padding:'11px 12px',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.06)'}}>
            {user?.sia_licence_number || 'Not set — contact your manager'}
          </div>
        </div>
        <div>
          <label style={lbl}>Expiry Date</label>
          <div style={{fontSize:'13px',color: user?.sia_expiry_date && new Date(user.sia_expiry_date) < new Date() ? '#ef4444' : 'rgba(255,255,255,0.5)',padding:'11px 12px',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.06)'}}>
            {user?.sia_expiry_date ? new Date(user.sia_expiry_date).toLocaleDateString('en-GB',{timeZone:'Europe/London'}) : 'Not set'}
            {user?.sia_expiry_date && new Date(user.sia_expiry_date) < new Date() && ' (EXPIRED)'}
          </div>
        </div>
      </div>

      {/* SIA Second Licence */}
      <div style={sectionStyle}>
        <div style={{fontSize:'10px',fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Second SIA Licence (if held)</div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Licence Type</label>
          <select value={form.sia_licence_type_2} onChange={e=>f('sia_licence_type_2',e.target.value)} style={inp}>
            <option value="">None</option>
            {SIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{marginBottom:'8px'}}>
          <label style={lbl}>Licence Number</label>
          <input value={form.sia_licence_number_2} onChange={e=>f('sia_licence_number_2',e.target.value)} placeholder="16-digit number" style={inp} />
        </div>
        <div>
          <label style={lbl}>Expiry Date</label>
          <input type="date" value={form.sia_expiry_date_2} onChange={e=>f('sia_expiry_date_2',e.target.value)} style={inp} />
        </div>
      </div>

      <button onClick={saveProfile} disabled={saving}
        style={{width:'100%',padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',marginBottom:'20px',letterSpacing:'0.02em'}}>
        {saving ? 'SAVING...' : 'SAVE PROFILE'}
      </button>

      {/* Email */}
      <div style={sectionStyle}>
        <label style={lbl}>Email Address</label>
        <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)'}}>{user?.email}</div>
        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'4px'}}>Contact your manager to change email</div>
      </div>

      {/* Password */}
      <div style={sectionStyle}>
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
    </div>
  );
}
