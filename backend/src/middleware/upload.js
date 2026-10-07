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

const listingMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter(req, file, done) {
    const allowed = formats[file.mimetype] && /\.(jpe?g|png|webp)$/i.test(file.originalname);
    done(allowed ? null : Object.assign(new Error('Use a JPG, PNG, or WebP image'), { status: 400 }), Boolean(allowed));
  }
});

export const uploadListingImages = (req, res, next) => {
  listingMulter.array('images', 2)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_MAX_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Maximum 2 images allowed' });
      }
      return res.status(err.status || 400).json({ success: false, message: err.message || 'Image upload error' });
    }
    next();
  });
};

export async function prepareListingImages(req, res, next) {
  if (!req.files || req.files.length === 0) {
    if (req.method === 'PATCH') return next();
    return res.status(400).json({ success: false, message: 'Provide 1 or 2 product images' });
  }
  if (req.files.length > 2) {
    return res.status(400).json({ success: false, message: 'Maximum 2 images allowed' });
  }
  try {
    for (const file of req.files) {
      const image = sharp(file.buffer, { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (!formats[file.mimetype] || metadata.format !== formats[file.mimetype] || (metadata.pages || 1) !== 1) {
        throw new Error('Invalid image');
      }
      file.buffer = await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }).toBuffer();
    }
  } catch {
    return res.status(400).json({ success: false, message: 'Images must be valid, single-frame JPG, PNG, or WebP files' });
  }
  next();
}
