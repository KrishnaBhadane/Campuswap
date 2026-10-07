import { Router } from 'express';
import { checkOrigin, requireAuth, requireRole } from '../middleware/auth.js';
import { listVerificationUsers, viewVerification, reviewVerification } from '../controllers/adminController.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/users', listVerificationUsers);
router.get('/users/:id/verification', viewVerification);
router.patch('/users/:id/verification', checkOrigin, reviewVerification);

export default router;
