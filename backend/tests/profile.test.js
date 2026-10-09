import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import app from '../src/app.js';
import User from '../../database/models/User.js';
import Campus from '../../database/models/Campus.js';

test('Profile permissions, persistence and frontend paths', { skip: process.env.RUN_PROFILE_TESTS !== '1', timeout: 90000 }, async t => {
  const tag = randomUUID().slice(0, 8).toUpperCase(), campusCode = 'PROFILE-' + tag, email = `profile-${tag}@example.com`, password = randomUUID();
  let server, base, cookie;
  async function call(method = 'GET', body, authenticated = true) {
    const response = await fetch(base + '/api/users/me', { method, headers: { 'Content-Type': 'application/json', ...(authenticated && cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await Campus.create({ campusCode, name: 'Temporary profile campus', officialCode: String(parseInt(tag, 16)) });
    await User.create({ name: 'Profile test', email, passwordHash: await argon2.hash(password), phone: '9999999999', campusCode, college: 'Temporary profile campus', emailVerified: true, verificationStatus: 'rejected', verificationReason: 'ID unclear', verificationAssetId: 'private-test-only' });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0];
    await t.test('safe status and authenticated access', async () => {
      assert.equal((await call('GET', undefined, false)).status, 401);
      const result = await call(); assert.equal(result.status, 200); assert.equal(result.data.user.hasCollegeId, true); assert.equal(result.data.user.emailVerified, true); assert.equal(result.data.user.verificationReason, 'ID unclear');
      for (const field of ['passwordHash', 'verificationAssetId', 'emailOtpHash', 'private-test-only']) assert(!JSON.stringify(result.data).includes(field));
    });
    await t.test('persist allowed edits and reject privilege/campus changes', async () => {
      assert.equal((await call('PATCH', { name: ' Updated name ', phone: '9999999998', department: 'Computer Engineering', year: 3 })).status, 200);
      const stored = await User.findOne({ email }); assert.equal(stored.name, 'Updated name'); assert.equal(stored.year, 3); assert.equal(stored.campusCode, campusCode);
      for (const body of [{ role: 'admin' }, { campusCode: 'SVKMCOE-5545' }, { emailVerified: true }, { verificationStatus: 'verified' }, { email: 'other@example.com' }, { year: 1.5 }, { phone: 'bad' }, { name: { $ne: '' } }, {}]) assert.equal((await call('PATCH', body)).status, 400);
      assert.equal((await call('PATCH', { year: null })).status, 200); assert.equal((await User.findOne({ email })).year, undefined);
      await User.updateOne({ email }, { role: 'admin' }); assert.equal((await call()).status, 403); await User.updateOne({ email }, { role: 'student' });
    });
    await t.test('pages, nested assets, old links and private source protection', async () => {
      for (const path of ['/', '/auth/index.html', '/admin/index.html', '/profile.html', '/product.html', '/sell.html', '/favorites.html', '/my-listings.html', '/privacy.html', '/terms.html', '/css/header.css', '/js/api.js', '/assets/logo.png']) assert.equal((await fetch(base + path)).status, 200, path);
      for (const [from, to] of [['/Auth/user.html', '/auth.html'], ['/user.html', '/auth.html'], ['/admin/index.html', '/admin.html'], ['/CSS/header.css', '/css/header.css']]) { const response = await fetch(base + from, { redirect: 'manual' }); assert.equal(response.status, 302); assert.equal(response.headers.get('location'), to); }
      for (const path of ['/backend/.env', '/package.json', '/database/models/User.js', '/.git/config']) assert.equal((await fetch(base + path)).status, 404, path);
    });
  } finally {
    if (mongoose.connection.readyState) { await User.deleteMany({ email }); await Campus.deleteMany({ campusCode }); }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await mongoose.disconnect();
  }
});
