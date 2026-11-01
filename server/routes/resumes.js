import { Router } from 'express';
import { activateResume, deleteResume, getResumeFile, listResumes } from '../controllers/resumes.js';

const router = Router();

router.get('/', listResumes);
router.get('/:id/file', getResumeFile);
router.post('/:id/activate', activateResume);
router.delete('/:id', deleteResume);

export default router;
