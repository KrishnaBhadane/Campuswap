import Campus from '../../../database/models/Campus.js';

export async function publicCampuses(req, res) {
  const campuses = await Campus.find({ status: 'active' }).select('campusCode officialCode name -_id').sort({ name: 1 }).lean();
  res.json(campuses.map(({ campusCode, ...campus }) => ({ code: campusCode, ...campus })));
}

export async function adminCampuses(req, res) {
  res.json({ campuses: await Campus.find().select('name campusCode officialCode status').sort({ name: 1 }).lean() });
}

export async function saveCampus(req, res) {
  const { name, campusCode, officialCode, status = 'active' } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.length > 200 ||
      typeof officialCode !== 'string' || !/^[0-9]{4,10}$/.test(officialCode) || !['active', 'disabled'].includes(status) ||
      (!req.params.code && (typeof campusCode !== 'string' || campusCode.length > 40 || !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(campusCode))) ||
      (req.params.code && campusCode !== undefined && campusCode !== req.params.code)) {
    return res.status(400).json({ message: 'Provide a name, stable uppercase campus code, numeric official code and valid status. Campus codes cannot be changed.' });
  }
  try {
    const campus = req.params.code
      ? await Campus.findOneAndUpdate({ campusCode: req.params.code }, { name: name.trim(), officialCode, status }, { returnDocument: 'after', runValidators: true })
      : await Campus.create({ name, campusCode, officialCode, status });
    if (!campus) return res.status(404).json({ message: 'Campus not found' });
    res.status(req.params.code ? 200 : 201).json({ campus });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Campus code or official code already exists' });
    throw error;
  }
}
