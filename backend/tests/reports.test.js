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

// Opt-in live integration test. Every temporary record is removed in finally.
test('Reports and moderation', { skip: process.env.RUN_REPORT_TESTS !== '1', timeout: 90000 }, async t => {
  const tag = randomUUID().slice(0, 8).toUpperCase(), codes = ['REPORTA-' + tag, 'REPORTB-' + tag], emails = [], password = randomUUID() + 'A1!';
  let server, base, reporter, seller, foreign, admin, unverified, item;
  async function call(path, method = 'GET', body, user, origin) {
    const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(user ? { cookie: user.cookie } : {}), ...(origin ? { origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  function check(result, status) { assert.equal(result.status, status, result.data.message); return result.data; }
  const report = (type, id, user = reporter) => call('/api/reports', 'POST', { targetType: type, targetId: id, reason: 'Please review this campus item', campusCode: codes[1], status: 'resolved', reporterId: seller.id }, user);
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 }); await Report.init();
    for (let i = 0; i < codes.length; i++) await Campus.create({ name: 'Temporary report campus', campusCode: codes[i], officialCode: String(parseInt(tag, 16) * 2 + i) });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
    const hash = await argon2.hash(password), users = [];
    for (const label of ['reporter', 'seller', 'foreign', 'admin', 'unverified']) {
      const email = `report-${tag}-${label}@example.com`; emails.push(email);
      const user = await User.create({ name: label, email, passwordHash: hash, phone: '9999999999', college: 'Temporary report campus', campusCode: label === 'foreign' ? codes[1] : codes[0], role: label === 'admin' ? 'admin' : 'student', emailVerified: true, verificationAssetId: 'private-test-identifier' });
      const login = await call('/api/auth/login', 'POST', { email, password }); check(login, 200); users.push({ id: user.id, email, cookie: login.cookie });
    }
    [reporter, seller, foreign, admin, unverified] = users;
    await User.updateOne({ _id: unverified.id }, { emailVerified: false });
    item = await Listing.create({ sellerId: seller.id, title: 'Temporary report item', campusCode: codes[0], college: 'Temporary report campus', category: 'books', condition: 'good', pricePaise: 5000, handoverLocation: 'Campus gate', images: [{ publicId: 'report-private-image-id', url: 'https://example.com/report-test.png' }] });
    let listingReport, userReport;
    await t.test('authentication, target validation, own and cross-campus restrictions', async () => {
      check(await report('listing', item.id, null), 401); check(await report('listing', item.id, unverified), 403); check(await report('listing', item.id, admin), 403);
      check(await report('listing', item.id, seller), 400); check(await report('user', reporter.id), 400);
      check(await report('listing', item.id, foreign), 403); check(await report('user', seller.id, foreign), 403); check(await report('user', admin.id), 404);
      check(await report('other', item.id), 400); check(await report('listing', { $ne: null }), 400);
      check(await call('/api/reports', 'POST', { targetType: 'listing', targetId: item.id, reason: '  ' }, reporter), 400);
      check(await call('/api/reports', 'POST', { targetType: 'listing', targetId: item.id, reason: 'x'.repeat(1001) }, reporter), 400);
      check(await call('/api/reports', 'POST', { targetType: 'listing', targetId: item.id, reason: 'Test reason' }, reporter, 'https://untrusted.example'), 403);
      check(await call('/api/admin/reports', 'GET', null, reporter), 403);
    });
    await t.test('concurrent duplicate reports, trusted identity/campus, safe populated targets', async () => {
      const results = await Promise.all([report('listing', item.id), report('listing', item.id)]);
      assert.deepEqual(results.map(result => result.status).sort(), [201, 409]); listingReport = results.find(result => result.status === 201).data.report;
      userReport = check(await report('user', seller.id), 201).report;
      const saved = await Report.findById(listingReport._id); assert.equal(saved.campusCode, codes[0]); assert(saved.reporterId.equals(reporter.id)); assert.equal(saved.status, 'open');
      const data = check(await call('/api/admin/reports?campusCode=' + codes[0], 'GET', null, admin), 200);
      assert.equal(data.reports.length, 2); assert.equal(data.reports.find(report => report.targetType === 'listing').targetId.title, item.title); assert.equal(data.reports.find(report => report.targetType === 'user').targetId.name, 'seller');
      for (const privateField of ['passwordHash', 'verificationAssetId', 'private-test-identifier', 'publicId']) assert(!JSON.stringify(data).includes(privateField));
      assert.equal(check(await call('/api/admin/reports?campusCode=' + codes[1], 'GET', null, admin), 200).reports.length, 0);
      const dashboard = check(await call('/api/admin/dashboard?campusCode=' + codes[0], 'GET', null, admin), 200); assert.equal(dashboard.counts.openReports, 2); assert.equal(dashboard.recentReports.length, 2);
    });
    await t.test('resolve/dismiss authorization, campus scope, atomic review and audit', async () => {
      const path = '/api/admin/reports/' + listingReport._id;
      check(await call(path, 'PATCH', { status: 'resolved' }, reporter), 403);
      check(await call(path + '?campusCode=' + codes[1], 'PATCH', { status: 'resolved' }, admin), 409);
      check(await call(path, 'PATCH', { status: 'open' }, admin), 400);
      const results = await Promise.all([call(path, 'PATCH', { status: 'resolved', resolutionNote: 'Reviewed by test admin', reviewedBy: reporter.id }, admin), call(path, 'PATCH', { status: 'dismissed' }, admin)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]); assert((await Report.findById(listingReport._id)).reviewedBy.equals(admin.id));
      check(await call('/api/admin/reports/' + userReport._id, 'PATCH', { status: 'dismissed', resolutionNote: 'No action needed' }, admin), 200);
      check(await call(path, 'PATCH', { status: 'resolved' }, admin), 409);
      assert.equal(check(await call('/api/admin/dashboard?campusCode=' + codes[0], 'GET', null, admin), 200).counts.openReports, 0);
    });
    await t.test('existing hide/restore and block/unblock enforce campus and sessions', async () => {
      check(await call('/api/admin/listings/' + item.id + '?campusCode=' + codes[1], 'PATCH', { moderationStatus: 'hidden' }, admin), 404);
      check(await call('/api/admin/listings/' + item.id + '?campusCode=' + codes[0], 'PATCH', { moderationStatus: 'hidden' }, admin), 200);
      check(await call('/api/listings/' + item.id, 'GET', null, reporter), 404); check(await report('listing', item.id), 404);
      check(await call('/api/admin/listings/' + item.id, 'PATCH', { moderationStatus: 'visible' }, admin), 200);
      check(await call('/api/listings/' + item.id, 'GET', null, reporter), 200);
      check(await call('/api/admin/users/' + seller.id + '/status?campusCode=' + codes[1], 'PATCH', { status: 'blocked' }, admin), 404);
      check(await call('/api/admin/users/' + seller.id + '/status', 'PATCH', { status: 'blocked' }, admin), 200); check(await call('/api/auth/me', 'GET', null, seller), 401);
      check(await call('/api/admin/users/' + seller.id + '/status', 'PATCH', { status: 'active' }, admin), 200); check(await call('/api/auth/me', 'GET', null, seller), 401);
      check(await call('/api/auth/login', 'POST', { email: seller.email, password }), 200);
    });
    await t.test('filters, pagination and missing target remain reviewable', async () => {
      for (const query of ['status=bad', 'page=-1', 'status[$ne]=open']) check(await call('/api/admin/reports?' + query, 'GET', null, admin), 400);
      await Report.insertMany(Array.from({ length: 14 }, () => ({ reporterId: reporter.id, targetType: 'listing', targetId: item._id, campusCode: codes[0], reason: 'Temporary pagination record', status: 'dismissed' })));
      const first = check(await call('/api/admin/reports?status=all&campusCode=' + codes[0], 'GET', null, admin), 200), second = check(await call('/api/admin/reports?status=all&page=2&campusCode=' + codes[0], 'GET', null, admin), 200);
      assert.equal(first.reports.length, 12); assert.equal(first.pagination.hasMore, true); assert.equal(second.reports.length, 4);
      const reopened = check(await report('listing', item.id), 201).report; await Listing.deleteOne({ _id: item._id });
      const missing = check(await call('/api/admin/reports?campusCode=' + codes[0], 'GET', null, admin), 200); assert.equal(missing.reports[0].targetId, null);
      check(await call('/api/admin/reports/' + reopened._id, 'PATCH', { status: 'resolved' }, admin), 200);
    });
  } finally {
    if (mongoose.connection.readyState) { await Report.deleteMany({ campusCode: { $in: codes } }); await Listing.deleteMany({ campusCode: { $in: codes } }); await User.deleteMany({ email: { $in: emails } }); await Campus.deleteMany({ campusCode: { $in: codes } }); }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await mongoose.disconnect();
  }
});
