import mongoose from 'mongoose';
import Listing from '../../../database/models/Listing.js';
import User from '../../../database/models/User.js';
import { uploadProductImage, deleteProductImage } from '../utils/cloudinary.js';

export async function getListings(req, res) {
  // Return current user's listings if mine=true
  if (req.query.mine === 'true') {
    const myListings = await Listing.find({
      sellerId: req.user._id,
      campusCode: req.user.campusCode,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, listings: myListings });
  }

  const blockedSellerIds = await User.find({ status: 'blocked', campusCode: req.user.campusCode }).distinct('_id');

  const filter = {
    campusCode: req.user.campusCode,
    moderationStatus: 'visible',
    deletedAt: null,
    status: 'available'
  };

  if (blockedSellerIds.length > 0) {
    filter.sellerId = { $nin: blockedSellerIds };
  }

  const allowedCategories = ['books', 'electronics', 'stationery', 'hostel', 'chairs and tables', 'chairs_and_tables', 'cycles', 'other'];
  if (req.query.category && allowedCategories.includes(req.query.category)) {
    filter.category = req.query.category;
  }

  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    if (req.query.q.length > 100) return res.status(400).json({ message: 'Search must be at most 100 characters' });
    filter.title = { $regex: req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

  const listings = await Listing.find(filter)
    .populate('sellerId', 'name college department year')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Listing.countDocuments(filter);

  res.json({
    success: true,
    college: req.user.college,
    campusCode: req.user.campusCode,
    listings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

export async function getListingById(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  const listing = await Listing.findOne({
    _id: req.params.id,
    campusCode: req.user.campusCode,
    moderationStatus: 'visible',
    deletedAt: null
  }).populate('sellerId', 'name email phone college department year status').lean();

  if (!listing || listing.sellerId?.status === 'blocked') {
    const exists = await Listing.exists({ _id: req.params.id, moderationStatus: 'visible', deletedAt: null });
    return res.status(exists ? 403 : 404).json({ success: false, message: exists ? 'Listing is unavailable' : 'Listing not found' });
  }

  res.json({ success: true, listing });
}

export async function createListing(req, res) {
  const { title, description, category, condition, price, handoverLocation, location, brand, semester } = req.body || {};

  // Image limit verification: minimum 1, maximum 2
  if (!req.files || req.files.length < 1 || req.files.length > 2) {
    return res.status(400).json({ success: false, message: 'Provide 1 or 2 product images' });
  }

  if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
    return res.status(400).json({ success: false, message: 'Title is required (max 150 characters)' });
  }

  const allowedCategories = ['books', 'electronics', 'stationery', 'hostel', 'chairs and tables', 'chairs_and_tables', 'cycles', 'other'];
  if (!category || !allowedCategories.includes(category)) {
    return res.status(400).json({ success: false, message: 'Valid category is required' });
  }

  const normCondition = condition === 'brand-new' ? 'new' : condition;
  const allowedConditions = ['new', 'like-new', 'good', 'fair'];
  if (!normCondition || !allowedConditions.includes(normCondition)) {
    return res.status(400).json({ success: false, message: 'Valid condition is required' });
  }

  const numPrice = Number(price);
  if (Number.isNaN(numPrice) || numPrice < 0) {
    return res.status(400).json({ success: false, message: 'Valid non-negative price is required' });
  }

  const finalLocation = (handoverLocation || location || req.user.college).trim();
  if (!finalLocation || finalLocation.length > 200) {
    return res.status(400).json({ success: false, message: 'Handover location is required (max 200 characters)' });
  }

  // Upload processed images (max 2) to Cloudinary
  const uploadedImages = [];
  try {
    for (const file of req.files) {
      const uploaded = await uploadProductImage(file.buffer);
      uploadedImages.push(uploaded);
    }
  } catch (error) {
    for (const img of uploadedImages) await deleteProductImage(img.publicId);
    return res.status(502).json({ success: false, message: 'Product image upload failed' });
  }

  try {
    const listing = new Listing({
      sellerId: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      category,
      condition: normCondition,
      pricePaise: Math.round(numPrice * 100),
      college: req.user.college,
      campusCode: req.user.campusCode,
      handoverLocation: finalLocation,
      images: uploadedImages,
      brand: brand ? String(brand).trim() : undefined,
      semester: semester ? Number(semester) : undefined
    });

    await listing.save();
    res.status(201).json({ success: true, listing });
  } catch (dbError) {
    for (const img of uploadedImages) await deleteProductImage(img.publicId);
    throw dbError;
  }
}

export async function updateListing(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  const listing = await Listing.findOne({ _id: req.params.id, campusCode: req.user.campusCode, deletedAt: null });
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found' });
  }

  // SECURITY: Only the owner can edit
  if (listing.sellerId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the listing owner can edit this item' });
  }

  // Manual mark as sold by seller
  if (req.body && req.body.status !== undefined) {
    if (req.body.status !== 'sold') {
      return res.status(400).json({ success: false, message: 'Listing status can only be manually marked as sold' });
    }
    const updated = await Listing.findOneAndUpdate(
      { _id: listing._id, sellerId: req.user._id, campusCode: req.user.campusCode, deletedAt: null, status: 'available' },
      { $set: { status: 'sold' }, $inc: { __v: 1 } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Listing is already sold or unavailable' });
    }
    return res.json({ success: true, listing: updated });
  }

  if (listing.status !== 'available') return res.status(409).json({ message: 'Sold listings cannot be edited' });

  const { title, description, category, condition, price, handoverLocation, location } = req.body || {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
      return res.status(400).json({ success: false, message: 'Title must be 1 to 150 characters' });
    }
    listing.title = title.trim();
  }

  if (description !== undefined) {
    listing.description = typeof description === 'string' ? description.trim().slice(0, 3000) : '';
  }

  if (category !== undefined) {
    const allowedCategories = ['books', 'electronics', 'stationery', 'hostel', 'chairs and tables', 'chairs_and_tables', 'cycles', 'other'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    listing.category = category;
  }

  if (condition !== undefined) {
    const norm = condition === 'brand-new' ? 'new' : condition;
    const allowedConditions = ['new', 'like-new', 'good', 'fair'];
    if (!allowedConditions.includes(norm)) {
      return res.status(400).json({ success: false, message: 'Invalid condition' });
    }
    listing.condition = norm;
  }

  if (price !== undefined) {
    const numPrice = Number(price);
    if (Number.isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number' });
    }
    listing.pricePaise = Math.round(numPrice * 100);
  }

  if (handoverLocation !== undefined || location !== undefined) {
    const loc = (handoverLocation || location || '').trim();
    if (!loc || loc.length > 200) {
      return res.status(400).json({ success: false, message: 'Handover location must be 1 to 200 characters' });
    }
    listing.handoverLocation = loc;
  }

  // Handle image updates if new files are uploaded
  const oldImages = [...listing.images];
  const newImages = [];
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const uploaded = await uploadProductImage(file.buffer);
        newImages.push(uploaded);
      }
      listing.images = newImages;
    } catch {
      for (const img of newImages) await deleteProductImage(img.publicId);
      return res.status(502).json({ success: false, message: 'Image upload failed' });
    }
  }

  try {
    await listing.save();
  } catch (error) {
    for (const image of newImages) await deleteProductImage(image.publicId);
    throw error;
  }
  if (newImages.length) for (const image of oldImages) await deleteProductImage(image.publicId);
  res.json({ success: true, listing });
}

export async function deleteListing(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  const listing = await Listing.findOne({ _id: req.params.id, campusCode: req.user.campusCode, deletedAt: null });
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found' });
  }

  // SECURITY: Only the owner can delete
  if (listing.sellerId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the listing owner can delete this item' });
  }

  const removed = await Listing.findOneAndUpdate(
    { _id: listing._id, sellerId: req.user._id, campusCode: req.user.campusCode, deletedAt: null, status: 'available' },
    { $set: { deletedAt: new Date(), images: [] }, $inc: { __v: 1 } }
  );
  if (!removed) return res.status(409).json({ success: false, message: 'Only available listings can be deleted' });
  for (const image of listing.images || []) await deleteProductImage(image.publicId);
  res.json({ success: true, message: 'Listing deleted successfully' });
}
