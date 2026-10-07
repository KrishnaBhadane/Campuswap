export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status >= 400 && error.status <= 599 ? error.status : 500;
  const message = status === 400 ? 'Invalid request' : status === 413 ? 'Request body too large' : 'Internal server error';
  res.status(status).json({ success: false, message });
}
