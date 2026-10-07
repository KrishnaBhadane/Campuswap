import mongoose from 'mongoose';
import User from '../../../database/models/User.js';
import { readPrivateId } from '../utils/cloudinary.js';

const userFields = '_id name email college department year verificationStatus createdAt';

export async function listVerificationUsers(req, res) {
  const verification = req.query.verification || 'pending';
  const page = Number(req.query.page || 1);
  if (!['pending', 'verified', 'rejected'].includes(verification) || !Number.isInteger(page) || page < 1 || page > 10000) {
    return res.status(400).json({ success: false, message: 'Invalid verification filter or page' });
  }
  const limit = 12;
  const users = await User.find({ role: 'student', verificationStatus: verification, verificationAssetId: { $exists: true, $ne: null } })
    .select(userFields).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit + 1).lean();
  res.json({ success: true, users: users.slice(0, limit), pagination: { page, limit, hasMore: users.length > limit } });
}

export async function viewVerification(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user ID' });
  const user = await User.findOne({ _id: req.params.id, role: 'student' }).select('+verificationAssetId');
  if (!user?.verificationAssetId) return res.status(404).json({ success: false, message: 'College ID not found' });
  const image = await readPrivateId(user.verificationAssetId);
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="college-id.webp"' });
  res.type('webp').send(image);
}

export async function reviewVerification(req, res) {
  const { status, reason } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !['verified', 'rejected'].includes(status) ||
      (status === 'rejected' && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500))) {
    return res.status(400).json({ success: false, message: 'Use verified or rejected; rejection requires a reason up to 500 characters' });
  }
  const user = await User.findOneAndUpdate({
    _id: req.params.id, role: 'student', verificationStatus: 'pending', verificationAssetId: { $exists: true, $ne: null }
  }, { verificationStatus: status, verificationReason: status === 'rejected' ? reason.trim() : null }, { returnDocument: 'after', runValidators: true }).select(userFields);
  if (!user) return res.status(409).json({ success: false, message: 'No pending college ID to review' });
  res.json({ success: true, user });
}
