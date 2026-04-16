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

    // Add Clerk session token for auth
    if (typeof window !== 'undefined' && window.Clerk?.session) {
      const token = await window.Clerk.session.getToken();
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
    me: () => request('/api/users/me'),
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

  // Shifts
  shifts: {
    list: (params = {}) => request(`/api/shifts?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/shifts/${id}`),
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
};

export { ApiError };
