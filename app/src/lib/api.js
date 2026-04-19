// API Helper — Handles all requests to DOB Live API
const API_BASE = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';

class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Helper to make authenticated requests
async function request(endpoint, options = {}) {
  try {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add Clerk session token
    if (typeof window !== 'undefined' && window.__clerkGetToken) {
      const token = await window.__clerkGetToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } else if (typeof window !== 'undefined') {
      try {
        const token = await window.Clerk?.session?.getToken?.();
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch {}
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      // Expired or invalid session — reload once so Clerk shows sign-in
      if (response.status === 401 && typeof window !== 'undefined' && !window.__dob_reloading) {
        window.__dob_reloading = true;
        window.location.reload();
        return;
      }
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new ApiError(
        error.error || `HTTP ${response.status}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message, 0, err);
  }
}

// API Methods
export const api = {
  // Health check
  health: () => request('/health'),

  // Users
  users: {
    me: () => request('/api/users/me?_=' + Date.now()),
    updateMe: (data) => request('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    list:   (params = {}) => request(`/api/users?${new URLSearchParams(params)}`),
    delete: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
    get: (id) => request(`/api/users/${id}`),
    create: (data) => request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },

  // Companies
  companies: {
    get: (id) => request(`/api/companies/${id}`),
    update: (id, data) => request(`/api/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    uploadLogo: async (file) => {
      const fd = new FormData();
      fd.append('logo', file);
      const token = await window.__clerkGetToken?.() || '';
      const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
      const res = await fetch(`${API}/api/companies/logo`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
  },

  // Sites
  sites: {
    list: (params = {}) => request(`/api/sites?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/sites/${id}`),
    create: (data) => request('/api/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/api/sites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/api/sites/${id}`, { method: 'DELETE' }),
    codes: {
      list: (siteId) => request(`/api/sites/${siteId}/codes`),
      create: (siteId, data) => request(`/api/sites/${siteId}/codes`, { method: 'POST', body: JSON.stringify(data) }),
      update: (siteId, codeId, data) => request(`/api/sites/${siteId}/codes/${codeId}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (siteId, codeId) => request(`/api/sites/${siteId}/codes/${codeId}`, { method: 'DELETE' }),
    },
  },

  // Officer-site assignments
  officerSites: {
    list: (officerId) => request(`/api/users/${officerId}/sites`),
    update: (officerId, siteIds) => request(`/api/users/${officerId}/sites`, {
      method: 'PUT',
      body: JSON.stringify({ site_ids: siteIds }),
    }),
  },

  // Shifts
  shifts: {
    list: (params = {}) => request(`/api/shifts?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/shifts/${id}`),
    start: (data) => request('/api/shifts/start', { method: 'POST', body: JSON.stringify(data) }),
    checkin: (id, data) => request(`/api/shifts/${id}/checkin`, { method: 'POST', body: JSON.stringify(data) }),
    checkout: (id) => request(`/api/shifts/${id}/checkout`, { method: 'POST', body: JSON.stringify({}) }),
    create: (data) => request('/api/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/api/shifts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/api/shifts/${id}`, { method: 'DELETE' }),
  },

  // Logs
  logs: {
    list: (params = {}) => request(`/api/logs?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/logs/${id}`),
    create: (data) => request('/api/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/api/logs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },

  // Tasks
  tasks: {
    list: (params = {}) => request(`/api/tasks?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/tasks/${id}`),
    create: (data) => request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },

  // Messages
  messages: {
    list: (params = {}) => request(`/api/messages?${new URLSearchParams(params)}`),
    create: (data) => request('/api/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Handovers
  handovers: {
    list: (params = {}) => request(`/api/handovers?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/handovers/${id}`),
    create: (data) => request('/api/handovers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/api/handovers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },

  instructions: {
    get: (siteId) => request(`/api/instructions?site_id=${siteId}`),
    update: (siteId, sections) => request(`/api/instructions?site_id=${siteId}`, { method: 'PUT', body: JSON.stringify({ sections }) }),
  },
  policies: {
    get: () => request('/api/policies'),
    update: (sections) => request('/api/policies', { method: 'PUT', body: JSON.stringify({ sections }) }),
  },
  folders: {
    list: (params = {}) => request(`/api/folders?${new URLSearchParams(params)}`),
    create: (data) => request('/api/folders', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/folders/${id}`, { method: 'DELETE' }),
    documents: {
      list: (params = {}) => request(`/api/folders/documents?${new URLSearchParams(params)}`),
      create: (data) => request('/api/folders/documents', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id) => request(`/api/folders/documents/${id}`, { method: 'DELETE' }),
    },
  },
  patrols: {
    getRoutes:     (siteId) => request(`/api/patrols/routes?site_id=${siteId}`),
    createRoute:   (siteId, name, instructions, checkpoints) => request('/api/patrols/routes', { method:'POST', body: JSON.stringify({ site_id: siteId, name, instructions, checkpoints }) }),
    updateRoute:   (id, name, instructions, checkpoints) => request(`/api/patrols/routes/${id}`, { method:'PUT', body: JSON.stringify({ name, instructions, checkpoints }) }),
    deleteRoute:   (id) => request(`/api/patrols/routes/${id}`, { method:'DELETE' }),
    startSession:  (siteId, routeId) => request('/api/patrols/sessions/start', { method:'POST', body: JSON.stringify({ site_id: siteId, route_id: routeId }) }),
    gps:           (sessionId, lat, lng) => request(`/api/patrols/sessions/${sessionId}/gps`, { method:'PATCH', body: JSON.stringify({ lat, lng }) }),
    checkpoint:    (sessionId, checkpointId, name, lat, lng) => request(`/api/patrols/sessions/${sessionId}/checkpoint`, { method:'PATCH', body: JSON.stringify({ checkpoint_id: checkpointId, checkpoint_name: name, lat, lng }) }),
    activeSession:  (siteId) => request(`/api/patrols/sessions/active?site_id=${siteId}`),
    endSession:    (sessionId) => request(`/api/patrols/sessions/${sessionId}/end`, { method:'POST' }),
  },
  patterns: {
    list: (params = {}) => request(`/api/patterns?${new URLSearchParams(params)}`),
    create: (data) => request('/api/patterns', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/patterns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/patterns/${id}`, { method: 'DELETE' }),
  },
  rates: {
    list: () => request('/api/rates'),
    create: (data) => request('/api/rates', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/rates/${id}`, { method: 'DELETE' }),
  },
  alerts: {
    list: (params = {}) => request(`/api/alerts?${new URLSearchParams(params)}`),
    create: (data) => request('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  contracts: {
    lines: {
      list: (params = {}) => request(`/api/contracts/lines?${new URLSearchParams(params)}`),
      create: (data) => request('/api/contracts/lines', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => request(`/api/contracts/lines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id) => request(`/api/contracts/lines/${id}`, { method: 'DELETE' }),
    },
    queries: {
      list: (params = {}) => request(`/api/contracts/queries?${new URLSearchParams(params)}`),
      create: (data) => request('/api/contracts/queries', { method: 'POST', body: JSON.stringify(data) }),
      respond: (id, data) => request(`/api/contracts/queries/${id}/respond`, { method: 'POST', body: JSON.stringify(data) }),
    },
  },

  playbooks: {
    get:         (siteId) => request(`/api/playbooks/${siteId}`),
    savePatrol:  (siteId, data) => request(`/api/playbooks/${siteId}`, { method:'PUT', body:JSON.stringify(data) }),
    addTask:     (siteId, data) => request(`/api/playbooks/${siteId}/tasks`, { method:'POST', body:JSON.stringify(data) }),
    deleteTask:  (siteId, taskId) => request(`/api/playbooks/${siteId}/tasks/${taskId}`, { method:'DELETE' }),
    addCheck:    (siteId, data) => request(`/api/playbooks/${siteId}/checks`, { method:'POST', body:JSON.stringify(data) }),
    deleteCheck: (siteId, checkId) => request(`/api/playbooks/${siteId}/checks/${checkId}`, { method:'DELETE' }),
  },
  report: {
    generate: (data) => request('/api/report/generate', { method: 'POST', body: JSON.stringify(data) }),
    pdf:      (logId) => request('/api/report/pdf', { method: 'POST', body: JSON.stringify({ log_id: logId }) }),
    generateHandover: (data) => request('/api/report/handover', { method: 'POST', body: JSON.stringify(data) }),
    acknowledgeHandover: (id) => request(`/api/report/handover/${id}/acknowledge`, { method: 'POST' }),
    pendingHandover: (siteId) => request(`/api/report/handover/pending?site_id=${siteId}`),
  },
  invite: {
    send:   (data)   => request('/api/invite', { method: 'POST', body: JSON.stringify(data) }),
    resend: (userId) => request('/api/invite/resend', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  },

  portal: {
    sites: () => request('/api/portal/sites'),
    auth: (site_id, pin) => request('/api/portal/auth', { method: 'POST', body: JSON.stringify({ site_id, pin }) }),
    summary: (token) => request('/api/portal/summary', { headers: { Authorization: `Bearer ${token}` } }),
    logs: (token, params = {}) => request(`/api/portal/logs?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } }),
    alerts: (token, params = {}) => request(`/api/portal/alerts?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } }),
    raiseAlert: (token, data) => request('/api/portal/alerts', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }),
    documents: (token) => request('/api/portal/documents', { headers: { Authorization: `Bearer ${token}` } }),
    saveSettings: (siteId, data) => request(`/api/portal/settings/${siteId}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
};

export { ApiError };
