import { Router } from 'express';
import {
  createApplication,
  deleteApplication,
  getInsights,
  listApplications,
  updateApplication,
} from '../controllers/applications.js';

const router = Router();

router.get('/', listApplications);
router.get('/insights', getInsights);
router.post('/', createApplication);
router.patch('/:id', updateApplication);
router.delete('/:id', deleteApplication);

export default router;
