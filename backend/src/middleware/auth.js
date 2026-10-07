import jwt from 'jsonwebtoken';
import User from '../../../database/models/User.js';

export function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
}

export function checkOrigin(req, res, next) {
  const origin = req.get('origin');
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== process.env.FRONTEND_URL)) {
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

export async function requireAuth(req, res, next) {
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
  req.user = user;
  next();
}
