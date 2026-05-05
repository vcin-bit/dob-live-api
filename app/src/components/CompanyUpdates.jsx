import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

// Officer view — read updates and comment
export function OfficerUpdatesScreen({ user }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.updates.list().then(res => setUpdates(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function loadComments(updateId) {
    if (expandedId === updateId) { setExpandedId(null); return; }
    setExpandedId(updateId);
    if (!comments[updateId]) {
      try {
        const res = await api.updates.comments(updateId);
        setComments(prev => ({ ...prev, [updateId]: res.data || [] }));
      } catch {}
    }
  }

  async function postComment(updateId) {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.updates.comment(updateId, commentText);
      setComments(prev => ({ ...prev, [updateId]: [...(prev[updateId] || []), res.data] }));
      setCommentText('');
    } catch (err) { alert(err.message || 'Failed to post comment'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div style={{padding:'2rem',textAlign:'center',color:'rgba(255,255,255,0.4)'}}>Loading...</div>;

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>Company Updates</h2>
      <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',marginBottom:'1.25rem'}}>
        News and updates from the Managing Director
      </p>

      {updates.length === 0 && (
        <div style={{padding:'2rem',textAlign:'center',background:'rgba(255,255,255,0.03)',borderRadius:'10px',border:'1px dashed rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.3)'}}>No updates yet.</div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
        {updates.map(update => {
          const isExpanded = expandedId === update.id;
          const updateComments = comments[update.id] || [];
          return (
            <div key={update.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',overflow:'hidden'}}>
              {/* Post */}
              <div style={{padding:'1.25rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(26,82,168,0.3)',border:'1px solid rgba(26,82,168,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:700,color:'#60a5fa'}}>
                    {update.author?.first_name?.[0]}{update.author?.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{fontSize:'0.8125rem',fontWeight:600,color:'#fff'}}>{update.author?.first_name} {update.author?.last_name}</div>
                    <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.3)'}}>
                      {new Date(update.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/London'})} at {new Date(update.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:'1rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem'}}>{update.title}</div>
                <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{update.content}</div>
              </div>

              {/* Comment toggle */}
              <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'0.75rem 1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <button onClick={() => loadComments(update.id)}
                  style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',fontWeight:500,cursor:'pointer',padding:0}}>
                  {isExpanded ? 'Hide comments' : `Comments${updateComments.length > 0 ? ` (${updateComments.length})` : ''}`}
                </button>
              </div>

              {/* Comments section */}
              {isExpanded && (
                <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'1rem 1.25rem',background:'rgba(0,0,0,0.15)'}}>
                  {updateComments.length === 0 && (
                    <div style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.25)',marginBottom:'0.75rem'}}>No comments yet. Be the first to respond.</div>
                  )}
                  {updateComments.map(c => (
                    <div key={c.id} style={{marginBottom:'0.75rem',paddingBottom:'0.75rem',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.375rem',marginBottom:'0.25rem'}}>
                        <span style={{fontSize:'0.75rem',fontWeight:600,color:'rgba(255,255,255,0.6)'}}>{c.user?.first_name} {c.user?.last_name}</span>
                        <span style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.25)'}}>{new Date(c.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/London'})} {new Date(c.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</span>
                      </div>
                      <div style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>{c.content}</div>
                    </div>
                  ))}
                  {/* Comment input */}
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
                    <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Write a comment..."
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(update.id); } }}
                      style={{flex:1,padding:'0.625rem 0.75rem',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'#fff',fontSize:'0.8125rem',outline:'none'}} />
                    <button onClick={() => postComment(update.id)} disabled={submitting || !commentText.trim()}
                      style={{padding:'0.625rem 1rem',background:'rgba(26,82,168,0.3)',border:'1px solid rgba(26,82,168,0.4)',borderRadius:'8px',color:'#60a5fa',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',opacity:(!commentText.trim()||submitting)?0.5:1}}>
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Manager view — create updates
export function ManagerUpdatesPanel() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.updates.list().then(res => setUpdates(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function publish() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await api.updates.update(editingId, { title: title.trim(), content: content.trim() });
        setUpdates(prev => prev.map(u => u.id === editingId ? res.data : u));
      } else {
        const res = await api.updates.create({ title: title.trim(), content: content.trim() });
        setUpdates(prev => [res.data, ...prev]);
      }
      setTitle(''); setContent(''); setShowForm(false); setEditingId(null);
    } catch (err) { alert(err.message || 'Failed to publish'); }
    finally { setSubmitting(false); }
  }

  function startEdit(u) {
    setEditingId(u.id); setTitle(u.title); setContent(u.content); setShowForm(true);
  }

  async function deleteUpdate(id) {
    if (!confirm('Delete this update? Comments will also be removed.')) return;
    try { await api.updates.delete(id); setUpdates(prev => prev.filter(u => u.id !== id)); } catch {}
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <h3 style={{fontSize:'1rem',fontWeight:700,color:'#111827',margin:0}}>Company Updates</h3>
        <button onClick={() => { setShowForm(!showForm); if (showForm) { setEditingId(null); setTitle(''); setContent(''); } }}
          style={{padding:'0.5rem 1rem',background:'#1a52a8',border:'none',borderRadius:'8px',color:'#fff',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer'}}>
          {showForm ? 'Cancel' : '+ New Update'}
        </button>
      </div>

      {showForm && (
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'1.25rem',marginBottom:'1rem'}}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Update title..."
            style={{width:'100%',padding:'0.75rem',background:'#f9fafb',border:'1.5px solid #d1d5db',borderRadius:'8px',color:'#111827',fontSize:'0.9375rem',fontWeight:600,marginBottom:'0.75rem',boxSizing:'border-box',outline:'none'}} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your update to all officers..."
            rows={6} style={{width:'100%',padding:'0.75rem',background:'#f9fafb',border:'1.5px solid #d1d5db',borderRadius:'8px',color:'#111827',fontSize:'0.875rem',lineHeight:1.6,resize:'vertical',marginBottom:'0.75rem',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}} />
          <button onClick={publish} disabled={submitting || !title.trim() || !content.trim()}
            style={{padding:'0.75rem 1.5rem',background:'#1a52a8',border:'none',borderRadius:'8px',color:'#fff',fontSize:'0.875rem',fontWeight:700,cursor:'pointer',opacity:(submitting||!title.trim()||!content.trim())?0.5:1}}>
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish to All Officers'}
          </button>
        </div>
      )}

      {loading && <div style={{color:'#9ca3af',fontSize:'0.875rem'}}>Loading...</div>}

      <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
        {updates.map(u => (
          <div key={u.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'0.875rem',background:'#fff',border:'1px solid #e5e7eb',borderRadius:'8px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'#111827'}}>{u.title}</div>
              <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:'0.25rem'}}>
                {new Date(u.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} — {u.author?.first_name} {u.author?.last_name}
              </div>
            </div>
            <div style={{display:'flex',gap:'0.5rem',flexShrink:0}}>
              <button onClick={() => startEdit(u)}
                style={{background:'none',border:'none',color:'#1a52a8',fontSize:'0.75rem',cursor:'pointer',padding:'0.25rem',fontWeight:600}}>
                Edit
              </button>
              <button onClick={() => deleteUpdate(u.id)}
                style={{background:'none',border:'none',color:'#dc2626',fontSize:'0.75rem',cursor:'pointer',padding:'0.25rem'}}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
