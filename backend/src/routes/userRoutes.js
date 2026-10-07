import { Router } from 'express';
import { checkOrigin, requireAuth, requireRole } from '../middleware/auth.js';
import { uploadCollegeId, prepareCollegeId } from '../middleware/upload.js';
import { submitVerification } from '../controllers/userController.js';

const router = Router();
router.put('/me/verification', checkOrigin, requireAuth, requireRole('student'), uploadCollegeId, prepareCollegeId, submitVerification);

export default router;
