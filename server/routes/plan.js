import { Router } from 'express';
import { checkIn, generatePlan, getPlan, restoreWeek, updateTask } from '../controllers/plan.js';

const router = Router();

router.get('/', getPlan);
router.post('/generate', generatePlan);
router.post('/check-in', checkIn);
router.post('/restore-week', restoreWeek);
router.patch('/tasks/:id', updateTask);

export default router;
