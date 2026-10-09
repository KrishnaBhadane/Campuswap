import HomepageContent from '../../../database/models/HomepageContent.js';
import { uploadProductImage, deleteProductImage } from '../utils/cloudinary.js';

const slots = ['banner-1', 'banner-2', 'banner-3', 'highlight'];
export async function publicHomepage(req, res) {
  res.json({ content: await HomepageContent.find({ active: true }).select('slot title subtitle link image.url -_id').sort({ slot: 1 }).lean() });
}
export async function adminHomepage(req, res) {
  res.json({ content: await HomepageContent.find().select('slot title subtitle link active image.url').sort({ slot: 1 }).lean() });
}
export async function saveHomepage(req, res) {
  const { title = '', subtitle = '', link = '', active } = req.body || {};
  const validLink = typeof link === 'string' && (link === '' || (/^\/(?!\/)/.test(link) && !/[\\\s]/.test(link)) || /^https?:\/\/[^\s\\]+$/i.test(link));
  if (!slots.includes(req.params.slot) || typeof title !== 'string' || title.length > 150 ||
      typeof subtitle !== 'string' || subtitle.length > 300 || !validLink || link.length > 2000 ||
      !['true', 'false', true, false].includes(active) || (req.files?.length || 0) > 1) {
    return res.status(400).json({ message: 'Use a valid content slot, short text, safe link, active status and one image' });
  }
  const existing = await HomepageContent.findOne({ slot: req.params.slot }).lean();
  if (!existing && !req.files?.length) return res.status(400).json({ message: 'An image is required for new content' });
  let image;
  try {
    if (req.files?.length) image = await uploadProductImage(req.files[0].buffer);
    const previous = await HomepageContent.findOneAndUpdate({ slot: req.params.slot }, {
      $set: { title, subtitle, link, active: active === true || active === 'true', ...(image ? { image } : {}) }
    }, { upsert: Boolean(image), returnDocument: 'before', runValidators: true });
    if (!previous && !image) return res.status(409).json({ message: 'Content changed. Reload and try again.' });
    if (image && previous?.image?.publicId) await deleteProductImage(previous.image.publicId);
    res.json({ success: true });
  } catch (error) {
    if (image) await deleteProductImage(image.publicId);
    throw error;
  }
}
export async function deleteHomepage(req, res) {
  if (!slots.includes(req.params.slot)) return res.status(400).json({ message: 'Invalid content slot' });
  const content = await HomepageContent.findOneAndDelete({ slot: req.params.slot });
  if (content) await deleteProductImage(content.image.publicId);
  res.json({ success: true });
}
