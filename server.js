import app from './backend/src/app.js';
import connectDB from './database/db.js';

if (process.env.MONGODB_URI) {
  connectDB().catch((err) => {
    console.error('MongoDB connection error:', err);
  });
}

export default app;
