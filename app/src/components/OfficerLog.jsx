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

function LogEntryScreen({ user, site, shift }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    log_type: '',
    title: '',
    description: '',
    occurred_at: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    latitude: null,
    longitude: null,
    what3words: '',
    type_data: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Unable to get current location');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.log_type) {
        throw new Error('Please select a log type');
      }
      if (!formData.title?.trim()) {
        throw new Error('Please enter a title');
      }
      if (!formData.description?.trim()) {
        throw new Error('Please enter a description');
      }

      // Submit log entry
      const logData = {
        site_id: site.id,
        shift_id: shift?.id || null,
        log_type: formData.log_type,
        title: formData.title.trim(),
        description: formData.description.trim(),
        occurred_at: formData.occurred_at,
        latitude: formData.latitude,
        longitude: formData.longitude,
        what3words: formData.what3words?.trim() || null,
        type_data: formData.type_data
      };

      await api.logs.create(logData);
      
      // Success - redirect to dashboard
      navigate('/', { 
        state: { message: 'Log entry created successfully' }
      });
    } catch (err) {
      console.error('Failed to create log entry:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedLogConfig = LOG_TYPE_CONFIG[formData.log_type];

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <div style={{marginBottom:'1.25rem'}}>
        <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.125rem'}}>New Log Entry</h2>
        <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)'}}>Record a security occurrence</p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{marginBottom:'1rem'}}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Log Type Selection */}
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.625rem'}}>Type</div>
          <LogTypeAccordion formData={formData} setFormData={setFormData} />
        </div>

        {/* Basic Information */}
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.625rem'}}>Details</div>
            <div className="space-y-4">
              <div style={{marginBottom:'0.875rem'}}>
                <label className="officer-label">Title</label>
                <input
                  type="text"
                  className="officer-input"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief summary"
                  required
                />
              </div>

              <div style={{marginBottom:'0.875rem'}}>
                <label className="officer-label">Description</label>
                <textarea
                  className="officer-input"
                  style={{resize:'vertical'}}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of what occurred, actions taken, and any observations"
                  rows="4"
                  required
                />
              </div>

              <div>
                <label className="officer-label">Date & Time</label>
                <input
                  type="datetime-local"
                  className="officer-input"
                  value={formData.occurred_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, occurred_at: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div style={{marginBottom:'1.25rem'}}>
            <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.625rem'}}>Location (Optional)</div>
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={locationLoading}
              style={{padding:'0.75rem 1rem',background:'#1a2235',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',color:formData.latitude?'#4ade80':'rgba(255,255,255,0.6)',fontSize:'0.875rem',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.625rem'}}
            >
              <MapPinIcon style={{width:'1rem',height:'1rem'}} />
              {locationLoading ? 'Getting location...' : formData.latitude ? 'Location captured' : 'Use my location'}
            </button>
            <label className="officer-label">what3words (optional)</label>
            <input
              type="text"
              className="officer-input"
              style={{fontFamily:'monospace'}}
              value={formData.what3words}
              onChange={(e) => setFormData(prev => ({ ...prev, what3words: e.target.value }))}
              placeholder="filled.count.soap"
            />
          </div>

          {/* Type-Specific Fields */}
          {selectedLogConfig && formData.log_type && (
            <TypeSpecificFields
              logType={formData.log_type}
              config={selectedLogConfig}
              data={formData.type_data}
              onChange={(typeData) => setFormData(prev => ({ ...prev, type_data: typeData }))}
            />
          )}

          {/* Submit Buttons */}
          <div style={{display:'flex',gap:'0.75rem',marginTop:'1rem'}}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{flex:1,background:'#1a2235',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',padding:'0.875rem',fontSize:'0.9375rem',fontWeight:600,cursor:'pointer'}}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{flex:2,background:'var(--blue)',color:'#fff',border:'none',borderRadius:'8px',padding:'0.875rem',fontSize:'0.9375rem',fontWeight:700,cursor:'pointer',opacity:(loading||!formData.log_type||!formData.title.trim())?0.5:1}}
              disabled={loading || !formData.log_type || !formData.title.trim()}
            >
              {loading ? 'Saving...' : 'Save Log Entry'}
            </button>
          </div>
        </form>
    </div>
  );
}

// Log Type Option Component
function LogTypeAccordion({ formData, setFormData }) {
  const groups = [
    { key:'patrol',  label:'Patrol & Security', dot:'#ef4444', types:['PATROL','INCIDENT','ALARM','FIRE_ALARM','EVACUATION','EMERGENCY'] },
    { key:'access',  label:'Access & Visitors',  dot:'#3b82f6', types:['ACCESS_CONTROL','VISITOR','VEHICLE_CHECK','PROPERTY_CHECK'] },
    { key:'shift',   label:'Shift & Admin',       dot:'rgba(255,255,255,0.4)', types:['SHIFT_START','SHIFT_END','BREAK','HANDOVER','MAINTENANCE','TRAINING','ADMIN','OTHER'] },
  ];

  // Auto-open the group containing the selected type
  const selectedGroup = groups.find(g => g.types.includes(formData.log_type))?.key || null;
  const [open, setOpen] = React.useState(selectedGroup);

  const cols = {
    info:    { bg:'rgba(59,130,246,0.15)',  border:'rgba(59,130,246,0.5)',  dot:'#3b82f6' },
    warning: { bg:'rgba(251,191,36,0.12)',  border:'rgba(251,191,36,0.5)',  dot:'#fbbf24' },
    alert:   { bg:'rgba(239,68,68,0.15)',   border:'rgba(239,68,68,0.6)',   dot:'#ef4444' },
    success: { bg:'rgba(74,222,128,0.1)',   border:'rgba(74,222,128,0.4)',  dot:'#4ade80' },
    neutral: { bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.12)',dot:'rgba(255,255,255,0.4)' },
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
      {groups.map(group => {
        const isOpen = open === group.key;
        const hasSelected = group.types.includes(formData.log_type);
        const selectedLabel = hasSelected ? LOG_TYPE_CONFIG[formData.log_type]?.label : null;

        return (
          <div key={group.key} style={{borderRadius:'10px',overflow:'hidden',border:`1.5px solid ${hasSelected?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.07)'}`,background:'rgba(255,255,255,0.03)'}}>
            {/* Group header - tap to open/close */}
            <button
              onClick={() => setOpen(isOpen ? null : group.key)}
              style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'13px 14px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
              <div style={{width:'8px',height:'8px',borderRadius:'50%',background:group.dot,flexShrink:0}} />
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:600,color:hasSelected?'#fff':'rgba(255,255,255,0.65)'}}>{group.label}</div>
                {hasSelected && !isOpen && (
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'1px'}}>Selected: {selectedLabel}</div>
                )}
              </div>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{transform:isOpen?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0}}>
                <path d="M1 1L6 7L11 1" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Type list - shown when open */}
            {isOpen && (
              <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'6px 8px 8px'}}>
                {group.types.filter(t => LOG_TYPE_CONFIG[t]).map(type => {
                  const config = LOG_TYPE_CONFIG[type];
                  const sel = formData.log_type === type;
                  const c = cols[config.color] || cols.neutral;
                  return (
                    <button key={type}
                      onClick={() => { setFormData(prev => ({ ...prev, log_type: type, type_data: {} })); setOpen(null); }}
                      style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 10px',width:'100%',
                        background:sel?c.bg:'transparent',
                        border:`1px solid ${sel?c.border:'transparent'}`,
                        borderRadius:'8px',cursor:'pointer',textAlign:'left',marginBottom:'3px'}}>
                      <div style={{width:'8px',height:'8px',borderRadius:'50%',background:c.dot,flexShrink:0}} />
                      <div style={{flex:1,fontSize:'14px',fontWeight:sel?600:400,color:sel?'#fff':'rgba(255,255,255,0.7)'}}>{config.label}</div>
                      {sel && <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><path d="M1 5.5L4.5 9L13 1" stroke={c.dot} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogTypeOption({ type, config, selected, onSelect }) {
  return (
    <button
      className={`log-type-btn${selected ? ' selected' : ''}`}
      onClick={() => onSelect(type)}
      type="button"
    >
      <div className="type-badge">{config.icon}</div>
      <div className="log-type-label">{config.label}</div>
    </button>
  );
}


function TypeSpecificFields({ logType, config, data, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  if (!config.fields || config.fields.length === 0) {
    return null;
  }

  return (
    <div style={{marginBottom:'1.25rem'}}>
      <div style={{fontSize:'0.6875rem',fontWeight:600,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.625rem'}}>{config.label} Details</div>
      <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
        {config.fields.map((field) => (
          <TypeSpecificField
            key={field}
            field={field}
            logType={logType}
            value={data[field] || ''}
            onChange={(value) => updateField(field, value)}
          />
        ))}
      </div>
    </div>
  );
}

// Individual Type-Specific Field Component
function TypeSpecificField({ field, logType, value, onChange }) {
  const getFieldConfig = () => {
    const fieldConfigs = {
      // Location fields
      location: { label: 'Location', type: 'text', placeholder: 'Specific location or area' },
      area: { label: 'Area', type: 'text', placeholder: 'Building area or zone' },
      access_point: { label: 'Access Point', type: 'text', placeholder: 'Door, gate, or entry point' },
      
      // People fields
      people_involved: { label: 'People Involved', type: 'textarea', placeholder: 'Names and details of people involved' },
      person_name: { label: 'Person Name', type: 'text', placeholder: 'Full name' },
      visitor_name: { label: 'Visitor Name', type: 'text', placeholder: 'Full name of visitor' },
      driver_name: { label: 'Driver Name', type: 'text', placeholder: 'Full name of driver' },
      
      // Observations and issues
      observations: { label: 'Observations', type: 'textarea', placeholder: 'What was observed during the patrol' },
      issues_found: { label: 'Issues Found', type: 'textarea', placeholder: 'Any problems or concerns identified' },
      condition: { label: 'Condition', type: 'select', options: ['Good', 'Fair', 'Poor', 'Damaged'] },
      issues: { label: 'Issues', type: 'textarea', placeholder: 'Describe any issues or problems' },
      
      // Incident fields
      incident_type: { label: 'Incident Type', type: 'select', options: ['Theft', 'Vandalism', 'Trespass', 'Disturbance', 'Suspicious Activity', 'Other'] },
      severity: { label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      actions_taken: { label: 'Actions Taken', type: 'textarea', placeholder: 'Describe the response and actions taken' },
      
      // Equipment and maintenance
      equipment: { label: 'Equipment', type: 'text', placeholder: 'Equipment name or ID' },
      issue_description: { label: 'Issue Description', type: 'textarea', placeholder: 'Describe the maintenance issue' },
      priority: { label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High', 'Urgent'] },
      contractor_notified: { label: 'Contractor Notified', type: 'select', options: ['Yes', 'No', 'N/A'] },
      equipment_checked: { label: 'Equipment Checked', type: 'textarea', placeholder: 'List equipment inspected' },
      equipment_status: { label: 'Equipment Status', type: 'select', options: ['Good', 'Needs Attention', 'Faulty', 'Out of Service'] },
      
      // Vehicle fields
      vehicle_reg: { label: 'Vehicle Registration', type: 'text', placeholder: 'Registration number' },
      purpose: { label: 'Purpose', type: 'text', placeholder: 'Reason for visit or access' },
      permit_checked: { label: 'Permit Checked', type: 'select', options: ['Yes', 'No', 'N/A'] },
      
      // Visitor fields
      company: { label: 'Company', type: 'text', placeholder: 'Visitor\'s company' },
      host: { label: 'Host', type: 'text', placeholder: 'Person being visited' },
      badge_issued: { label: 'Badge Issued', type: 'select', options: ['Yes', 'No'] },
      
      // Access control
      time_granted: { label: 'Time Granted', type: 'datetime-local' },
      authority: { label: 'Authority', type: 'text', placeholder: 'Who authorized access' },
      
      // Alarm fields
      alarm_type: { label: 'Alarm Type', type: 'select', options: ['Intruder', 'Fire', 'Medical', 'Technical Fault', 'Other'] },
      cause: { label: 'Cause', type: 'text', placeholder: 'Cause of alarm activation' },
      response_time: { label: 'Response Time', type: 'text', placeholder: 'Time taken to respond (minutes)' },
      alarm_location: { label: 'Alarm Location', type: 'text', placeholder: 'Specific alarm point or zone' },
      
      // Shift fields
      handover_received: { label: 'Handover Received', type: 'textarea', placeholder: 'Key points from previous shift' },
      handover_given: { label: 'Handover Given', type: 'textarea', placeholder: 'Information passed to next shift' },
      priorities: { label: 'Priorities', type: 'textarea', placeholder: 'Key tasks and priorities for the shift' },
      outstanding_issues: { label: 'Outstanding Issues', type: 'textarea', placeholder: 'Issues that need follow-up' },
      from_officer: { label: 'From Officer', type: 'text', placeholder: 'Officer giving handover' },
      to_officer: { label: 'To Officer', type: 'text', placeholder: 'Officer receiving handover' },
      key_points: { label: 'Key Points', type: 'textarea', placeholder: 'Important information to pass on' },
      actions_required: { label: 'Actions Required', type: 'textarea', placeholder: 'Tasks that need to be completed' },
      
      // Break fields
      break_type: { label: 'Break Type', type: 'select', options: ['Meal Break', 'Rest Break', 'Toilet Break'] },
      duration: { label: 'Duration', type: 'text', placeholder: 'Duration in minutes' },
      coverage: { label: 'Coverage', type: 'text', placeholder: 'Who provided coverage during break' },
      
      // Emergency fields
      emergency_type: { label: 'Emergency Type', type: 'select', options: ['Medical', 'Fire', 'Security', 'Evacuation', 'Other'] },
      services_called: { label: 'Services Called', type: 'textarea', placeholder: 'Emergency services contacted (Police, Fire, Ambulance)' },
      casualties: { label: 'Casualties', type: 'textarea', placeholder: 'Any injuries or casualties' },
      
      // Medical fields
      patient_details: { label: 'Patient Details', type: 'textarea', placeholder: 'Patient information (name, age, condition)' },
      injury_description: { label: 'Injury Description', type: 'textarea', placeholder: 'Nature and extent of injury' },
      treatment_given: { label: 'Treatment Given', type: 'textarea', placeholder: 'First aid or treatment provided' },
      ambulance: { label: 'Ambulance Called', type: 'select', options: ['Yes', 'No'] },
      
      // Fire/Evacuation fields
      reason: { label: 'Reason', type: 'text', placeholder: 'Reason for evacuation' },
      areas_affected: { label: 'Areas Affected', type: 'textarea', placeholder: 'Which areas were evacuated' },
      people_evacuated: { label: 'People Evacuated', type: 'text', placeholder: 'Approximate number of people' },
      all_clear_time: { label: 'All Clear Time', type: 'datetime-local' },
      evacuation: { label: 'Evacuation Required', type: 'select', options: ['Yes', 'No', 'Partial'] },
      fire_service: { label: 'Fire Service Called', type: 'select', options: ['Yes', 'No'] },
      
      // Training fields
      training_type: { label: 'Training Type', type: 'text', placeholder: 'Type of training or drill' },
      participants: { label: 'Participants', type: 'textarea', placeholder: 'Who participated in the training' },
      outcome: { label: 'Outcome', type: 'textarea', placeholder: 'Results and observations from training' },
      
      // Admin fields
      task_description: { label: 'Task Description', type: 'textarea', placeholder: 'Describe the administrative task' },
      completed_by: { label: 'Completed By', type: 'text', placeholder: 'Who completed the task' },
      notes: { label: 'Notes', type: 'textarea', placeholder: 'Additional notes or comments' },
      category: { label: 'Category', type: 'text', placeholder: 'Category or classification' },
      
      // Photo field
      photos: { label: 'Photos Required', type: 'select', options: ['Yes', 'No'] }
    };
    
    return fieldConfigs[field] || { label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), type: 'text' };
  };

  const fieldConfig = getFieldConfig();

  switch (fieldConfig.type) {
    case 'select':
      return (
        <div>
          <label className="officer-label">
            {fieldConfig.label}
          </label>
          <select
            className="officer-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select {fieldConfig.label.toLowerCase()}...</option>
            {fieldConfig.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    
    case 'textarea':
      return (
        <div>
          <label className="officer-label">
            {fieldConfig.label}
          </label>
          <textarea
            className="officer-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldConfig.placeholder}
            rows="3"
          />
        </div>
      );
    
    case 'datetime-local':
      return (
        <div>
          <label className="officer-label">
            {fieldConfig.label}
          </label>
          <input
            type="datetime-local"
            className="officer-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    
    default:
      return (
        <div>
          <label className="officer-label">
            {fieldConfig.label}
          </label>
          <input
            type="text"
            className="officer-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldConfig.placeholder}
          />
        </div>
      );
  }
}

// Log History Screen
function LogHistoryScreen({ user, site }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    log_type: '',
    from: '',
    to: '',
    limit: 20,
    offset: 0
  });
  const [hasMore, setHasMore] = useState(true);

  // Fetch logs
  const fetchLogs = async (isLoadMore = false) => {
    try {
      setLoading(true);
      const params = {
        site_id: site?.id,
        ...filters,
        offset: isLoadMore ? logs.length : 0
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key] && params[key] !== 0) delete params[key];
      });

      const response = await api.logs.list(params);
      const newLogs = response.data || [];
      
      if (isLoadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
      
      setHasMore(newLogs.length === filters.limit);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (site) {
      fetchLogs();
    }
  }, [site, filters.log_type, filters.from, filters.to]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, offset: 0 }));
    setLogs([]);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchLogs(true);
    }
  };

  if (!site) {
    return <Navigate to="/sites" replace />;
  }

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <div style={{marginBottom:'1rem'}}>
        <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.125rem'}}>Log History</h2>
        <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)'}}>{site.name}</p>
      </div>

      {/* Filters */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'1rem'}}>
        <select className="officer-input" value={filters.log_type} onChange={e => handleFilterChange('log_type', e.target.value)} style={{gridColumn:'1/-1'}}>
          <option value="">All Types</option>
          {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => (
            <option key={type} value={type}>{config.label}</option>
          ))}
        </select>
        <input type="date" className="officer-input" value={filters.from} onChange={e => handleFilterChange('from', e.target.value)} />
        <input type="date" className="officer-input" value={filters.to} onChange={e => handleFilterChange('to', e.target.value)} />
      </div>

      {error && <div className="alert alert-danger" style={{marginBottom:'0.75rem'}}>{error}</div>}

      <div>
        {loading && logs.length === 0 ? (
          <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.15)'}} /></div>
        ) : logs.length === 0 ? (
          <div style={{textAlign:'center',padding:'3rem',color:'rgba(255,255,255,0.3)'}}>
            <ClipboardDocumentListIcon style={{width:'2.5rem',height:'2.5rem',margin:'0 auto 0.75rem'}} />
            <p style={{fontSize:'0.875rem'}}>{filters.log_type || filters.from || filters.to ? 'No logs match filters' : 'No logs yet'}</p>
          </div>
        ) : (
          <>
            {logs.map(log => <LogHistoryCard key={log.id} log={log} />)}
            {hasMore && (
              <button onClick={loadMore} disabled={loading} style={{width:'100%',padding:'0.875rem',background:'#1a2235',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'rgba(255,255,255,0.6)',fontSize:'0.875rem',fontWeight:500,cursor:'pointer',marginTop:'0.5rem'}}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LogHistoryCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.OTHER;
  const typeMap = {
    PATROL:'PAT',INCIDENT:'INC',ALARM:'ALM',ACCESS:'ACC',VISITOR:'VIS',
    HANDOVER:'HND',MAINTENANCE:'MNT',VEHICLE:'VEH',KEYHOLDING:'KEY',GENERAL:'GEN',
    SHIFT_START:'ON',SHIFT_END:'OFF',BREAK:'BRK',TRAINING:'TRN',
    EMERGENCY:'SOS',FIRE_ALARM:'FIR',EVACUATION:'EVC',ADMIN:'ADM',OTHER:'OTH',
  };
  const code = typeMap[log.log_type] || log.log_type?.slice(0,3) || 'LOG';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="officer-log-item"
      style={{cursor:'pointer',flexDirection:'column',gap:0}}
    >
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem',width:'100%'}}>
        <div className="officer-log-type">{code}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="officer-log-title">{log.title || config.label}</div>
          <div className="officer-log-meta">
            {new Date(log.occurred_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
        <div style={{color:'rgba(255,255,255,0.3)',fontSize:'0.75rem',flexShrink:0,marginTop:'2px'}}>{expanded ? '▲' : '▼'}</div>
      </div>
      {expanded && (
        <div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid rgba(255,255,255,0.08)',width:'100%'}}>
          {log.description && <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.7)',marginBottom:'0.5rem',lineHeight:1.5}}>{log.description}</p>}
          {log.type_data && Object.keys(log.type_data).length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:'0.25rem'}}>
              {Object.entries(log.type_data).map(([key, value]) => value ? (
                <div key={key} style={{display:'flex',gap:'0.5rem',fontSize:'0.8125rem'}}>
                  <span style={{color:'rgba(255,255,255,0.35)',textTransform:'capitalize',minWidth:'6rem'}}>{key.replace(/_/g,' ')}:</span>
                  <span style={{color:'rgba(255,255,255,0.7)'}}>{String(value)}</span>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { LogEntryScreen };
export { LogHistoryScreen };
