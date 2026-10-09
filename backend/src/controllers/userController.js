import { safeUser } from './authController.js';
import User from '../../../database/models/User.js';
import { uploadPrivateId, deleteCollegeId } from '../utils/cloudinary.js';

export async function submitVerification(req, res) {
  const previous = await User.findById(req.user._id).select('+verificationAssetId');
  if (!previous || previous.status !== 'active' || previous.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Student account required' });
  }
  if (previous.verificationStatus === 'verified' || (previous.verificationStatus === 'pending' && previous.verificationAssetId)) {
    return res.status(409).json({ success: false, message: 'An ID is already pending review or verified' });
  }

  const publicId = await uploadPrivateId(req.file.buffer);
  let updated;
  try {
    updated = await User.findOneAndUpdate({
      _id: previous._id, role: 'student', status: 'active', verificationStatus: previous.verificationStatus,
      verificationAssetId: previous.verificationAssetId || null
    }, { verificationAssetId: publicId, verificationStatus: 'pending', verificationReason: null }, { returnDocument: 'after', runValidators: true });
  } catch (error) {
    await deleteCollegeId(publicId);
    throw error;
  }
  if (!updated) {
    await deleteCollegeId(publicId);
    return res.status(409).json({ success: false, message: 'Verification changed; reload and try again' });
  }

  try {
    await deleteCollegeId(previous.verificationAssetId);
  } catch (error) {
    // Restore the old submission only if no admin has reviewed the new one.
    const restored = await User.findOneAndUpdate({ _id: previous._id, verificationAssetId: publicId, verificationStatus: 'pending', updatedAt: updated.updatedAt }, {
      verificationAssetId: previous.verificationAssetId, verificationStatus: previous.verificationStatus, verificationReason: previous.verificationReason || null
    });
    if (restored) await deleteCollegeId(publicId);
    throw error;
  }
  res.json({ success: true, verificationStatus: 'pending', verificationReason: null });
}

export async function getProfile(req, res) {
  const user = await User.findById(req.user._id).select('+verificationAssetId');
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.set('Cache-Control', 'no-store').json({ user: await safeUser(user) });
}

export async function updateProfile(req, res) {
  const body = req.body || {}, allowed = ['name', 'phone', 'department', 'year'];
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key)) ||
      (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) ||
      (body.phone !== undefined && (typeof body.phone !== 'string' || !/^\+?[0-9]{10,15}$/.test(body.phone.trim()))) ||
      (body.department !== undefined && (typeof body.department !== 'string' || body.department.trim().length > 100)) ||
      (body.year !== undefined && body.year !== null && (!Number.isInteger(body.year) || body.year < 1 || body.year > 6))) {
    return res.status(400).json({ message: 'Edit only name, phone, department and year using valid values' });
  }
  const fields = {};
  for (const key of allowed) if (body[key] !== undefined && body[key] !== null) fields[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
  const user = await User.findOneAndUpdate({ _id: req.user._id, status: 'active', role: 'student' },
    { $set: fields, ...(body.year === null ? { $unset: { year: '' } } : {}) }, { returnDocument: 'after', runValidators: true }).select('+verificationAssetId');
  if (!user) return res.status(403).json({ message: 'Active student account required' });
  res.json({ success: true, user: await safeUser(user) });
}
