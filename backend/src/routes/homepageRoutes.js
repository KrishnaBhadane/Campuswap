import { Router } from 'express';
import { publicHomepage } from '../controllers/homepageController.js';
const router = Router();
router.get('/', publicHomepage);
export default router;
