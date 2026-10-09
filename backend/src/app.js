import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import campusRoutes from './routes/campusRoutes.js';
import homepageRoutes from './routes/homepageRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "'self'", "https://*.vercel.app"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Precise origin and CORS handling for production & development
app.use((req, res, next) => {
  const origin = req.get('origin');
  const allowed = process.env.FRONTEND_URL;
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  let isVercel = false;
  try { if (origin) isVercel = /\.vercel\.app$/.test(new URL(origin).hostname); } catch {}
  const isDevLocal = process.env.NODE_ENV !== 'production' && origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin && (origin === allowed || origin === sameOrigin || isVercel || isDevLocal)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const frontendCandidates = [
  path.resolve(process.cwd(), 'frontend'),
  path.resolve(fileURLToPath(import.meta.url), '../../../frontend')
];
const frontendPath = frontendCandidates.find(p => existsSync(p)) || frontendCandidates[0];
const htmlPath = path.join(frontendPath, 'html');
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(frontendPath, 'assets/favicon.png')));
app.get(['/Auth/user.html', '/user.html', '/auth/index.html', '/login'], (req, res) => res.redirect(302, '/auth.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
app.get(['/admin/index.html', '/admin'], (req, res) => res.redirect(302, '/admin.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
app.use((req, res, next) => {
  if (/^\/(CSS|JS)\//.test(req.url)) return res.redirect(302, req.url.replace(/^\/(CSS|JS)\//, prefix => prefix.toLowerCase()));
  next();
});

app.get('/', (req, res) => res.sendFile(path.join(htmlPath, 'index.html')));

// Serve HTML with no-cache so browsers always get fresh documents
app.use(express.static(htmlPath, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));

// Serve static assets with moderate cache
app.use(express.static(frontendPath, {
  index: false,
  setHeaders: (res, filePath) => {
    if (/\.(css|js|webp|png|jpg|jpeg|svg|woff2?)$/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=86400');
    }
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/campuses', campusRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

export default app;
