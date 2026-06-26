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

// Helper: race a promise against a timeout
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

// Helper to make authenticated requests
async function request(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeout || 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
      signal: controller.signal,
    };
    delete config.timeout;

    // Add Clerk session token (with 5s timeout to prevent hangs)
    if (typeof window !== 'undefined' && window.__clerkGetToken) {
      try {
        const token = await withTimeout(window.__clerkGetToken(), 5000, 'Auth token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch (e) { console.warn('Token fetch failed, continuing without auth:', e.message); }
    } else if (typeof window !== 'undefined') {
      try {
        const token = await withTimeout(window.Clerk?.session?.getToken?.() || Promise.resolve(null), 5000, 'Auth token');
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
    if (err.name === 'AbortError') throw new ApiError('Request timed out — check your connection', 0);
    throw new ApiError(err.message, 0, err);
  } finally {
    clearTimeout(timer);
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
    generateEmployeeNumber: () => request('/api/users/generate-employee-number', { method: 'POST' }),
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
    previous: (siteId) => request(`/api/shifts/previous?site_id=${siteId}`),
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
    bankHolidays: {
      list: () => request('/api/shifts/bank-holidays'),
      create: (data) => request('/api/shifts/bank-holidays', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id) => request(`/api/shifts/bank-holidays/${id}`, { method: 'DELETE' }),
    },
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
    comments: (id) => request(`/api/logs/${id}/comments`),
    addComment: (id, comment) => request(`/api/logs/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  },

  // Inspections
  inspections: {
    list: (params = {}) => request(`/api/inspections?${new URLSearchParams(params)}`),
    create: (data) => request('/api/inspections', { method: 'POST', body: JSON.stringify(data) }),
    getPdf: (id) => request(`/api/inspections/${id}/pdf`),
  },

  // HR
  hr: {
    get: () => request('/api/hr'),
    listAll: () => request('/api/hr?all=true'),
    getForUser: (userId) => request(`/api/hr/${userId}`),
    save: (data) => request('/api/hr', { method: 'PUT', body: JSON.stringify(data) }),
    getDocUrl: (docType, userId) => request(`/api/hr/documents/${docType}${userId ? `?user_id=${userId}` : ''}`),
    deleteDoc: (docType) => request(`/api/hr/documents/${docType}`, { method: 'DELETE' }),
    sendInvoice: (data) => request('/api/hr/invoice', { method: 'POST', body: JSON.stringify(data) }),
    uploadDoc: async (docType, file) => {
      const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
      const token = await window.__clerkGetToken?.() || '';
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      const r = await fetch(`${API}/api/hr/documents`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  },

  // Company Updates
  personnel: {
    get: (userId) => request(`/api/personnel/${userId}`),
    addEmployment: (userId, data) => request(`/api/personnel/${userId}/employment`, { method: 'POST', body: JSON.stringify(data) }),
    updateEmployment: (userId, id, data) => request(`/api/personnel/${userId}/employment/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteEmployment: (userId, id) => request(`/api/personnel/${userId}/employment/${id}`, { method: 'DELETE' }),
    addAddress: (userId, data) => request(`/api/personnel/${userId}/address`, { method: 'POST', body: JSON.stringify(data) }),
    deleteAddress: (userId, id) => request(`/api/personnel/${userId}/address/${id}`, { method: 'DELETE' }),
    setVetting: (userId, data) => request(`/api/personnel/${userId}/vetting`, { method: 'POST', body: JSON.stringify(data) }),
    addNote: (userId, content) => request(`/api/personnel/${userId}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
    deleteNote: (userId, id) => request(`/api/personnel/${userId}/notes/${id}`, { method: 'DELETE' }),
    updateVettingStatus: (userId, status) => request(`/api/personnel/${userId}/vetting-status`, { method: 'PATCH', body: JSON.stringify({ vetting_status: status }) }),
    updateHR: (userId, data) => request(`/api/personnel/${userId}/hr`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  updates: {
    list: () => request('/api/updates'),
    create: (data) => request('/api/updates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/updates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/updates/${id}`, { method: 'DELETE' }),
    comments: (id) => request(`/api/updates/${id}/comments`),
    comment: (id, content) => request(`/api/updates/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
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
    delete: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
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
    pending: (siteId) => request(`/api/handovers/pending/${siteId}`),
    acknowledge: (id) => request(`/api/handovers/${id}/acknowledge`, { method: 'PATCH' }),
  },

  siteChecks: {
    list: (siteId) => request(`/api/site-checks/${siteId}`),
    create: (siteId, label, sort_order) => request(`/api/site-checks/${siteId}`, { method: 'POST', body: JSON.stringify({ label, sort_order }) }),
    delete: (siteId, id) => request(`/api/site-checks/${siteId}/${id}`, { method: 'DELETE' }),
    complete: (shiftId, checks) => request(`/api/site-checks/complete/${shiftId}`, { method: 'POST', body: JSON.stringify({ checks }) }),
    completed: (shiftId) => request(`/api/site-checks/completed/${shiftId}`),
  },

  instructions: {
    get: (siteId) => request(`/api/instructions?site_id=${siteId}`),
    update: (siteId, sections) => request(`/api/instructions?site_id=${siteId}`, { method: 'PUT', body: JSON.stringify({ sections }) }),
  },
  policies: {
    get: () => request('/api/policies'),
    update: (sections) => request('/api/policies', { method: 'PUT', body: JSON.stringify({ sections }) }),
    upload: async (file, title) => {
      const form = new FormData();
      form.append('file', file);
      if (title) form.append('title', title);
      const token = await (window.__clerkGetToken ? window.__clerkGetToken() : window.Clerk?.session?.getToken?.());
      const res = await fetch(`${API_BASE}/api/policies/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
      return res.json();
    },
    downloadUrl: (index) => request(`/api/policies/download/${index}`),
  },
  folders: {
    list: (params = {}) => request(`/api/folders?${new URLSearchParams(params)}`),
    create: (data) => request('/api/folders', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/folders/${id}`, { method: 'DELETE' }),
    documents: {
      list: (params = {}) => request(`/api/folders/documents?${new URLSearchParams(params)}`),
      create: (data) => request('/api/folders/documents', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id) => request(`/api/folders/documents/${id}`, { method: 'DELETE' }),
      getSigned: (id) => request(`/api/folders/documents/${id}/signed`),
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
    listSessions:  (params = {}) => request(`/api/patrols/sessions?${new URLSearchParams(params)}`),
    getSession:    (sessionId) => request(`/api/patrols/sessions/${sessionId}`),
    uploadCheckpointImage: async (file) => {
      const fd = new FormData(); fd.append('image', file);
      const token = await window.__clerkGetToken?.() || '';
      const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
      const res = await fetch(`${API}/api/patrols/checkpoint-image`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
  },
  patterns: {
    list: (params = {}) => request(`/api/patterns?${new URLSearchParams(params)}`),
    create: (data) => request('/api/patterns', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/patterns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/patterns/${id}`, { method: 'DELETE' }),
  },
  rates: {
    list: (params = {}) => request(`/api/rates?${new URLSearchParams(params)}`),
    create: (data) => request('/api/rates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/rates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
    raiseAlert: (token, data) => request('/api/portal/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }),
    updateAlert: (token, id, data) => request(`/api/portal/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }),
    deleteAlert: (token, id) => request(`/api/portal/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
    documents: (token) => request('/api/portal/documents', { headers: { Authorization: `Bearer ${token}` } }),
    riskAssessments: (token) => request('/api/portal/risk-assessments', { headers: { Authorization: `Bearer ${token}` } }),
    assignmentInstructions: (token) => request('/api/portal/assignment-instructions', { headers: { Authorization: `Bearer ${token}` } }),
    approveAI: (token, data) => request('/api/portal/assignment-instructions/approve', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }),
    codes: (token) => request('/api/portal/codes', { headers: { Authorization: `Bearer ${token}` } }),
    subcontractorDocs: (token) => request('/api/portal/subcontractor-documents', { headers: { Authorization: `Bearer ${token}` } }),
    subcontractorDocSigned: (token, id) => request(`/api/portal/subcontractor-documents/${id}/signed`, { headers: { Authorization: `Bearer ${token}` } }),
    saveSettings: (siteId, data) => request(`/api/portal/settings/${siteId}`, { method: 'PUT', body: JSON.stringify(data) }),
    expectedVisitors: (token, data) => request('/api/portal/expected-visitors', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }),
    listExpectedVisitors: (token) => request('/api/portal/expected-visitors', { headers: { Authorization: `Bearer ${token}` } }),
    updateExpectedVisitorGroup: (token, groupId, data) => request(`/api/portal/expected-visitors/booking/${groupId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }),
    cancelExpectedVisitorGroup: (token, groupId) => request(`/api/portal/expected-visitors/booking/${groupId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  },
  subcontractors: {
    list: () => request('/api/subcontractors'),
    get: (id) => request(`/api/subcontractors/${id}`),
    create: (data) => request('/api/subcontractors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/subcontractors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/subcontractors/${id}`, { method: 'DELETE' }),
    setSites: (id, site_ids) => request(`/api/subcontractors/${id}/sites`, { method: 'PUT', body: JSON.stringify({ site_ids }) }),
    uploadDoc: async (id, file, site_id, doc_type, share_to_portal) => {
      const form = new FormData();
      form.append('file', file);
      form.append('site_id', site_id);
      if (doc_type) form.append('doc_type', doc_type);
      if (share_to_portal) form.append('share_to_portal', 'true');
      const token = await window.__clerkGetToken?.();
      const res = await fetch(`${API_BASE}/api/subcontractors/${id}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
      return res.json();
    },
    updateDoc: (id, docId, data) => request(`/api/subcontractors/${id}/documents/${docId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteDoc: (id, docId) => request(`/api/subcontractors/${id}/documents/${docId}`, { method: 'DELETE' }),
    docSigned: (id, docId) => request(`/api/subcontractors/${id}/documents/${docId}/signed`),
  },
  visitors: {
    list: (params = {}) => request(`/api/visitors?${new URLSearchParams(params)}`),
    create: (data) => request('/api/visitors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/visitors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  expectedVisitors: {
    list: (params = {}) => request(`/api/visitors/expected?${new URLSearchParams(params)}`),
    arrive: (id, data) => request(`/api/visitors/${id}/arrive`, { method: 'POST', body: JSON.stringify(data) }),
    create: (data) => request('/api/visitors/expected', { method: 'POST', body: JSON.stringify(data) }),
    updateGroup: (groupId, data) => request(`/api/visitors/booking/${groupId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    cancelGroup: (groupId) => request(`/api/visitors/booking/${groupId}`, { method: 'DELETE' }),
  },
  tenants: {
    list: (params = {}) => request(`/api/tenants?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/tenants/${id}`),
    create: (data) => request('/api/tenants', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/tenants/${id}`, { method: 'DELETE' }),
    addContact: (id, data) => request(`/api/tenants/${id}/contacts`, { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (contactId, data) => request(`/api/tenants/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteContact: (contactId) => request(`/api/tenants/contacts/${contactId}`, { method: 'DELETE' }),
  },
  distribution: {
    list: (params = {}) => request(`/api/distribution?${new URLSearchParams(params)}`),
    create: (data) => request('/api/distribution', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/distribution/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/distribution/${id}`, { method: 'DELETE' }),
  },
  products: {
    list: (params = {}) => request(`/api/products?${new URLSearchParams(params)}`),
    create: (data) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  },
  compliance: {
    dashboard: () => request('/api/compliance/dashboard'),
    getCriteria: (criterionId) => request(`/api/compliance/criteria/${criterionId}`),
    updateIndicator: (indicatorId, data) => request(`/api/compliance/indicators/${indicatorId}`, { method: 'PUT', body: JSON.stringify(data) }),
    autoCollect: () => request('/api/compliance/auto-collect', { method: 'POST' }),
  },
  escalation: {
    checkCall: (data) => request('/api/escalation/check-call', { method: 'POST', body: JSON.stringify(data) }),
    panic: (data) => request('/api/escalation/panic', { method: 'POST', body: JSON.stringify(data) }),
    missedCheck: (data) => request('/api/escalation/missed-check', { method: 'POST', body: JSON.stringify(data) }),
    getPins: () => request('/api/escalation/pins'),
    setPins: (data) => request('/api/escalation/pins', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ID Cards
  idCards: {
    summary: () => request('/api/id-cards/summary'),
    company: () => request('/api/id-cards/company'),
    list: (userId) => request(`/api/id-cards/${userId}`),
    issue: (data) => request('/api/id-cards', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status, reason) => request(`/api/id-cards/${id}`, { method: 'PATCH', body: JSON.stringify({ status, revocation_reason: reason }) }),
    pdfUrl: (id) => `${API_BASE}/api/id-cards/${id}/pdf`,
  },

  // Site Assignment Instructions
  siteAI: {
    get: (siteId) => request(`/api/site-ai/${siteId}`),
    published: (siteId) => request(`/api/site-ai/${siteId}/published`),
    save: (siteId, data) => request(`/api/site-ai/${siteId}`, { method: 'PUT', body: JSON.stringify(data) }),
    publish: (siteId) => request(`/api/site-ai/${siteId}/publish`, { method: 'POST' }),
    revisions: (siteId) => request(`/api/site-ai/${siteId}/revisions`),
    revision: (siteId, rev) => request(`/api/site-ai/${siteId}/revisions/${rev}`),
    declare: (siteId) => request(`/api/site-ai/${siteId}/declare`, { method: 'POST' }),
    declarations: (siteId) => request(`/api/site-ai/${siteId}/declarations`),
    officerCompliance: (userId) => request(`/api/site-ai/officer/${userId}/compliance`),
    pdf: (siteId, revision) => request(`/api/site-ai/${siteId}/pdf`, { method: 'POST', body: JSON.stringify({ revision }), timeout: 30000 }),
  },

  // Controlled Documents (QMS)
  controlledDocs: {
    list: (params = {}) => request(`/api/controlled-documents?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/controlled-documents/${id}`),
    create: (data) => request('/api/controlled-documents', { method: 'POST', body: JSON.stringify(data) }),
    upload: async (id, file) => {
      const form = new FormData();
      form.append('file', file);
      const token = await (window.__clerkGetToken ? window.__clerkGetToken() : window.Clerk?.session?.getToken?.());
      const res = await fetch(`${API_BASE}/api/controlled-documents/${id}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
      return res.json();
    },
    revise: (id) => request(`/api/controlled-documents/${id}/revise`, { method: 'POST' }),
    setStatus: (id, status, extras = {}) => request(`/api/controlled-documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...extras }) }),
    download: (id) => request(`/api/controlled-documents/${id}/download`),
    acknowledge: (id) => request(`/api/controlled-documents/${id}/acknowledge`, { method: 'POST' }),
    acknowledgements: (id) => request(`/api/controlled-documents/${id}/acknowledgements`),
    officerCompliance: (userId) => request(`/api/controlled-documents/officer/${userId}/compliance`),
    alerts: (params = {}) => request(`/api/controlled-documents/alerts?${new URLSearchParams(params)}`),
    registerExport: () => `${API_BASE}/api/controlled-documents/register-export`,
  },

  // Risk Assessments
  riskAssessments: {
    list: (params = {}) => request(`/api/risk-assessments?${new URLSearchParams(params)}`),
    get: (id) => request(`/api/risk-assessments/${id}`),
    create: (data) => request('/api/risk-assessments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/risk-assessments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/risk-assessments/${id}`, { method: 'DELETE' }),
    categories: (type) => request(`/api/risk-assessments/categories${type ? `?type=${type}` : ''}`),
    addRisk: (id, data) => request(`/api/risk-assessments/${id}/risks`, { method: 'POST', body: JSON.stringify(data) }),
    deleteRisk: (id, riskId) => request(`/api/risk-assessments/${id}/risks/${riskId}`, { method: 'DELETE' }),
    pdfUrl: (id) => `${API_BASE}/api/risk-assessments/${id}/pdf`,
  },
};

export { ApiError };
