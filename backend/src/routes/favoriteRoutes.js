import { Router } from 'express';
import { checkOrigin, requireAuth } from '../middleware/auth.js';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favoriteController.js';

const router = Router();

router.use(checkOrigin, requireAuth);

router.get('/', getFavorites);
router.put('/:listingId', addFavorite);
router.delete('/:listingId', removeFavorite);

export default router;
