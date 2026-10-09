import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createReport } from '../src/controllers/reportController.js';
import Report from '../../database/models/Report.js';
import User from '../../database/models/User.js';
import Listing from '../../database/models/Listing.js';
import Campus from '../../database/models/Campus.js';

test('Report controller preserves trusted identity, campus and duplicate checks', async t => {
  const reporter = new mongoose.Types.ObjectId(), seller = new mongoose.Types.ObjectId();
  let target = { _id: seller, sellerId: seller, campusCode: 'A' }, saved, duplicate = false;
  const query = () => ({ select: () => ({ lean: async () => target }) });
  t.mock.method(Campus, 'exists', async () => true);
  t.mock.method(User, 'findOne', query);
  t.mock.method(Listing, 'findOne', query);
  t.mock.method(Report, 'create', async body => {
    if (duplicate) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    saved = body; return { _id: seller, status: 'open' };
  });
  let distinctList = [reporter];
  let userUpdated = null;
  t.mock.method(Report, 'distinct', async (field, filter) => {
    assert.equal(field, 'reporterId');
    assert.equal(filter.status, 'open');
    assert.equal(filter.targetType, 'user');
    return distinctList;
  });
  t.mock.method(User, 'updateOne', async (filter, update) => {
    userUpdated = { filter, update };
    return { modifiedCount: 1 };
  });
  async function submit(targetType = 'user', extra = {}) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createReport({ user: { _id: reporter, campusCode: 'A' }, body: { targetType, targetId: seller.toString(), reason: 'Scam / suspicious', details: 'Optional context', reporterId: seller, campusCode: 'B', ...extra } }, res);
    return res;
  }
  assert.equal((await submit()).statusCode, 201);
  assert.equal(userUpdated, null); // 1 reporter -> active, not auto-blocked

  // When 5 distinct reporters submit open reports
  distinctList = [reporter, new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  assert.equal((await submit()).statusCode, 201);
  assert.deepEqual(userUpdated, {
    filter: { _id: seller, status: 'active' },
    update: { $set: { status: 'blocked', autoBlocked: true }, $inc: { authVersion: 1 } }
  });
  assert.equal(saved.reporterId, reporter);
  assert.equal(saved.campusCode, 'A');
  assert.equal(saved.targetType, 'user');
  assert.equal(saved.targetId, seller.toString());
  assert.equal(saved.details, 'Optional context');
  duplicate = true;
  assert.equal((await submit()).statusCode, 409);
  duplicate = false;
  target = { ...target, _id: reporter };
  assert.equal((await submit()).statusCode, 400);
  target = { ...target, _id: seller, campusCode: 'B' };
  assert.equal((await submit()).statusCode, 403);
  target = null;
  assert.equal((await submit()).statusCode, 404);
  target = { _id: seller, sellerId: seller, campusCode: 'A' };
  assert.equal((await submit('listing')).statusCode, 201);
  target.sellerId = reporter;
  assert.equal((await submit('listing')).statusCode, 400);
  assert.equal((await submit('support')).statusCode, 201);
  assert.equal(saved.targetType, 'support');
  assert.equal(saved.reporterId, reporter);
  assert.equal(saved.targetId, undefined);
  assert.equal((await submit('user', { targetId: { $ne: null } })).statusCode, 400);
  assert.equal((await submit('user', { details: 'x'.repeat(1001) })).statusCode, 400);
});
