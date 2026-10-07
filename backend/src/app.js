import express from 'express';
import healthRoutes from './routes/healthRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use('/api/health', healthRoutes);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

export default app;
