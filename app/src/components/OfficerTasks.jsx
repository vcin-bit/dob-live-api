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

function TasksScreen({ user, site, shift }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, in_progress, completed

  // Fetch tasks
  async function fetchTasks() {
    try {
      setLoading(true);
      const params = { site_id: site?.id };
      if (filter !== 'all') params.status = filter.toUpperCase();
      const response = await api.tasks.list(params);
      const urgencyOrder = { now: 0, today: 1, normal: 2 };
      const sorted = (response.data || []).sort((a, b) => (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2));
      setTasks(sorted);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (site) fetchTasks(); }, [site, filter]);

  const updateTaskStatus = async (taskId, newStatus, comment) => {
    try {
      await api.tasks.update(taskId, { status: newStatus });
      if (comment?.trim()) {
        try { await api.tasks.create; /* comment via task_comments endpoint */
          await fetch(`${import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com'}/api/tasks/${taskId}/comments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await window.__clerkGetToken?.() || ''}` },
            body: JSON.stringify({ body: `[${newStatus}] ${comment.trim()}` }),
          });
        } catch {}
      }
      fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task status');
    }
  };

  if (!site) {
    return <Navigate to="/sites" replace />;
  }

  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'PENDING'),
    in_progress: tasks.filter(t => t.status === 'IN_PROGRESS'),
    completed: tasks.filter(t => t.status === 'COMPLETED')
  };

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <div style={{marginBottom:'1rem'}}>
        <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.125rem'}}>Assignments</h2>
        <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)'}}>Your assigned tasks</p>
      </div>

      {/* Status tabs */}
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem',borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:'0'}}>
        {[
          { key: 'pending',     label: 'Pending',     count: tasksByStatus.pending.length },
          { key: 'in_progress', label: 'In Progress', count: tasksByStatus.in_progress.length },
          { key: 'completed',   label: 'Done',        count: tasksByStatus.completed.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{padding:'0.5rem 0.75rem',background:'none',border:'none',borderBottom:`2px solid ${filter===key?'var(--blue)':'transparent'}`,color:filter===key?'#fff':'rgba(255,255,255,0.4)',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',marginBottom:'-1px'}}
          >
            {label} {count > 0 && <span style={{background:filter===key?'var(--blue)':'rgba(255,255,255,0.15)',color:filter===key?'#fff':'rgba(255,255,255,0.6)',borderRadius:'999px',padding:'1px 6px',fontSize:'0.6875rem',marginLeft:'4px'}}>{count}</span>}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}>
          <div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} />
        </div>
      ) : (filter === 'all' ? tasks : tasksByStatus[filter] || []).length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)'}}>
          <ClipboardDocumentListIcon style={{width:'2.5rem',height:'2.5rem',margin:'0 auto 0.75rem'}} />
          <p style={{fontSize:'0.875rem'}}>No {filter.replace('_',' ')} tasks</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
          {(filter === 'all' ? tasks : tasksByStatus[filter] || []).map(task => <TaskCard key={task.id} task={task} onUpdateStatus={updateTaskStatus} />)}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const urgencyColor = { now:'#ef4444', today:'#f59e0b', normal:'rgba(255,255,255,0.15)' };
  const statusColor = { PENDING:'rgba(255,255,255,0.5)', IN_PROGRESS:'#60a5fa', COMPLETED:'#4ade80', RETURNED:'#f59e0b' };

  return (
    <div style={{background:'#1a2235',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px',overflow:'hidden'}}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{padding:'0.875rem',cursor:'pointer',display:'flex',alignItems:'flex-start',gap:'0.75rem'}}
      >
        <div style={{width:'3px',alignSelf:'stretch',borderRadius:'2px',background:urgencyColor[task.urgency]||urgencyColor.normal,flexShrink:0,marginTop:'2px'}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'0.25rem'}}>
            {task.urgency === 'now' && <span style={{padding:'1px 6px',borderRadius:'4px',background:'rgba(239,68,68,0.15)',color:'#ef4444',fontSize:'0.625rem',fontWeight:700}}>NOW</span>}
            {task.urgency === 'today' && <span style={{padding:'1px 6px',borderRadius:'4px',background:'rgba(245,158,11,0.15)',color:'#f59e0b',fontSize:'0.625rem',fontWeight:700}}>TODAY</span>}
            <span style={{fontSize:'0.9375rem',fontWeight:600,color:'#fff'}}>{task.title}</span>
          </div>
          <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:'0.75rem',color:statusColor[task.status]||statusColor.PENDING,fontWeight:500}}>
              {task.status === 'RETURNED' ? 'RETURNED TO OPS' : task.status?.replace('_',' ') || 'Pending'}
            </span>
            {task.due_date && (
              <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)'}}>
                Due {new Date(task.due_date).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}
              </span>
            )}
            {task.site && <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)'}}>{task.site.name}</span>}
          </div>
        </div>
        <span style={{color:'rgba(255,255,255,0.25)',fontSize:'0.75rem',flexShrink:0}}>{expanded?'▲':'▼'}</span>
      </div>

      {expanded && (
        <div style={{padding:'0 0.875rem 0.875rem',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          {task.description && (
            <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',marginBottom:'0.875rem',marginTop:'0.75rem',lineHeight:1.5}}>
              {task.description}
            </p>
          )}
          {task.status === 'COMPLETED' && (
            <div style={{fontSize:'0.8125rem',color:'#4ade80',fontWeight:500}}>✓ Completed</div>
          )}
          {task.status === 'RETURNED' && (
            <div style={{fontSize:'0.8125rem',color:'#f59e0b',fontWeight:500}}>↩ Returned to ops</div>
          )}
          {task.status !== 'COMPLETED' && task.status !== 'RETURNED' && (
            <>
              {task.status !== 'IN_PROGRESS' && (
                <button onClick={() => onUpdateStatus(task.id, 'IN_PROGRESS')}
                  style={{width:'100%',padding:'0.625rem',background:'rgba(26,82,168,0.3)',border:'1px solid rgba(26,82,168,0.5)',borderRadius:'6px',color:'#60a5fa',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
                  Start
                </button>
              )}
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder="Add notes, feedback or reason..."
                style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'8px 10px',fontSize:'0.8125rem',color:'#fff',resize:'none',boxSizing:'border-box',marginBottom:'0.5rem',fontFamily:'inherit'}} />
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button onClick={() => onUpdateStatus(task.id, 'COMPLETED', comment)}
                  style={{flex:1,padding:'0.625rem',background:'rgba(74,222,128,0.15)',border:'1px solid rgba(74,222,128,0.3)',borderRadius:'6px',color:'#4ade80',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer'}}>
                  ✓ Completed
                </button>
                <button onClick={() => onUpdateStatus(task.id, 'RETURNED', comment)}
                  style={{flex:1,padding:'0.625rem',background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'6px',color:'#f59e0b',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer'}}>
                  ↩ Send Back
                </button>
                <button onClick={() => setExpanded(false)}
                  style={{padding:'0.625rem 0.75rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',color:'rgba(255,255,255,0.4)',fontSize:'0.8125rem',cursor:'pointer'}}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { TasksScreen };
