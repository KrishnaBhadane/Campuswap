import mongoose from 'mongoose';
import connectDB from './db.js';
import User from './models/User.js';
import Listing from './models/Listing.js';
import Campus from './models/Campus.js';
import initCampuses from './initCampuses.js';

// Run once per database: node --env-file=backend/.env database/migrateCampuses.js
try {
  await connectDB();
  await initCampuses();
  for (const campus of await Campus.find().lean()) {
    const filter = { college: campus.name, campusCode: { $in: [null, ''] } };
    const update = { $set: { campusCode: campus.campusCode } };
    const users = await User.collection.updateMany(filter, update, { collation: { locale: 'simple' } });
    const listings = await Listing.collection.updateMany(filter, update, { collation: { locale: 'simple' } });
    console.log(`${campus.campusCode}: ${users.modifiedCount} users, ${listings.modifiedCount} listings mapped`);
  }
  await Listing.init();
  const oldIndex = (await Listing.collection.indexes()).find(index =>
    JSON.stringify(index.key) === JSON.stringify({ college: 1, moderationStatus: 1, deletedAt: 1, status: 1, createdAt: -1 }));
  if (oldIndex) await Listing.collection.dropIndex(oldIndex.name);
} catch {
  console.error('Campus backfill failed; check MongoDB access. It is safe to rerun.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
