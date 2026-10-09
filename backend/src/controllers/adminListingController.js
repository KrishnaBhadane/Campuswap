import mongoose from 'mongoose';
import Listing from '../../../database/models/Listing.js';

export async function adminListings(req, res) {
  const listings = await Listing.find({ ...req.campusFilter, deletedAt: null })
    .select('title description sellerId college campusCode pricePaise status moderationStatus images createdAt')
    .populate('sellerId', 'name').sort({ createdAt: -1, _id: -1 }).skip((req.adminPage - 1) * 12).limit(13).lean();
  res.json({ listings: listings.slice(0, 12), pagination: { page: req.adminPage, hasMore: listings.length > 12 } });
}

export async function moderateListing(req, res) {
  const { moderationStatus } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !['visible', 'hidden'].includes(moderationStatus)) {
    return res.status(400).json({ message: 'Use visible or hidden' });
  }
  const listing = await Listing.findOneAndUpdate({ _id: req.params.id, ...req.campusFilter, deletedAt: null },
    { moderationStatus }, { returnDocument: 'after' }).select('_id moderationStatus');
  if (!listing) return res.status(404).json({ message: 'Listing not found in selected campus' });
  res.json({ listing });
}
