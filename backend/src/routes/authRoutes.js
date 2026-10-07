import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/authController.js';
import { checkOrigin, requireAuth } from '../middleware/auth.js';

const router = Router();
router.post('/register', checkOrigin, register);
router.post('/login', checkOrigin, login);
router.post('/logout', checkOrigin, requireAuth, logout);
router.get('/me', requireAuth, getMe);

export default router;
