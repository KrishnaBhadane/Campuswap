import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import User from '../../../database/models/User.js';
import { sendVerificationEmail } from '../utils/mail.js';
import { setAuthCookie, maskEmail } from '../middleware/auth.js';

const hashCode = (id, code) => {
  if (!process.env.JWT_SECRET) throw new Error('Server configuration error: JWT_SECRET environment variable is missing on Vercel');
  return createHmac('sha256', process.env.JWT_SECRET).update(`email-otp:${id}:${code}`).digest('hex');
};
const otpFields = { emailOtpHash: '', emailOtpExpiresAt: '', emailOtpLastSentAt: '', emailOtpAttempts: '', emailOtpWindowStartedAt: '', emailOtpSendCount: '' };

async function sendOtp(user) {
  const now = new Date();
  await User.updateOne({ _id: user._id, $or: [
    { emailOtpWindowStartedAt: null }, { emailOtpWindowStartedAt: { $lte: new Date(Date.now() - 3600000) } }
  ] }, { $set: { emailOtpWindowStartedAt: now, emailOtpSendCount: 0 } });

  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const hash = hashCode(user.id, code);
  const claimed = await User.findOneAndUpdate({
    _id: user._id, status: 'active', emailVerified: { $ne: true }, emailOtpSendCount: { $lt: 5 },
    $or: [{ emailOtpLastSentAt: null }, { emailOtpLastSentAt: { $lte: new Date(Date.now() - 60000) } }]
  }, {
    $set: { emailOtpHash: hash, emailOtpExpiresAt: new Date(Date.now() + 600000), emailOtpLastSentAt: now, emailOtpAttempts: 0 },
    $inc: { emailOtpSendCount: 1 }
  }).select('_id');
  if (!claimed) return 'limited';

  try {
    await sendVerificationEmail(user.email, code);
    return 'sent';
  } catch {
    await User.updateOne({ _id: user._id, emailOtpHash: hash }, { $unset: { emailOtpHash: '', emailOtpExpiresAt: '' } });
    return 'failed';
  }
}

export async function beginEmailVerification(user, res, status = 403) {
  setAuthCookie(res, user, true);
  const result = await sendOtp(user);
  const message = result === 'sent' ? 'Check your email for a verification code.' : result === 'limited'
    ? 'Use your existing code, or wait before requesting another.' : 'Your account needs verification, but email could not be sent. Try resending later.';
  res.status(result === 'failed' ? 503 : status).json({ success: result !== 'failed' && status < 400, code: 'EMAIL_VERIFICATION_REQUIRED', maskedEmail: maskEmail(user.email), otpSent: result === 'sent', message });
}

export async function resendOtp(req, res) {
  if (req.user.emailVerified) return res.json({ success: true, message: 'Email verification is already complete.' });
  const result = await sendOtp(req.user);
  if (result === 'limited') return res.set('Retry-After', '60').status(429).json({ success: false, message: 'Wait at least 60 seconds between codes. Maximum 5 codes per hour.' });
  if (result === 'failed') return res.status(503).json({ success: false, message: 'Verification email could not be sent. Try again later.' });
  res.json({ success: true, otpSent: true, message: 'A new verification code has been sent.' });
}

export async function verifyEmail(req, res) {
  const { code } = req.body || {};
  const invalid = () => res.status(400).json({ success: false, message: 'Invalid or expired code. Request a new code if needed.' });
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return invalid();

  const user = await User.findOneAndUpdate({
    _id: req.user._id, status: 'active', emailVerified: { $ne: true },
    emailOtpHash: { $exists: true }, emailOtpExpiresAt: { $gt: new Date() }, emailOtpAttempts: { $lt: 5 }
  }, { $inc: { emailOtpAttempts: 1 } }, { returnDocument: 'after' }).select('+emailOtpHash');
  if (!user) return invalid();
  const stored = Buffer.from(user.emailOtpHash, 'hex');
  const candidate = Buffer.from(hashCode(user.id, code), 'hex');
  if (stored.length !== candidate.length || !timingSafeEqual(stored, candidate)) return invalid();

  const verified = await User.findOneAndUpdate({
    _id: user._id, status: 'active', emailVerified: { $ne: true }, emailOtpHash: user.emailOtpHash, emailOtpExpiresAt: { $gt: new Date() }
  }, { $set: { emailVerified: true }, $unset: otpFields, $inc: { authVersion: 1 } }, { returnDocument: 'after' });
  if (!verified) return invalid();
  setAuthCookie(res, verified);
  res.json({ success: true, role: verified.role, message: 'Email verified.' });
}
