const API = {
  async _fetch(method, url, body) {
    const base = window.API_BASE || '';
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(base + url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },
  get: (url) => API._fetch('GET', url),
  post: (url, body) => API._fetch('POST', url, body),
  put: (url, body) => API._fetch('PUT', url, body),
  patch: (url, body) => API._fetch('PATCH', url, body),
  delete: (url) => API._fetch('DELETE', url),

  auth: {
    me: () => API.get('/api/auth/me'),
    register: (d) => API.post('/api/auth/register', d),
    login: (d) => API.post('/api/auth/login', d),
    logout: () => API.post('/api/auth/logout'),
  },
  state: () => API.get('/api/state'),
  hazards: {
    list: (q = '') => API.get('/api/hazards' + q),
    get: (id) => API.get('/api/hazards/' + id),
    categories: () => API.get('/api/hazards/categories'),
    report: (d) => API.post('/api/hazards/report', d),
    update: (id, d) => API.patch(`/api/hazards/${id}`, d),
    delete: (id) => API.delete(`/api/hazards/${id}`),
    upload: async (file) => {
      const fd = new FormData();
      fd.append('photo', file);
      const base = window.API_BASE || '';
      const res = await fetch(base + '/api/hazards/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'upload_failed');
      return data;
    },
  },
  posts: {
    list: (page = 1, limit = 10) => API.get(`/api/posts?page=${page}&limit=${limit}`),
    vote: (id) => API.post(`/api/posts/${id}/vote`),
    unvote: (id) => API.delete(`/api/posts/${id}/vote`),
    comment: (id, text) => API.post(`/api/posts/${id}/comments`, { text }),
  },
  profile: {
    update: (d) => API.put('/api/profile', d),
    prefs: (d) => API.put('/api/prefs', d),
    badges: () => API.get('/api/badges'),
    leaderboard: () => API.get('/api/leaderboard'),
    uploadAvatar: async (file) => {
      const fd = new FormData();
      fd.append('photo', file);
      const base = window.API_BASE || '';
      const res = await fetch(base + '/api/avatar', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'upload_failed');
      return data;
    },
  },
};

window.API = API;
