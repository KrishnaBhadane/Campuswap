import Campus from './models/Campus.js';
import { campuses } from '../backend/src/config/campuses.js';

export default async function initCampuses() {
  await Campus.init();
  await Campus.bulkWrite(campuses.map(({ code, ...campus }) => ({ updateOne: {
    filter: { campusCode: code }, update: { $setOnInsert: { ...campus, campusCode: code, status: 'active' } }, upsert: true
  } })));
}
