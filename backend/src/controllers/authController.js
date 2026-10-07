import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import User from '../../../database/models/User.js';
import { cookieOptions } from '../middleware/auth.js';

function safeUser(user) {
  const { name, email, phone, college, department, year, role, status, verificationStatus, createdAt, updatedAt } = user;
  return { id: user.id, name, email, phone, college, department, year, role, status, verificationStatus, createdAt, updatedAt };
}

export async function register(req, res) {
  const { name, email, password, phone, college, department, year } = req.body || {};
  if ([name, email, password, phone, college].some(value => typeof value !== 'string' || !value.trim()) ||
      password.length < 8 || password.length > 128 ||
      (department !== undefined && typeof department !== 'string') ||
      (year !== undefined && (!Number.isInteger(year) || year < 1 || year > 6))) {
    return res.status(400).json({ success: false, message: 'Provide valid profile fields and a password of 8 to 128 characters' });
  }

  const user = new User({ name, email, phone, college, department, year });
  await user.validate(['name', 'email', 'phone', 'college', 'department', 'year']);
  if (await User.exists({ email: user.email })) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }
  user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await user.save();
  res.status(201).json({ success: true, user: safeUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const invalid = () => res.status(401).json({ success: false, message: 'Invalid email or password' });
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || !password || password.length > 128) return invalid();

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || user.status !== 'active' || !await argon2.verify(user.passwordHash, password)) return invalid();

  const token = jwt.sign({ authVersion: user.authVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: user.id, expiresIn: '1d'
  });
  res.cookie('token', token, { ...cookieOptions(), maxAge: 24 * 60 * 60 * 1000 });
  res.json({ success: true, user: safeUser(user) });
}

export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { authVersion: 1 } });
  res.clearCookie('token', cookieOptions());
  res.json({ success: true, message: 'Logged out' });
}

export function getMe(req, res) {
  res.json({ success: true, user: safeUser(req.user) });
}
