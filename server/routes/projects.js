import { Router } from 'express';
import { listProjects, suggestProjects } from '../controllers/projects.js';

const router = Router();

router.get('/', listProjects);
router.post('/suggest', suggestProjects);

export default router;
