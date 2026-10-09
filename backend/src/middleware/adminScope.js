import Campus from '../../../database/models/Campus.js';

export default async function adminScope(req, res, next) {
  const { campusCode, page = '1' } = req.query;
  if ((campusCode !== undefined && (typeof campusCode !== 'string' || !await Campus.exists({ campusCode }))) ||
      typeof page !== 'string' || !/^[1-9][0-9]{0,3}$/.test(page)) {
    return res.status(400).json({ message: 'Invalid campus or page' });
  }
  req.campusFilter = campusCode ? { campusCode } : {};
  req.adminPage = Number(page);
  next();
}
