import { Router } from 'express';
import {
  answerQuestion,
  getInterview,
  getRubric,
  listInterviews,
  startInterview,
} from '../controllers/interviews.js';

const router = Router();

router.get('/', listInterviews);
router.get('/rubric', getRubric);
router.post('/', startInterview);
router.get('/:id', getInterview);
router.post('/:id/answer', answerQuestion);

export default router;
