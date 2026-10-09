import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/authController.js';
import { checkOrigin, requireAuth, requireEmailAuth } from '../middleware/auth.js';
import { verifyEmail, resendOtp } from '../controllers/otpController.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.post('/register', checkOrigin, authLimiter, register);
router.post('/login', checkOrigin, authLimiter, login);
router.post('/logout', checkOrigin, requireEmailAuth, logout);
router.get('/me', requireAuth, getMe);
router.post('/verify-email', checkOrigin, requireEmailAuth, otpLimiter, verifyEmail);
router.post('/resend-otp', checkOrigin, requireEmailAuth, otpLimiter, resendOtp);

export default router;
