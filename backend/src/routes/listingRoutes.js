import { Router } from 'express';
import { checkOrigin, requireAuth, requireRole } from '../middleware/auth.js';
import { uploadListingImages, prepareListingImages } from '../middleware/upload.js';
import { getListings, getListingById, createListing, updateListing, deleteListing } from '../controllers/listingController.js';

const router = Router();

router.get('/', checkOrigin, requireAuth, getListings);
router.get('/:id', checkOrigin, requireAuth, getListingById);
router.post('/', checkOrigin, requireAuth, requireRole('student'), uploadListingImages, prepareListingImages, createListing);
router.patch('/:id', checkOrigin, requireAuth, requireRole('student'), uploadListingImages, prepareListingImages, updateListing);
router.delete('/:id', checkOrigin, requireAuth, requireRole('student'), deleteListing);

export default router;
