import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

import User from '../../database/models/User.js';
import Campus from '../../database/models/Campus.js';
import Listing from '../../database/models/Listing.js';
import Report from '../../database/models/Report.js';
import { createReport } from '../src/controllers/reportController.js';
import { setUserStatus } from '../src/controllers/adminController.js';
import { getListings, getListingById } from '../src/controllers/listingController.js';

test('Full Auto-block workflow with 5 distinct reporters, self-report, duplicate and campus isolation', async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await Report.init();

  const tag = randomUUID().slice(0, 8).toUpperCase();
  const campusCodeMain = 'CAMPUS-M-' + tag;
  const campusCodeForeign = 'CAMPUS-F-' + tag;

  const createdUserIds = [];
  const createdCampuses = [campusCodeMain, campusCodeForeign];

  try {
    // Create campuses
    const numBase = Math.floor(100000 + Math.random() * 400000);
    await Campus.create([
      { name: 'Main Campus', campusCode: campusCodeMain, officialCode: String(numBase) },
      { name: 'Foreign Campus', campusCode: campusCodeForeign, officialCode: String(numBase + 1) }
    ]);

    const pwHash = await argon2.hash('TestPass123!');

    // Create Seller S
    const seller = await User.create({
      name: 'Seller S',
      email: `seller-${tag}@example.com`,
      passwordHash: pwHash,
      phone: '9876543210',
      college: 'Main Campus',
      campusCode: campusCodeMain,
      role: 'student',
      status: 'active',
      emailVerified: true
    });
    createdUserIds.push(seller._id);

    // Create a listing by seller S
    const listing = await Listing.create({
      sellerId: seller._id,
      title: 'Listing by S',
      description: 'Test description',
      category: 'books',
      condition: 'good',
      pricePaise: 50000,
      college: 'Main Campus',
      campusCode: campusCodeMain,
      handoverLocation: 'Library',
      status: 'available',
      moderationStatus: 'visible',
      images: [{ url: 'https://example.com/test.jpg', publicId: 'test-id' }]
    });

    // Create 5 distinct campus students A, B, C, D, E
    const users = [];
    for (const name of ['User A', 'User B', 'User C', 'User D', 'User E']) {
      const u = await User.create({
        name,
        email: `${name.replace(' ', '').toLowerCase()}-${tag}@example.com`,
        passwordHash: pwHash,
        phone: '9876543211',
        college: 'Main Campus',
        campusCode: campusCodeMain,
        role: 'student',
        status: 'active',
        emailVerified: true
      });
      createdUserIds.push(u._id);
      users.push(u);
    }

    // Create Foreign User
    const foreignUser = await User.create({
      name: 'Foreign User',
      email: `foreign-${tag}@example.com`,
      passwordHash: pwHash,
      phone: '9876543212',
      college: 'Foreign Campus',
      campusCode: campusCodeForeign,
      role: 'student',
      status: 'active',
      emailVerified: true
    });
    createdUserIds.push(foreignUser._id);

    // Helper to call createReport
    async function callReport(user, targetType, targetId, reason = 'Scam / suspicious behavior') {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
      };
      await createReport({
        user: { _id: user._id, campusCode: user.campusCode, role: user.role },
        body: { targetType, targetId: targetId.toString(), reason, details: 'Testing' }
      }, res);
      return res;
    }

    // 1. Seller cannot report themselves
    const selfReport = await callReport(seller, 'user', seller._id);
    assert.equal(selfReport.statusCode, 400);

    // 2. Foreign-campus user cannot report seller in main campus
    const foreignReport = await callReport(foreignUser, 'user', seller._id);
    assert.equal(foreignReport.statusCode, 403);

    // 3. User A reports S -> seller remains active
    const resA = await callReport(users[0], 'user', seller._id);
    assert.equal(resA.statusCode, 201);
    let sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'active');
    assert.equal(sellerDoc.autoBlocked, false);

    // User A tries another report against S -> duplicate prevented (409)
    const resADup = await callReport(users[0], 'user', seller._id);
    assert.equal(resADup.statusCode, 409);

    // 4. User B reports S -> active
    const resB = await callReport(users[1], 'user', seller._id);
    assert.equal(resB.statusCode, 201);
    sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'active');

    // 5. User C reports S -> active
    const resC = await callReport(users[2], 'user', seller._id);
    assert.equal(resC.statusCode, 201);
    sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'active');

    // 6. User D reports S -> active
    const resD = await callReport(users[3], 'user', seller._id);
    assert.equal(resD.statusCode, 201);
    sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'active');

    // Listing should still be visible while seller is active
    const listingsActiveRes = {
      statusCode: 200,
      json(data) { this.body = data; return this; }
    };
    await getListings({ user: { _id: users[0]._id, college: 'Main Campus', campusCode: campusCodeMain }, query: {} }, listingsActiveRes);
    const foundActive = listingsActiveRes.body.listings.find(l => l._id.equals(listing._id));
    assert.ok(foundActive, 'Listing should be visible when seller is active');

    // 7. User E reports S -> 5 distinct authenticated reporters reached -> automatically blocked!
    const resE = await callReport(users[4], 'user', seller._id);
    assert.equal(resE.statusCode, 201);
    sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'blocked');
    assert.equal(sellerDoc.autoBlocked, true);

    // 8. Blocked seller effect: listings hidden from public marketplace
    const listingsBlockedRes = {
      statusCode: 200,
      json(data) { this.body = data; return this; }
    };
    await getListings({ user: { _id: users[0]._id, college: 'Main Campus', campusCode: campusCodeMain }, query: {} }, listingsBlockedRes);
    const foundBlocked = listingsBlockedRes.body.listings.find(l => l._id.equals(listing._id));
    assert.equal(foundBlocked, undefined, 'Listings from blocked seller must NOT appear in public marketplace');

    // Direct fetch of listing returns 403 unavailable
    const listingDirectRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    await getListingById({ params: { id: listing._id.toString() }, user: { campusCode: campusCodeMain } }, listingDirectRes);
    assert.equal(listingDirectRes.statusCode, 403);

    // 9. Admin unblocks seller
    const adminUnblockRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    await setUserStatus({
      params: { id: seller._id.toString() },
      campusFilter: { campusCode: campusCodeMain },
      body: { status: 'active' }
    }, adminUnblockRes);
    assert.equal(adminUnblockRes.statusCode, 200);

    sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'active');
    assert.equal(sellerDoc.autoBlocked, false);
    assert.ok(sellerDoc.unblockedAt, 'unblockedAt should be set');

    // After unblock, the 5 old reports do NOT re-trigger auto-blocking
    // A 6th user reports seller, but since only 1 report exists after unblockedAt, seller remains active!
    const userF = await User.create({
      name: 'User F',
      email: `userf-${tag}@example.com`,
      passwordHash: pwHash,
      phone: '9876543213',
      college: 'Main Campus',
      campusCode: campusCodeMain,
      role: 'student',
      status: 'active',
      emailVerified: true
    });
    createdUserIds.push(userF._id);

    const resF = await callReport(userF, 'user', seller._id);
    assert.equal(resF.statusCode, 201);
    sellerDoc = await User.findById(seller._id);
    assert.equal(sellerDoc.status, 'active', 'Old reports prior to unblockedAt must not re-block seller');
    assert.equal(sellerDoc.autoBlocked, false);

  } finally {
    await Report.deleteMany({ campusCode: { $in: createdCampuses } });
    await Listing.deleteMany({ campusCode: { $in: createdCampuses } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Campus.deleteMany({ campusCode: { $in: createdCampuses } });
    await mongoose.disconnect();
  }
});
