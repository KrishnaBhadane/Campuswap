import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  publicId: { type: String, required: true, trim: true, maxlength: 255 },
  url: { type: String, required: true, trim: true, maxlength: 2048, match: /^https:\/\/[^\s]+$/ }
}, { _id: false });

const listingSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 3000 },
  category: { type: String, enum: ['books', 'electronics', 'stationery', 'hostel', 'cycles', 'other'], required: true },
  condition: { type: String, enum: ['new', 'like-new', 'good', 'fair'], required: true },
  pricePaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  college: { type: String, required: true, trim: true, maxlength: 200 },
  handoverLocation: { type: String, required: true, trim: true, maxlength: 200 },
  images: {
    type: [imageSchema],
    required: true,
    validate: { validator: images => images.length >= 1 && images.length <= 3, message: 'Provide 1 to 3 images.' }
  },
  brand: { type: String, trim: true, maxlength: 100 },
  semester: { type: Number, min: 1, max: 12, validate: Number.isInteger },
  status: { type: String, enum: ['available', 'reserved', 'sold'], default: 'available', required: true },
  moderationStatus: { type: String, enum: ['visible', 'hidden'], default: 'visible', required: true },
  moderationReason: { type: String, trim: true, maxlength: 500 },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

listingSchema.index({ moderationStatus: 1, deletedAt: 1, status: 1, createdAt: -1 });
listingSchema.index({ sellerId: 1, createdAt: -1 });
listingSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Listing', listingSchema);
