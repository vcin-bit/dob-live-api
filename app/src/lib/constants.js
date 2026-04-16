// Log Types and Constants for DOB Live Security System

export const LOG_TYPES = {
  // Standard Security Logs
  PATROL: 'PATROL',
  INCIDENT: 'INCIDENT', 
  MAINTENANCE: 'MAINTENANCE',
  ACCESS_CONTROL: 'ACCESS_CONTROL',
  ALARM: 'ALARM',
  VISITOR: 'VISITOR',
  VEHICLE_CHECK: 'VEHICLE_CHECK',
  PROPERTY_CHECK: 'PROPERTY_CHECK',
  
  // Operational Logs
  SHIFT_START: 'SHIFT_START',
  SHIFT_END: 'SHIFT_END',
  BREAK: 'BREAK',
  HANDOVER: 'HANDOVER',
  TRAINING: 'TRAINING',
  
  // Emergency/Critical
  EMERGENCY: 'EMERGENCY',
  FIRE_ALARM: 'FIRE_ALARM',
  EVACUATION: 'EVACUATION',
  
  // Administrative
  ADMIN: 'ADMIN',
  OTHER: 'OTHER'
};

export const LOG_TYPE_CONFIG = {
  [LOG_TYPES.PATROL]: {
    label: 'Patrol',
    color: 'info',
    icon: 'PAT',
    description: 'Routine patrol or walkthrough',
    fields: ['location', 'observations', 'issues_found']
  },
  
  [LOG_TYPES.INCIDENT]: {
    label: 'Incident',
    color: 'warning',
    icon: 'INC',
    description: 'Security incident or unusual occurrence',
    fields: ['incident_type', 'severity', 'people_involved', 'actions_taken']
  },
  
  [LOG_TYPES.MAINTENANCE]: {
    label: 'Maintenance',
    color: 'info',
    icon: 'MNT',
    description: 'Maintenance issue or observation',
    fields: ['equipment', 'issue_description', 'priority', 'contractor_notified']
  },
  
  [LOG_TYPES.ACCESS_CONTROL]: {
    label: 'Access Control',
    color: 'info',
    icon: 'ACC',
    description: 'Door, gate, or access-related log',
    fields: ['access_point', 'person_name', 'time_granted', 'authority']
  },
  
  [LOG_TYPES.ALARM]: {
    label: 'Alarm',
    color: 'warning',
    icon: 'ALM',
    description: 'Alarm activation or security system alert',
    fields: ['alarm_type', 'location', 'cause', 'response_time']
  },
  
  [LOG_TYPES.VISITOR]: {
    label: 'Visitor',
    color: 'info',
    icon: 'VIS',
    description: 'Visitor or guest log',
    fields: ['visitor_name', 'company', 'purpose', 'host', 'badge_issued']
  },
  
  [LOG_TYPES.VEHICLE_CHECK]: {
    label: 'Vehicle Check',
    color: 'info',
    icon: 'VEH',
    description: 'Vehicle inspection or parking log',
    fields: ['vehicle_reg', 'driver_name', 'purpose', 'permit_checked']
  },
  
  [LOG_TYPES.PROPERTY_CHECK]: {
    label: 'Property Check',
    color: 'info',
    icon: 'BLD',
    description: 'Building or property inspection',
    fields: ['area', 'condition', 'issues', 'photos']
  },
  
  [LOG_TYPES.SHIFT_START]: {
    label: 'Shift Start',
    color: 'success',
    icon: 'ON',
    description: 'Beginning of shift duties',
    fields: ['handover_received', 'equipment_checked', 'priorities']
  },
  
  [LOG_TYPES.SHIFT_END]: {
    label: 'Shift End',
    color: 'success',
    icon: 'OFF',
    description: 'End of shift summary',
    fields: ['handover_given', 'outstanding_issues', 'equipment_status']
  },
  
  [LOG_TYPES.BREAK]: {
    label: 'Break',
    color: 'info',
    icon: 'BRK',
    description: 'Break or meal period',
    fields: ['break_type', 'duration', 'coverage']
  },
  
  [LOG_TYPES.HANDOVER]: {
    label: 'Handover',
    color: 'info',
    icon: 'HND',
    description: 'Shift handover or briefing',
    fields: ['from_officer', 'to_officer', 'key_points', 'actions_required']
  },
  
  [LOG_TYPES.TRAINING]: {
    label: 'Training',
    color: 'info',
    icon: 'TRN',
    description: 'Training activity or drill',
    fields: ['training_type', 'duration', 'participants', 'outcome']
  },
  
  [LOG_TYPES.EMERGENCY]: {
    label: 'Emergency',
    color: 'alert',
    icon: 'ALM',
    description: 'Emergency situation',
    fields: ['emergency_type', 'services_called', 'casualties', 'actions_taken']
  },
  
  [LOG_TYPES.FIRE_ALARM]: {
    label: 'Fire Alarm',
    color: 'alert',
    icon: 'FIR',
    description: 'Fire alarm activation',
    fields: ['alarm_location', 'cause', 'evacuation', 'fire_service']
  },
  
 
  [LOG_TYPES.EVACUATION]: {
    label: 'Evacuation',
    color: 'alert',
    icon: 'EVC',
    description: 'Building or area evacuation',
    fields: ['reason', 'areas_affected', 'people_evacuated', 'all_clear_time']
  },
  
  [LOG_TYPES.ADMIN]: {
    label: 'Administrative',
    color: 'info',
    icon: 'ADM',
    description: 'Administrative task or note',
    fields: ['task_description', 'completed_by', 'notes']
  },
  
  [LOG_TYPES.OTHER]: {
    label: 'Other',
    color: 'info',
    icon: 'GEN',
    description: 'General log entry',
    fields: ['description', 'category', 'notes']
  }
};

export const SHIFT_STATUS = {
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const TASK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY: 'COMPANY',
  OPS_MANAGER: 'OPS_MANAGER',
  OFFICER: 'OFFICER'
};

// Get appropriate CSS class for status
export function getStatusClass(type, status) {
  const statusMap = {
    success: 'status-active',
    warning: 'status-pending',
    alert: 'status-alert',
    info: 'status-info'
  };
  
  if (type === 'shift') {
    switch (status) {
      case SHIFT_STATUS.ACTIVE: return statusMap.success;
      case SHIFT_STATUS.SCHEDULED: return statusMap.info;
      case SHIFT_STATUS.COMPLETED: return statusMap.success;
      case SHIFT_STATUS.CANCELLED: return statusMap.alert;
    }
  }
  
  if (type === 'task') {
    switch (status) {
      case TASK_STATUS.COMPLETED: return statusMap.success;
      case TASK_STATUS.IN_PROGRESS: return statusMap.warning;
      case TASK_STATUS.PENDING: return statusMap.info;
      case TASK_STATUS.CANCELLED: return statusMap.alert;
    }
  }
  
  return statusMap.info;
}

// Format timestamp for display
export function formatDateTime(isoString, options = {}) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const { time = true, date: showDate = true } = options;
  
  if (time && showDate) {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  if (time) {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return date.toLocaleDateString('en-GB');
}

// Get relative time (e.g., "2 hours ago")
export function getRelativeTime(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDateTime(isoString, { time: false });
}
