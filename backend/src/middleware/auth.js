import jwt from 'jsonwebtoken';
import User from '../../../database/models/User.js';

export function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
}

export function setAuthCookie(res, user, pending = false) {
  if (!process.env.JWT_SECRET) throw new Error('Server configuration error: JWT_SECRET environment variable is missing on Vercel');
  const token = jwt.sign({ authVersion: user.authVersion, purpose: pending ? 'email' : 'session' }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: user.id, expiresIn: pending ? '30m' : '1d'
  });
  res.cookie('token', token, { ...cookieOptions(), maxAge: pending ? 1800000 : 86400000 });
}

export const maskEmail = email => `${email[0]}***@${email.split('@')[1]}`;

export function checkOrigin(req, res, next) {
  const origin = req.get('origin');
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  let isVercel = false;
  try { if (origin) isVercel = /\.vercel\.app$/.test(new URL(origin).hostname); } catch {}
  const isDevLocal = process.env.NODE_ENV !== 'production' && origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== process.env.FRONTEND_URL && origin !== sameOrigin && !isVercel && !isDevLocal)) {
    return res.status(403).json({ success: false, message: 'Origin not allowed' });
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ success: false, message: 'Access denied' });
    next();
  };
}

function authenticate(allowUnverified) {
  return async function (req, res, next) {
    let payload;
    try {
      payload = jwt.verify(req.cookies?.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (typeof payload.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(payload.sub)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active' || user.authVersion !== payload.authVersion) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowUnverified && (user.emailVerified !== true || payload.purpose === 'email')) {
      return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', maskedEmail: maskEmail(user.email), message: 'Verify your email before continuing.' });
    }
    req.user = user;
    next();
  };
}

export const requireAuth = authenticate(false);
export const requireEmailAuth = authenticate(true);
