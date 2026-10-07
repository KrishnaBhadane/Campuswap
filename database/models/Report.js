import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['listing', 'user'], required: true },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: function () { return this.targetType === 'listing' ? 'Listing' : 'User'; }
  },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', required: true },
  resolutionNote: { type: String, trim: true, maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
