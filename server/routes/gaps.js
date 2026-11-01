import { Router } from 'express';
import { getGaps } from '../controllers/gaps.js';

const router = Router();

router.get('/', getGaps);

export default router;
