import mongoose from 'mongoose';
import Listing from '../../../database/models/Listing.js';
import { uploadProductImage, deleteProductImage } from '../utils/cloudinary.js';

export async function getListings(req, res) {
  // Return current user's listings if mine=true
  if (req.query.mine === 'true') {
    const myListings = await Listing.find({
      sellerId: req.user._id,
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, listings: myListings });
  }

  // Enforce campus isolation: college is derived strictly from the authenticated user
  const filter = {
    college: req.user.college,
    moderationStatus: 'visible',
    deletedAt: null,
    status: 'available'
  };

  const allowedCategories = ['books', 'electronics', 'stationery', 'hostel', 'cycles', 'other'];
  if (req.query.category && allowedCategories.includes(req.query.category)) {
    filter.category = req.query.category;
  }

  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    filter.title = { $regex: req.query.q.trim(), $options: 'i' };
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

  const listings = await Listing.find(filter)
    .populate('sellerId', 'name email phone college department year')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Listing.countDocuments(filter);

  res.json({
    success: true,
    college: req.user.college,
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
    moderationStatus: 'visible',
    deletedAt: null
  }).populate('sellerId', 'name email phone college department year').lean();

  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found' });
  }

  // Enforce campus isolation: students from other colleges cannot view this listing
  if (listing.college !== req.user.college && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'This listing is only available to students of ' + listing.college
    });
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

  const allowedCategories = ['books', 'electronics', 'stationery', 'hostel', 'cycles', 'other'];
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
    // SECURITY: college is ALWAYS taken from req.user.college, never trusted from req.body
    const listing = new Listing({
      sellerId: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      category,
      condition: normCondition,
      pricePaise: Math.round(numPrice * 100),
      college: req.user.college,
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

  const listing = await Listing.findOne({ _id: req.params.id, deletedAt: null });
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found' });
  }

  // SECURITY: Only the owner can edit
  if (listing.sellerId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the listing owner can edit this item' });
  }

  const { title, description, category, condition, price, handoverLocation, location, status } = req.body || {};

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
    const allowedCategories = ['books', 'electronics', 'stationery', 'hostel', 'cycles', 'other'];
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

  if (status !== undefined) {
    const allowedStatuses = ['available', 'reserved', 'sold'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be available, reserved, or sold' });
    }
    listing.status = status;
  }

  // Handle image updates if new files are uploaded
  if (req.files && req.files.length > 0) {
    const oldImages = [...listing.images];
    const newImages = [];
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

    // Delete replaced Cloudinary images to prevent orphan assets
    for (const oldImg of oldImages) {
      await deleteProductImage(oldImg.publicId);
    }
  }

  await listing.save();
  res.json({ success: true, listing });
}

export async function deleteListing(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  const listing = await Listing.findOne({ _id: req.params.id, deletedAt: null });
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found' });
  }

  // SECURITY: Only the owner can delete
  if (listing.sellerId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the listing owner can delete this item' });
  }

  // Clean associated Cloudinary images
  for (const img of listing.images || []) {
    await deleteProductImage(img.publicId);
  }

  listing.deletedAt = new Date();
  listing.images = [];
  await listing.save();

  res.json({ success: true, message: 'Listing deleted successfully' });
}
