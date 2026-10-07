import mongoose from 'mongoose';
import Favorite from '../../../database/models/Favorite.js';
import Listing from '../../../database/models/Listing.js';

export async function getFavorites(req, res) {
  const favorites = await Favorite.find({ userId: req.user._id })
    .populate({
      path: 'listingId',
      match: { moderationStatus: 'visible', deletedAt: null, college: req.user.college },
      select: '_id title pricePaise condition status images college handoverLocation'
    })
    .sort({ createdAt: -1 })
    .lean();

  // Return card-ready data in one single request, excluding deleted/hidden/foreign-campus items
  const validFavorites = favorites
    .filter(f => f.listingId != null)
    .map(f => ({
      favoriteId: f._id,
      listing: f.listingId,
      createdAt: f.createdAt
    }));

  const favoriteIds = validFavorites.map(f => f.listing._id.toString());

  res.json({
    success: true,
    favorites: validFavorites,
    favoriteIds
  });
}

export async function addFavorite(req, res) {
  const { listingId } = req.params;
  if (!mongoose.isObjectIdOrHexString(listingId)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  // Ensure listing exists, is visible, and is not deleted
  const listing = await Listing.findOne({
    _id: listingId,
    moderationStatus: 'visible',
    deletedAt: null
  }).select('_id college').lean();

  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found or no longer available' });
  }

  // CAMPUS SECURITY: User can only save listings from their own college campus
  if (listing.college !== req.user.college) {
    return res.status(403).json({
      success: false,
      message: 'You can only save listings from ' + req.user.college
    });
  }

  // Upsert to prevent duplicate records
  await Favorite.findOneAndUpdate(
    { userId: req.user._id, listingId: listing._id },
    { userId: req.user._id, listingId: listing._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    success: true,
    message: 'Listing saved to favorites',
    listingId: listing._id
  });
}

export async function removeFavorite(req, res) {
  const { listingId } = req.params;
  if (!mongoose.isObjectIdOrHexString(listingId)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  await Favorite.findOneAndDelete({
    userId: req.user._id,
    listingId
  });

  res.json({
    success: true,
    message: 'Listing removed from favorites',
    listingId
  });
}
