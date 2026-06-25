// services/api.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this._isRefreshing = false;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = localStorage.getItem('accessToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { ...options, headers, credentials: 'include' });

      if (!response.ok) {
        if (response.status === 401 && !this._isRefreshing && !endpoint.includes('/auth/refresh')) {
          this._isRefreshing = true;
          try {
            const refreshed = await this.refreshToken();
            if (refreshed) return this.request(endpoint, options);
          } finally {
            this._isRefreshing = false;
          }
          this.clearToken();
        }
        const errData = await response.json().catch(() => ({}));
        console.error(`[API ${response.status}] ${options.method || 'GET'} ${endpoint}`, errData);
        let errorMessage = errData.message;
        if (!errorMessage && Array.isArray(errData.errors)) {
          errorMessage = errData.errors
            .map(err => typeof err === 'string' ? err : err.msg || err.message || JSON.stringify(err))
            .join('; ');
        }
        throw new Error(errorMessage || `Lỗi ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async download(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { ...options.headers };
    const token = localStorage.getItem('accessToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { ...options, headers, credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Lỗi tải file: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      throw error;
    }
  }

  async upload(endpoint, formData, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { ...options.headers };
    const token = localStorage.getItem('accessToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401 && !this._isRefreshing && !endpoint.includes('/auth/refresh')) {
          this._isRefreshing = true;
          try {
            const refreshed = await this.refreshToken();
            if (refreshed) return this.upload(endpoint, formData, options);
          } finally {
            this._isRefreshing = false;
          }
          this.clearToken();
        }
        const errData = await response.json().catch(() => ({}));
        console.error(`[API ${response.status}] ${options.method || 'POST'} ${endpoint}`, errData);
        let errorMessage = errData.message;
        if (!errorMessage && Array.isArray(errData.errors)) {
          errorMessage = errData.errors
            .map(err => typeof err === 'string' ? err : err.msg || err.message || JSON.stringify(err))
            .join('; ');
        }
        throw new Error(errorMessage || `Lỗi ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  get(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'GET' }); }
  post(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }); }
  put(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }); }
  patch(endpoint, body = {}, options = {}) { return this.request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }); }
  delete(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'DELETE' }); }
  setToken(token) { localStorage.setItem('accessToken', token); }
  getToken() { return localStorage.getItem('accessToken'); }
  clearToken() { localStorage.removeItem('accessToken'); }

  async refreshToken() {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) { this.setToken(data.accessToken); return true; }
      }
      return false;
    } catch { return false; }
  }
}

const api = new APIClient(API_URL);

export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get('/auth/me').then((data) => data.user),
  refresh: () => api.refreshToken(),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const userService = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/users${q ? '?' + q : ''}`);
  },
  getById: (id) => api.get(`/users/${id}`).then(d => d.user),
  create: (data) => api.post('/users', data).then(d => d.user),
  update: (id, data) => api.put(`/users/${id}`, data).then(d => d.user),
  deactivate: (id) => api.patch(`/users/${id}/deactivate`),
  activate: (id) => api.patch(`/users/${id}/activate`),
};

export const classService = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/classes${q ? '?' + q : ''}`).then(d => d.classes);
  },
  getById: (id) => api.get(`/classes/${id}`).then(d => d.class),
  getStudents: (id) => api.get(`/classes/${id}/students`).then(d => d.students),
  create: (data) => api.post('/classes', data).then(d => d.class),
  update: (id, data) => api.put(`/classes/${id}`, data).then(d => d.class),
  delete: (id) => api.delete(`/classes/${id}`),
};

export const classSubjectService = {
  getAll: () => api.get('/class-subjects'),
  getByClass: (class_id) => api.get(`/class-subjects/${class_id}`),
  assignToClass: (class_id, assignments) => api.post(`/class-subjects/${class_id}/assign`, { assignments }),
  getTeacherClasses: (teacher_id) => api.get(`/class-subjects/teacher/${teacher_id}`),
};

export const subjectService = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/subjects${q ? '?' + q : ''}`).then(d => d.subjects);
  },
  getById: (id) => api.get(`/subjects/${id}`).then(d => d.subject),
  create: (data) => api.post('/subjects', data).then(d => d.subject),
  update: (id, data) => api.put(`/subjects/${id}`, data).then(d => d.subject),
  delete: (id) => api.delete(`/subjects/${id}`),
};

export const questionService = {
  getAll: (filters = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined))
    ).toString();
    return api.get(`/questions${q ? '?' + q : ''}`);
  },
  getById: (id) => api.get(`/questions/${id}`).then(d => d.question),
  create: (data) => api.post('/questions', data),
  update: (id, data) => api.put(`/questions/${id}`, data),
  approve: (id) => api.patch(`/questions/${id}/approve`),
  reject: (id) => api.patch(`/questions/${id}/reject`),
  delete: (id) => api.delete(`/questions/${id}`),
};

export const examService = {
  getAll: (params) => api.request(`/exams?${new URLSearchParams(params).toString()}`),
  getById: (id) => api.request(`/exams/${id}`),
  create: (data) => api.request('/exams', { method: 'POST', body: JSON.stringify(data) }),
  setQuestions: (id, questions) => api.request(`/exams/${id}/questions`, { method: 'PUT', body: JSON.stringify({ questions }) }),
  autoGenerate: (id, data) => api.request(`/exams/${id}/auto-generate`, { method: 'POST', body: JSON.stringify(data) }),
  submit: (id) => api.request(`/exams/${id}/submit`, { method: 'PATCH' }),
  approve: (id) => api.request(`/exams/${id}/approve`, { method: 'PATCH' }),
  reject: (id, reason) => api.request(`/exams/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  delete: (id) => api.request(`/exams/${id}`, { method: 'DELETE' }),

  getMatrix: (id) => api.request(`/exams/${id}/matrix`),
  setMatrix: (id, matrix) => api.request(`/exams/${id}/matrix`, { method: 'PUT', body: JSON.stringify(matrix) }),
  autoGenerateFromMatrix: (id) => api.request(`/exams/${id}/auto-generate-from-matrix`, { method: 'POST' }),

  importFile: (formData) => api.upload('/exams/import-file', formData),
  exportExcel: (id) => api.download(`/exams/${id}/export`),
  
  // ── Lịch thi ────────────────────────────────────────────────
  getSchedules: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
    ).toString();
    return api.request(`/exams/schedules${q ? '?' + q : ''}`).then(d => d.schedules || d);
  },
  createSchedule: (data) => api.request('/exams/schedules', { method: 'POST', body: JSON.stringify(data) }).then(d => d.schedule),
  cancelSchedule: (id) => api.request(`/exams/schedules/${id}/cancel`, { method: 'PATCH' }),
  updateSchedule: (id, data) => api.request(`/exams/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(d => d.schedule),
  deleteSchedule: (id) => api.request(`/exams/schedules/${id}`, { method: 'DELETE' }),

  // Nghiệp vụ GDPT 2018
  triggerExam: (id) => api.request(`/exams/${id}/trigger`, { method: 'PATCH' }),
  generateRooms: (id) => api.request(`/exams/${id}/generate-rooms`, { method: 'POST' }),
  getRooms: (id) => api.request(`/exams/${id}/rooms`),
  getRoomStudents: (roomId) => api.request(`/exams/rooms/${roomId}/students`),
};

export const submissionService = {
  enter: (schedule_id) => api.post('/submissions/enter', { schedule_id }),
  saveAnswer: (submissionId, question_id, student_answer) =>
    api.post(`/submissions/${submissionId}/answer`, { question_id, student_answer }),
  submit: (submissionId) => api.post(`/submissions/${submissionId}/submit`, {}),
  getResult: (submissionId) => api.get(`/submissions/${submissionId}/result`),
  gradeEssay: (submissionId, question_id, final_score) =>
    api.patch(`/submissions/${submissionId}/grade`, { question_id, final_score }),
  getClassResults: (scheduleId) => api.get(`/submissions/schedule/${scheduleId}/results`).then(d => d.results),
  getMyResults: () => api.get('/submissions/my-results').then(d => d.results),
};

export const statisticsService = {
  getAdminOverview: () => api.request('/statistics/overview').then(d => d.overview || d),
  getScheduleSummary: (scheduleId) => api.request(`/statistics/schedule/${scheduleId}`),
  getClassHistory: (classId) => api.request(`/statistics/class/${classId}`),
  getStudentProgress: () => api.request('/statistics/student/progress'),
  getStudentSummary: () => api.request('/statistics/student/summary'),
  getQuestionBankStats: () => api.request('/statistics/question-bank'),
};

// ==========================================
// GRADES SERVICE (GDPT 2018)
// ==========================================
export const gradeService = {
  getClassSubjectGrades: (id) => api.request(`/grades/class-subject/${id}`),
  getHomeroomGrades: (id) => api.request(`/grades/homeroom/${id}`),
};

export const teacherSubjectService = {
  // Giáo viên / tổ trưởng xem môn của mình
  getMySubjects: () => api.get('/teacher-subjects/my-subjects').then(d => d.subjects || []),

  // Admin xem tất cả phân công
  getAll: () => api.get('/teacher-subjects').then(d => d),

  // Admin xem phân công của 1 giáo viên
  getByTeacher: (id) => api.get(`/teacher-subjects/teacher/${id}`).then(d => d.subjects || []),

  // Admin gán môn cho giáo viên (ghi đè)
  assignToTeacher: (id, subject_ids) =>
    api.put(`/teacher-subjects/teacher/${id}`, { subject_ids }),

  // Admin xem phân công của tổ trưởng
  getByHead: (id) => api.get(`/teacher-subjects/head/${id}`).then(d => d.subjects || []),

  // Admin gán môn cho tổ trưởng
  assignToHead: (id, subject_names) =>
    api.put(`/teacher-subjects/head/${id}`, { subject_names }),

  // Lấy danh sách tên môn duy nhất
  getSubjectNames: () => api.get('/teacher-subjects/subject-names').then(d => d.names || []),
};

export default api;

export const healthService = {
  check: async () => {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return data || {
        status: 'degraded',
        time: new Date().toISOString(),
        services: { database: 'error', nlp: 'error' },
      };
    }
    return data;
  },
};
