import mongoose from 'mongoose';

const homepageSchema = new mongoose.Schema({
  slot: { type: String, enum: ['banner-1', 'banner-2', 'banner-3', 'highlight'], required: true },
  title: { type: String, trim: true, maxlength: 150, default: '' },
  subtitle: { type: String, trim: true, maxlength: 300, default: '' },
  link: { type: String, maxlength: 2000, default: '' },
  active: { type: Boolean, default: false },
  image: { publicId: { type: String, required: true }, url: { type: String, required: true } }
}, { timestamps: true });
homepageSchema.index({ slot: 1 }, { unique: true });
export default mongoose.model('HomepageContent', homepageSchema);
