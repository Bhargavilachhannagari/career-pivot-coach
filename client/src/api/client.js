import axios from 'axios';

export const SESSION_EXPIRED = 'session-expired';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const http = axios.create({ baseURL: API_URL, withCredentials: true });

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const onAuthRoute = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !onAuthRoute) window.dispatchEvent(new Event(SESSION_EXPIRED));

    const message = error.response?.data?.error ?? 'Could not reach the server. Is the backend running?';
    return Promise.reject(new Error(message));
  },
);

export const getCurrentUser = () => http.get('/auth/me');
export const login = (credentials) => http.post('/auth/login', credentials);
export const register = (credentials) => http.post('/auth/register', credentials);
export const logout = () => http.post('/auth/logout');

export const getProfile = () => http.get('/profile');
export const updateProfile = (profile) => http.put('/profile', profile);
export const describeProfile = (text) => http.post('/profile/describe', { text });

export function uploadResume(file, name) {
  const form = new FormData();
  if (name) form.append('name', name);
  form.append('resume', file);
  return http.post('/resume/upload', form);
}

export const getResumes = () => http.get('/resumes');
export const activateResume = (id) => http.post(`/resumes/${id}/activate`);
export const deleteResume = (id) => http.delete(`/resumes/${id}`);
export const resumeFileUrl = (id) => `${API_URL}/resumes/${id}/file`;

export const getJobs = () => http.get('/jobs');
export const addJob = (job) => http.post('/jobs', job);
export const deleteJob = (id) => http.delete(`/jobs/${id}`);
export const estimateJobs = () => http.post('/jobs/estimate');
export const moveJobToRole = (id) => http.post(`/jobs/${id}/use-for-role`);
export const getGaps = () => http.get('/gaps');

export const getPlan = () => http.get('/plan');
export const generatePlan = () => http.post('/plan/generate');
export const updateTask = (id, done) => http.patch(`/plan/tasks/${id}`, { done });
export const checkInWeek = (completeAll) => http.post('/plan/check-in', { completeAll });
export const restoreWeek = () => http.post('/plan/restore-week');

export const getProjects = () => http.get('/projects');
export const suggestProjects = () => http.post('/projects/suggest');

export const getRubric = () => http.get('/interviews/rubric');
export const getInterviews = () => http.get('/interviews');
export const startInterview = (focus) => http.post('/interviews', focus);
export const answerQuestion = (id, questionId, answer, spoken) =>
  http.post(`/interviews/${id}/answer`, { questionId, answer, spoken });

export const getApplications = () => http.get('/applications');
export const getInsights = () => http.get('/applications/insights');
export const addApplication = (application) => http.post('/applications', application);
export const updateApplication = (id, status) => http.patch(`/applications/${id}`, { status });
export const deleteApplication = (id) => http.delete(`/applications/${id}`);
