import { Router } from 'express';
import { requireAuth, requireRole, checkOrigin } from '../middleware/auth.js';
import { createReport } from '../controllers/reportController.js';
import { reportLimiter } from '../middleware/rateLimiter.js';
const router = Router();
router.post('/', checkOrigin, reportLimiter, requireAuth, requireRole('student'), createReport);
export default router;
