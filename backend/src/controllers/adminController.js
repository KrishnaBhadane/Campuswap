import mongoose from 'mongoose';
import User from '../../../database/models/User.js';
import Report from '../../../database/models/Report.js';
import Listing from '../../../database/models/Listing.js';
import { readPrivateId } from '../utils/cloudinary.js';

const userFields = '_id name email college campusCode department year emailVerified verificationStatus status autoBlocked createdAt';

export async function listVerificationUsers(req, res) {
  const filter = { role: 'student', ...req.campusFilter };
  if (req.query.verification !== undefined) {
    if (!['pending', 'verified', 'rejected'].includes(req.query.verification)) return res.status(400).json({ message: 'Invalid verification filter' });
    filter.verificationStatus = req.query.verification;
  }
  const users = await User.find(filter).select(userFields + ' +verificationAssetId')
    .sort({ createdAt: -1, _id: -1 }).skip((req.adminPage - 1) * 12).limit(13).lean();
  res.set('Cache-Control', 'no-store').json({ users: users.slice(0, 12).map(({ verificationAssetId, ...user }) => ({ ...user, hasCollegeId: Boolean(verificationAssetId) })),
    pagination: { page: req.adminPage, hasMore: users.length > 12 } });
}

export async function dashboard(req, res) {
  const users = { role: 'student', ...req.campusFilter };
  const listings = { ...req.campusFilter, deletedAt: null };
  const [students, pending, activeListings, recentStudents, recentListings, openReports, recentReports] = await Promise.all([
    User.countDocuments(users),
    User.countDocuments({ ...users, verificationStatus: 'pending', verificationAssetId: { $exists: true, $ne: null } }),
    Listing.countDocuments({ ...listings, status: 'available', moderationStatus: 'visible' }),
    User.find(users).select('name email college campusCode createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    Listing.find(listings).select('title campusCode pricePaise createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    Report.countDocuments({ ...req.campusFilter, status: 'open' }),
    Report.find(req.campusFilter).select('targetType reason status campusCode createdAt').sort({ createdAt: -1 }).limit(5).lean()
  ]);
  res.json({ counts: { students, pending, activeListings, openReports }, recentStudents, recentListings, recentReports });
}

export async function setUserStatus(req, res) {
  const { status } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !['active', 'blocked'].includes(status)) return res.status(400).json({ message: 'Use active or blocked' });
  const update = { $set: { status }, $inc: { authVersion: 1 } };
  if (status === 'active') {
    update.$set.autoBlocked = false;
    update.$set.unblockedAt = new Date();
  } else if (status === 'blocked') {
    update.$set.autoBlocked = false;
  }
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'student', ...req.campusFilter },
    update, { returnDocument: 'after' }).select(userFields);
  if (!user) return res.status(404).json({ message: 'Student not found in selected campus' });
  res.json({ user });
}

export async function deleteUser(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: 'Invalid student ID' });
  const user = await User.findOne({ _id: req.params.id, role: 'student', ...req.campusFilter });
  if (!user) return res.status(404).json({ message: 'Student not found in selected campus' });

  await Promise.all([
    Listing.deleteMany({ sellerId: user._id }),
    Report.deleteMany({ $or: [{ reporterId: user._id }, { reportedUserId: user._id }] }),
    User.deleteOne({ _id: user._id })
  ]);

  res.json({ success: true, message: 'Student account removed permanently' });
}

export async function viewVerification(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user ID' });
  const user = await User.findOne({ _id: req.params.id, role: 'student', ...req.campusFilter }).select('+verificationAssetId');
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
    _id: req.params.id, role: 'student', ...req.campusFilter, verificationStatus: 'pending', verificationAssetId: { $exists: true, $ne: null }
  }, { verificationStatus: status, verificationReason: status === 'rejected' ? reason.trim() : null }, { returnDocument: 'after', runValidators: true }).select(userFields);
  if (!user) return res.status(409).json({ success: false, message: 'No pending college ID to review' });
  res.json({ success: true, user });
}
