import { Router } from 'express';
import { publicCampuses } from '../controllers/campusController.js';
const router = Router();
router.get('/', publicCampuses);
export default router;
