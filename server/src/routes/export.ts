import { Router, Request, Response } from 'express';
import { exportService } from '../services/export.service';
import { authenticate } from '../middleware/auth';
import { exportRateLimit } from '../middleware/rate-limit';
import { validateQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { exportQuerySchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/export
router.get('/', exportRateLimit, validateQuery(exportQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await exportService.exportData(req.userId!, req.query as any);

  const date = new Date().toISOString().split('T')[0];
  const filename = `export_${req.query.babyId}_${date}`;

  if (result.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
    // Add BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + result.data);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
    res.json(result.data);
  }
}));

export default router;
