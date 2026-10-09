import { Router } from 'express';
import { checkOrigin, requireAuth, requireRole } from '../middleware/auth.js';
import { uploadCollegeId, prepareCollegeId } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { submitVerification, getProfile, updateProfile } from '../controllers/userController.js';

const router = Router();
router.get('/me', requireAuth, requireRole('student'), getProfile);
router.patch('/me', checkOrigin, requireAuth, requireRole('student'), updateProfile);
router.put('/me/verification', checkOrigin, requireAuth, requireRole('student'), uploadLimiter, uploadCollegeId, prepareCollegeId, submitVerification);

export default router;
