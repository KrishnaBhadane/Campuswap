import multer from 'multer';
import sharp from 'sharp';

const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };

export const uploadCollegeId = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter(req, file, done) {
    const allowed = formats[file.mimetype] && /\.(jpe?g|png|webp)$/i.test(file.originalname);
    done(allowed ? null : Object.assign(new Error('Use a JPG, PNG, or WebP image'), { status: 400 }), Boolean(allowed));
  }
}).single('collegeId');

export async function prepareCollegeId(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, message: 'College ID image is required' });
  try {
    const image = sharp(req.file.buffer, { limitInputPixels: 25000000 });
    const metadata = await image.metadata();
    if (metadata.format !== formats[req.file.mimetype] || (metadata.pages || 1) !== 1) throw new Error('Invalid image');
    req.file.buffer = await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
  } catch {
    return res.status(400).json({ success: false, message: 'College ID must be a valid, single-frame JPG, PNG, or WebP image' });
  }
  next();
}
