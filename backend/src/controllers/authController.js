import argon2 from 'argon2';
import User from '../../../database/models/User.js';
import { cookieOptions, setAuthCookie } from '../middleware/auth.js';
import Campus from '../../../database/models/Campus.js';
import { beginEmailVerification } from './otpController.js';

export async function safeUser(user) {
  const { name, email, phone, college, department, year, role, status, verificationStatus, createdAt, updatedAt } = user;
  const campus = user.campusCode ? await Campus.findOne({ campusCode: user.campusCode }).lean() : null;
  return { id: user.id, verificationReason: user.verificationReason || null, hasCollegeId: Boolean(user.verificationAssetId), name, email, emailVerified: user.emailVerified, phone, college: campus?.name || college, campusCode: campus?.campusCode || null,
    officialCode: campus?.officialCode || null, department, year, role, status, verificationStatus, createdAt, updatedAt };
}

export async function register(req, res) {
  const { name, email, password, phone, campusCode, department, year } = req.body || {};
  const campus = typeof campusCode === 'string' ? await Campus.findOne({ campusCode, status: 'active' }).lean() : null;
  if (!campus) return res.status(400).json({ success: false, message: 'Select a college from the campus list' });
  if ([name, email, password, phone].some(value => typeof value !== 'string' || !value.trim()) ||
      password.length < 8 || password.length > 128 ||
      (department !== undefined && typeof department !== 'string') ||
      (year !== undefined && (!Number.isInteger(year) || year < 1 || year > 6))) {
    return res.status(400).json({ success: false, message: 'Provide valid profile fields and a password of 8 to 128 characters' });
  }

  const user = new User({ name, email, phone, college: campus.name, campusCode: campus.campusCode, department, year });
  await user.validate(['name', 'email', 'phone', 'college', 'campusCode', 'department', 'year']);
  if (await User.exists({ email: user.email })) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }
  user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await user.save();
  await beginEmailVerification(user, res, 201);
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const invalid = () => res.status(401).json({ success: false, message: 'Invalid email or password' });
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || !password || password.length > 128) return invalid();

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || user.status !== 'active' || !await argon2.verify(user.passwordHash, password)) return invalid();
  if (user.emailVerified !== true) return beginEmailVerification(user, res);
  setAuthCookie(res, user);
  res.json({ success: true, user: await safeUser(user) });
}

export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { authVersion: 1 } });
  res.clearCookie('token', cookieOptions());
  res.json({ success: true, message: 'Logged out' });
}

export async function getMe(req, res) {
  res.json({ success: true, user: await safeUser(req.user) });
}
