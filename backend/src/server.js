import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import app from './app.js';
import connectDB from '../../database/db.js';

try {
  const envFile = new URL('../.env', import.meta.url);
  if (existsSync(envFile)) loadEnvFile(envFile);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');

  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');

  await connectDB();
  app.listen(port, () => console.log(`CampusSwap API listening on port ${port}`))
    .on('error', () => {
      console.error('Server could not start. Check port availability.');
      process.exit(1);
    });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
