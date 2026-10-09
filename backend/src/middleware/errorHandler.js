export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.name === 'MulterError') {
    const oversized = error.code === 'LIMIT_FILE_SIZE';
    return res.status(oversized ? 413 : 400).json({ success: false, message: oversized ? 'College ID must be 5 MB or smaller' : 'Upload exactly one collegeId image' });
  }

  if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'Listing changed. Reload before editing again.' });
  if (error.expose === true && error.status >= 400 && error.status < 500) return res.status(error.status).json({ success: false, message: error.message });

  if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email already registered' });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid profile fields' });
  }

  const status = error.status >= 400 && error.status <= 599 ? error.status : 500;
  const message = status === 400 ? 'Invalid request' : status === 413 ? 'Request body too large' : 'Internal server error';
  res.status(status).json({ success: false, message });
}
