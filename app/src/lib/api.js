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

    // Add Clerk session token for auth — wait for Clerk to be ready
    if (typeof window !== 'undefined') {
      let token = null;
      // Wait up to 5s for Clerk session to be available
      for (let i = 0; i < 10; i++) {
        if (window.Clerk?.session) {
          token = await window.Clerk.session.getToken();
          if (token) break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
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
    list: (params = {}) => request(`/api/users?${new URLSearchParams(params)}`),
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
    list: (params = {}) => request(`/api/patrols?${new URLSearchParams(params)}`),
    create: (data) => request('/api/patrols', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/patrols/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/patrols/${id}`, { method: 'DELETE' }),
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

  invite: {
    send: (data) => request('/api/invite', { method: 'POST', body: JSON.stringify(data) }),
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
