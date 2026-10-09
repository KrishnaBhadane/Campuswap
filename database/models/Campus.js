import mongoose from 'mongoose';

const campusSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  campusCode: { type: String, required: true, immutable: true, trim: true, match: /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/, maxlength: 40 },
  officialCode: { type: String, required: true, trim: true, match: /^[0-9]{4,10}$/ },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', required: true }
}, { timestamps: true });
campusSchema.index({ campusCode: 1 }, { unique: true });
campusSchema.index({ officialCode: 1 }, { unique: true });
export default mongoose.model('Campus', campusSchema);
