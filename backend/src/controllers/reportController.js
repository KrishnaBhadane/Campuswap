import mongoose from 'mongoose';
import Report from '../../../database/models/Report.js';
import Listing from '../../../database/models/Listing.js';
import User from '../../../database/models/User.js';
import Campus from '../../../database/models/Campus.js';

export async function createReport(req, res) {
  const { targetType, targetId, reason, details = '' } = req.body || {};
  if (!['listing', 'user', 'support'].includes(targetType) ||
      (targetType !== 'support' && !mongoose.isObjectIdOrHexString(targetId)) ||
      typeof details !== 'string' || details.trim().length > 1000 ||
      typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 1000) {
    return res.status(400).json({ message: 'Choose a valid report or support type and provide a reason of 5 to 1000 characters' });
  }
  if (!req.user.campusCode || !await Campus.exists({ campusCode: req.user.campusCode })) return res.status(403).json({ message: 'A recognized campus is required' });

  if (targetType === 'support') {
    try {
      const report = await Report.create({ reporterId: req.user._id, targetType: 'support', reason: reason.trim(), details: details.trim(), campusCode: req.user.campusCode });
      return res.status(201).json({ success: true, report: { _id: report._id, status: report.status }, message: 'Support message sent to admin' });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'You already have an open support request' });
      throw error;
    }
  }

  const target = targetType === 'listing'
    ? await Listing.findOne({ _id: targetId, deletedAt: null, moderationStatus: 'visible' }).select('campusCode sellerId').lean()
    : await User.findOne({ _id: targetId, role: 'student' }).select('campusCode status unblockedAt autoBlocked').lean();
  if (!target) return res.status(404).json({ message: 'Report target not found' });
  if (target.campusCode !== req.user.campusCode) return res.status(403).json({ message: 'You can only report within your campus' });
  if ((targetType === 'user' ? target._id : target.sellerId).equals(req.user._id)) return res.status(400).json({ message: 'You cannot report yourself or your own listing' });
  try {
    const report = await Report.create({ reporterId: req.user._id, targetType, targetId, reason: reason.trim(), details: details.trim(), campusCode: target.campusCode });

    if (targetType === 'user') {
      const reportFilter = {
        targetType: 'user',
        targetId: target._id,
        status: 'open'
      };
      if (target.unblockedAt) {
        reportFilter.createdAt = { $gt: target.unblockedAt };
      }
      const distinctReporters = await Report.distinct('reporterId', reportFilter);
      if (distinctReporters.length >= 5) {
        await User.updateOne(
          { _id: target._id, status: 'active' },
          { $set: { status: 'blocked', autoBlocked: true }, $inc: { authVersion: 1 } }
        );
      }
    }

    res.status(201).json({ success: true, report: { _id: report._id, status: report.status }, message: 'Report submitted for admin review' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'You already have an open report for this target' });
    throw error;
  }
}

export async function getReports(req, res) {
  const { status = 'open' } = req.query;
  if (!['open', 'resolved', 'dismissed', 'all'].includes(status) || Object.keys(req.query).some(key => !['status', 'campusCode', 'page'].includes(key))) {
    return res.status(400).json({ message: 'Invalid report filter' });
  }
  const filter = { ...req.campusFilter };
  if (status !== 'all') filter.status = status;
  const reports = await Report.find(filter).select('-__v')
    .populate('reporterId', 'name email').populate('reviewedBy', 'name')
    .populate('targetId', 'title name status autoBlocked moderationStatus campusCode images.url description deletedAt')
    .sort({ createdAt: -1, _id: -1 }).skip((req.adminPage - 1) * 12).limit(13).lean();
  res.set('Cache-Control', 'no-store').json({ reports: reports.slice(0, 12), pagination: { page: req.adminPage, hasMore: reports.length > 12 } });
}

export async function reviewReport(req, res) {
  const { status, resolutionNote = '' } = req.body || {};
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !['resolved', 'dismissed'].includes(status) ||
      typeof resolutionNote !== 'string' || resolutionNote.trim().length > 1000) {
    return res.status(400).json({ message: 'Use resolved or dismissed with a note up to 1000 characters' });
  }
  const report = await Report.findOneAndUpdate({ _id: req.params.id, ...req.campusFilter, status: 'open' },
    { $set: { status, resolutionNote: resolutionNote.trim(), reviewedBy: req.user._id } }, { returnDocument: 'after', runValidators: true }).select('_id status resolutionNote reviewedBy updatedAt');
  if (!report) return res.status(409).json({ message: 'No open report found in this campus. Refresh reports.' });
  res.json({ success: true, report });
}
