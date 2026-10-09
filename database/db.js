import mongoose from 'mongoose';

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI environment variable is missing!');
    throw new Error('Server configuration error: MONGODB_URI is missing');
  }

  if (!cached.promise || mongoose.connection.readyState === 0) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };
    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((m) => {
      console.log('MongoDB connected');
      return m;
    }).catch((err) => {
      cached.promise = null;
      console.error('MongoDB connection failed:', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch {
    cached.promise = null;
    throw new Error('MongoDB connection failed. Check your URI, credentials, and network access.');
  }

  return cached.conn;
}
