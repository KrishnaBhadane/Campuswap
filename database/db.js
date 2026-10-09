import mongoose from 'mongoose';

export default async function connectDB() {
  if (mongoose.connection.readyState >= 1) return mongoose.connection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('MongoDB connected');
  } catch {
    throw new Error('MongoDB connection failed. Check your URI, credentials, and network access.');
  }
}
