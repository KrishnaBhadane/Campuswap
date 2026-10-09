import { Router } from 'express';
import { checkOrigin, requireAuth, requireRole } from '../middleware/auth.js';
import { uploadListingImages, prepareListingImages } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { getListings, getListingById, createListing, updateListing, deleteListing } from '../controllers/listingController.js';
import Campus from '../../../database/models/Campus.js';

const router = Router();

router.use(checkOrigin, requireAuth, async (req, res, next) => {
  const campus = req.user.campusCode ? await Campus.findOne({ campusCode: req.user.campusCode }).lean() : null;
  if (!campus) return res.status(403).json({ success: false, message: 'Your account has no recognized campus. Contact an admin.' });
  req.user.college = campus.name;
  next();
});
router.get('/', getListings);
router.get('/:id', getListingById);
router.post('/', requireRole('student'), uploadLimiter, uploadListingImages, prepareListingImages, createListing);
router.patch('/:id', requireRole('student'), uploadLimiter, uploadListingImages, prepareListingImages, updateListing);
router.delete('/:id', requireRole('student'), deleteListing);

export default router;
