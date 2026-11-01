import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, logout, me, register } from '../controllers/auth.js';

const FAILED_ATTEMPTS = 10;

// Only failed attempts count, so normal use never hits the limit.
const limitFailures = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: FAILED_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed attempts. Please try again in 15 minutes.' },
});

const router = Router();

router.post('/register', limitFailures, register);
router.post('/login', limitFailures, login);
router.post('/logout', logout);
router.get('/me', me);

export default router;
