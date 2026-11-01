import { Router } from 'express';
import { createJob, deleteJob, estimateJob, listJobs, moveJobToRole } from '../controllers/jobs.js';

const router = Router();

router.get('/', listJobs);
router.post('/', createJob);
router.post('/estimate', estimateJob);
router.post('/:id/use-for-role', moveJobToRole);
router.delete('/:id', deleteJob);

export default router;
