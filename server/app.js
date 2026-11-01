import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import applicationRoutes from './routes/applications.js';
import authRoutes from './routes/auth.js';
import gapRoutes from './routes/gaps.js';
import interviewRoutes from './routes/interviews.js';
import jobRoutes from './routes/jobs.js';
import planRoutes from './routes/plan.js';
import profileRoutes from './routes/profile.js';
import projectRoutes from './routes/projects.js';
import resumeRoutes from './routes/resumes.js';

const app = express();

// Hosting platforms sit behind one proxy, which rate limiting needs to see the real address.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

app.use('/api', requireAuth);
app.use('/api', profileRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/gaps', gapRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/applications', applicationRoutes);

app.use(errorHandler);

export default app;
