import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, required: true, trim: true, match: /^\+?[0-9]{10,15}$/ },
  college: { type: String, required: true, trim: true, maxlength: 200 },
  department: { type: String, trim: true, maxlength: 100 },
  year: { type: Number, min: 1, max: 6, validate: Number.isInteger },
  role: { type: String, enum: ['student', 'admin'], default: 'student', required: true },
  status: { type: String, enum: ['active', 'blocked'], default: 'active', required: true },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', required: true },
  verificationAssetId: { type: String, trim: true, select: false },
  verificationReason: { type: String, trim: true, maxlength: 500 },
  authVersion: { type: Number, default: 0, min: 0, required: true, validate: Number.isSafeInteger },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export default mongoose.model('User', userSchema);
