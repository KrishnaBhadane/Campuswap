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
