import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import app from './app.js';
import connectDB from '../../database/db.js';
import initCampuses from '../../database/initCampuses.js';

try {
  const envFile = new URL('../.env', import.meta.url);
  if (existsSync(envFile)) loadEnvFile(envFile);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');

  const requiredProductionVars = [
    'MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL',
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'
  ];
  if (process.env.NODE_ENV === 'production') {
    const missing = requiredProductionVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
  }

  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');

  const dbConnection = await connectDB();
  await initCampuses();
  const server = app.listen(port, () => console.log(`CampusSwap API listening on port ${port}`))
    .on('error', () => {
      console.error('Server could not start. Check port availability.');
      process.exit(1);
    });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        if (dbConnection) {
          const mongoose = (await import('mongoose')).default;
          await mongoose.disconnect();
        }
      } catch {}
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
