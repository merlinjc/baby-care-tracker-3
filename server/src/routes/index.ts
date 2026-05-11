import { Router } from 'express';
import authRoutes from './auth';
import recordRoutes from './records';
import familyRoutes from './families';
import babyRoutes from './babies';
import vaccineRoutes from './vaccines';
import jaundiceRoutes from './jaundice';
import aiRoutes from './ai';
import exportRoutes from './export';
import uploadRoutes from './uploads';

const router = Router();

router.use('/auth', authRoutes);
router.use('/records', recordRoutes);
router.use('/families', familyRoutes);
router.use('/babies', babyRoutes);
router.use('/babies', vaccineRoutes); // vaccine/milestone/trend routes under /babies/:id/...
router.use('/babies', jaundiceRoutes); // jaundice routes under /babies/:id/jaundice/...
router.use('/ai', aiRoutes);
router.use('/export', exportRoutes);
router.use('/uploads', uploadRoutes);

export default router;
