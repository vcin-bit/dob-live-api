import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

// Fires scheduled task popups and patrol countdown
// Rendered once at the top of OfficerShell, invisible until needed
export default function PlaybookAlerts({ user, site, shift, lastPatrolTime, onTaskDismissed }) {
  const [playbook, setPlaybook] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null); // current popup
  const [patrolWarning, setPatrolWarning] = useState(null); // 15/10/5/NOW
  const [patrolMinutes, setPatrolMinutes] = useState(null);
  const firedTasksRef = useRef(new Set());
  const patrolTimerRef = useRef(null);

  useEffect(() => {
    if (!site?.id || !shift) return;
    api.playbooks.get(site.id).then(res => {
      setPlaybook(res.playbook);
      setTasks(res.tasks || []);
    }).catch(() => {});
  }, [site?.id, shift?.id]);

  // Task scheduler — check every minute
  useEffect(() => {
    if (!tasks.length || !shift) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const today = now.getDay();
      for (const task of tasks) {
        if (!task.scheduled_time) continue;
        const taskTime = task.scheduled_time.slice(0,5);
        const dayOk = !task.days_of_week || task.days_of_week.includes(today);
        const key = `${task.id}-${hhmm}`;
        if (taskTime === hhmm && dayOk && !firedTasksRef.current.has(key)) {
          firedTasksRef.current.add(key);
          setActiveAlert(task);
          break;
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [tasks, shift]);

  // Patrol countdown
  useEffect(() => {
    if (!playbook?.patrol_frequency_hours || !shift) return;
    if (patrolTimerRef.current) clearInterval(patrolTimerRef.current);

    const checkPatrol = () => {
      const freq = playbook.patrol_frequency_hours * 60; // in minutes
      const last = lastPatrolTime ? new Date(lastPatrolTime) : new Date(shift.checked_in_at || shift.start_time);
      const elapsed = (Date.now() - last.getTime()) / 60000;
      const remaining = Math.max(0, freq - elapsed);
      setPatrolMinutes(Math.round(remaining));

      if (remaining <= 0) setPatrolWarning('NOW');
      else if (remaining <= 5) setPatrolWarning('5');
      else if (remaining <= 10) setPatrolWarning('10');
      else if (remaining <= 15) setPatrolWarning('15');
      else setPatrolWarning(null);
    };

    checkPatrol();
    patrolTimerRef.current = setInterval(checkPatrol, 60000);
    return () => clearInterval(patrolTimerRef.current);
  }, [playbook, shift, lastPatrolTime]);

  async function dismissTask(task) {
    // Auto-create a log entry for the completed task
    const validLogTypes = ['INCIDENT','PATROL','HEALTH_SAFETY','MEDICAL','VEHICLE_CHECK','CCTV_PATROL','GENERAL','WELFARE_CHECK','CCTV_CHECK','MANAGEMENT_VISIT','VISITOR','ACCESS_CONTROL','MAINTENANCE','HANDOVER','ALARM','FIRE_ALARM','EMERGENCY'];
    const logType = validLogTypes.includes(task.task_type) ? task.task_type : 'GENERAL';
    try {
      await api.logs.create({
        site_id: site.id,
        shift_id: shift.id,
        log_type: logType,
        title: `✓ ${task.name}`,
        description: task.description || `Scheduled task completed: ${task.name}`,
        occurred_at: new Date().toISOString(),
        type_data: { scheduled_task_id: task.id, task_type: task.task_type },
      });
    } catch (err) { console.error('Task log failed:', err); }
    setActiveAlert(null);
    onTaskDismissed?.();
  }

  if (!shift) return null;

  return (
    <>
      {/* Patrol countdown banner — subtle, top of screen */}
      {patrolMinutes !== null && playbook?.patrol_frequency_hours && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:999,
          background: patrolWarning === 'NOW' ? '#dc2626' : patrolWarning ? '#d97706' : 'transparent',
          height: patrolWarning ? 'auto' : 0,
          overflow:'hidden', transition:'all 0.3s',
          padding: patrolWarning ? '8px 16px' : 0,
        }}>
          {patrolWarning && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#fff'}}>
                {patrolWarning === 'NOW' ? '🚨 PATROL OVERDUE — START NOW' : `⏰ Patrol due in ${patrolMinutes} min${patrolMinutes!==1?'s':''}`}
              </div>
              <div style={{fontSize:'11px',color:'rgba(255,255,255,0.7)'}}>{playbook.patrol_type}</div>
            </div>
          )}
        </div>
      )}

      {/* Task alert popup */}
      {activeAlert && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'1rem',
        }}>
          <div style={{background:'#0f1929',border:'2px solid rgba(251,191,36,0.4)',borderRadius:'16px',padding:'1.5rem',maxWidth:'340px',width:'100%',textAlign:'center'}}>
            <div style={{fontSize:'36px',marginBottom:'12px'}}>
              {activeAlert.task_type === 'WELFARE_CALL' ? '📞' : activeAlert.task_type === 'CCTV_CHECK' ? '📹' : activeAlert.task_type === 'BUILDING_CHECK' ? '🏢' : '✓'}
            </div>
            <div style={{fontSize:'11px',fontWeight:700,color:'rgba(251,191,36,0.8)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'8px'}}>
              {activeAlert.task_type === 'WELFARE_CALL' ? 'Lone Worker Safety Check' : 'Scheduled Task Due'}
            </div>
            <div style={{fontSize:'18px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>{activeAlert.name}</div>
            {activeAlert.description && (
              <div style={{fontSize:'14px',color:'rgba(255,255,255,0.6)',marginBottom:'12px',lineHeight:1.5}}>{activeAlert.description}</div>
            )}
            {activeAlert.contact_name && (
              <div style={{padding:'10px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'8px',marginBottom:'12px'}}>
                <div style={{fontSize:'13px',fontWeight:600,color:'#fbbf24'}}>{activeAlert.contact_name}</div>
                {activeAlert.contact_phone && <div style={{fontSize:'14px',color:'#fff',fontFamily:'monospace',marginTop:'4px'}}>{activeAlert.contact_phone}</div>}
              </div>
            )}
            <button
              onClick={() => dismissTask(activeAlert)}
              style={{width:'100%',padding:'14px',background:'#1a52a8',border:'none',borderRadius:'10px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer',marginBottom:'8px'}}>
              ✓ TASK COMPLETE
            </button>
            <button
              onClick={() => setActiveAlert(null)}
              style={{width:'100%',padding:'10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'rgba(255,255,255,0.4)',fontSize:'13px',cursor:'pointer'}}>
              Snooze 10 mins
            </button>
          </div>
        </div>
      )}
    </>
  );
}
