import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import app from '../src/app.js';
import User from '../../database/models/User.js';
import Campus from '../../database/models/Campus.js';
import Listing from '../../database/models/Listing.js';
import Report from '../../database/models/Report.js';

test('Sold flow and Contact Admin support', { skip: process.env.RUN_SOLD_SUPPORT_TESTS !== '1', timeout: 90000 }, async t => {
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const campusCode = 'TEST-' + tag;
  const password = 'Password123!';
  let server, base, seller, buyer, foreignStudent, admin, listing;

  async function call(path, method = 'GET', body, user) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(user?.cookie ? { cookie: user.cookie } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await Campus.create({ name: 'Test Campus', campusCode, officialCode: String(parseInt(tag, 16) * 2) });
    await Campus.create({ name: 'Other Campus', campusCode: 'OTHER-' + tag, officialCode: String(parseInt(tag, 16) * 2 + 1) });

    server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;

    const hash = await argon2.hash(password);
    async function makeUser(name, role = 'student', cCode = campusCode) {
      const email = `${name}-${tag}@example.com`;
      const u = await User.create({
        name,
        email,
        passwordHash: hash,
        phone: '9876543210',
        college: 'Test Campus',
        campusCode: cCode,
        role,
        emailVerified: true
      });
      const loginRes = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
      return { id: u.id, email, cookie };
    }

    seller = await makeUser('seller');
    buyer = await makeUser('buyer');
    foreignStudent = await makeUser('foreign', 'student', 'OTHER-' + tag);
    admin = await makeUser('admin', 'admin');

    listing = await Listing.create({
      sellerId: seller.id,
      title: 'Course Textbook',
      campusCode,
      college: 'Test Campus',
      category: 'books',
      condition: 'good',
      pricePaise: 40000,
      handoverLocation: 'Library',
      status: 'available',
      moderationStatus: 'visible',
      images: [{ publicId: 'img1', url: 'https://example.com/book.png' }]
    });

    await t.test('Contact Admin / Support message creation and moderation', async () => {
      // 1. Unauthenticated cannot send support
      const unauth = await call('/api/reports', 'POST', { targetType: 'support', reason: 'Need help' });
      assert.equal(unauth.status, 401);

      // 2. Reason too short
      const short = await call('/api/reports', 'POST', { targetType: 'support', reason: 'hi' }, buyer);
      assert.equal(short.status, 400);

      // 3. Valid support message
      const res = await call('/api/reports', 'POST', { targetType: 'support', reason: 'Account help', details: 'Cannot change phone number', reporterId: seller.id, campusCode: 'OTHER-' + tag }, buyer);
      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      const reportId = res.data.report._id;

      // 4. Duplicate open support request from same user is prevented (409)
      const dup = await call('/api/reports', 'POST', { targetType: 'support', reason: 'Another message while first is open' }, buyer);
      assert.equal(dup.status, 409);

      // 5. Admin sees support request
      const adminReports = await call('/api/admin/reports?campusCode=' + campusCode, 'GET', null, admin);
      assert.equal(adminReports.status, 200);
      const found = adminReports.data.reports.find(r => r._id === reportId);
      assert.ok(found);
      assert.equal(found.targetType, 'support');
      assert.equal(found.status, 'open');
      assert.equal(found.details, 'Cannot change phone number'); assert.equal(found.reporterId._id, buyer.id);
      assert.equal((await call('/api/reports', 'POST', { targetType: 'support', reason: 'Other', details: {} }, buyer)).status, 400);
      const other = await call('/api/admin/reports?campusCode=OTHER-' + tag, 'GET', null, admin);
      assert(!other.data.reports.some(report => report._id === reportId));

      // 6. Admin resolves support request
      const resolve = await call('/api/admin/reports/' + reportId + '?campusCode=' + campusCode, 'PATCH', { status: 'resolved', resolutionNote: 'Assisted student' }, admin);
      assert.equal(resolve.status, 200);
      assert.equal(resolve.data.report.status, 'resolved');
    });

    await t.test('Manual Mark Sold flow and permissions', async () => {
      // 1. Non-seller student cannot mark someone else's item as sold (403)
      const forbidden = await call('/api/listings/' + listing.id, 'PATCH', { status: 'sold' }, buyer);
      assert.equal(forbidden.status, 403);

      // 2. Cross-campus user cannot edit or mark sold (404)
      const foreignRes = await call('/api/listings/' + listing.id, 'PATCH', { status: 'sold' }, foreignStudent);
      assert.equal(foreignRes.status, 404);

      // 3. Invalid status value rejected (400)
      const invalidStatus = await call('/api/listings/' + listing.id, 'PATCH', { status: 'pending' }, seller);
      assert.equal(invalidStatus.status, 400);

      // 4. Seller marks listing as sold
      const soldRes = await call('/api/listings/' + listing.id, 'PATCH', { status: 'sold' }, seller);
      assert.equal(soldRes.status, 200);
      assert.equal(soldRes.data.success, true);
      assert.equal(soldRes.data.listing.status, 'sold');

      // 5. Already sold listing returns conflict (409)
      const alreadySold = await call('/api/listings/' + listing.id, 'PATCH', { status: 'sold' }, seller);
      assert.equal(alreadySold.status, 409);

      // 6. Sold listing is removed from marketplace browse/search
      const marketplace = await call('/api/listings', 'GET', null, buyer);
      assert.equal(marketplace.status, 200);
      const inMarketplace = marketplace.data.listings.some(l => l._id === listing.id);
      assert.equal(inMarketplace, false, 'Sold item must not appear in marketplace browse');

      // 7. Sold listing still visible in seller My Listings
      const myListings = await call('/api/listings?mine=true', 'GET', null, seller);
      assert.equal(myListings.status, 200);
      const inMine = myListings.data.listings.find(l => l._id === listing.id);
      assert.ok(inMine, 'Sold item must remain visible in seller My Listings');
      assert.equal(inMine.status, 'sold');

      // 8. Sold listing can still be viewed directly
      const direct = await call('/api/listings/' + listing.id, 'GET', null, buyer);
      assert.equal(direct.status, 200);
      assert.equal(direct.data.listing.status, 'sold');
    });
  } finally {
    if (mongoose.connection.readyState) {
      await Report.deleteMany({ campusCode: { $in: [campusCode, 'OTHER-' + tag] } });
      await Listing.deleteMany({ campusCode: { $in: [campusCode, 'OTHER-' + tag] } });
      await User.deleteMany({ campusCode: { $in: [campusCode, 'OTHER-' + tag] } });
      await Campus.deleteMany({ campusCode: { $in: [campusCode, 'OTHER-' + tag] } });
      await mongoose.disconnect();
    }
    if (server) {
      server.closeAllConnections();
      await new Promise(r => server.close(r));
    }
  }
});
