import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agreedPricePaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'], default: 'pending', required: true },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

dealSchema.index({ buyerId: 1, createdAt: -1 });
dealSchema.index({ sellerId: 1, createdAt: -1 });

export default mongoose.model('Deal', dealSchema);
