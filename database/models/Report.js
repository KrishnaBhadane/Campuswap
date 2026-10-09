import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['listing', 'user', 'support'], required: true },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function () { return this.targetType !== 'support'; },
    ref: function () {
      if (this.targetType === 'listing') return 'Listing';
      if (this.targetType === 'user') return 'User';
      return null;
    }
  },
  campusCode: { type: String, required: true, maxlength: 40 },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', required: true },
  resolutionNote: { type: String, trim: true, maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });

reportSchema.index({ campusCode: 1, status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });

export default mongoose.model('Report', reportSchema);
