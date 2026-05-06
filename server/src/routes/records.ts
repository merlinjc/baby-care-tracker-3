import { Router } from 'express';
import { recordService } from '../services/record.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import {
  createRecordSchema,
  updateRecordSchema,
  getRecordsQuerySchema,
  todayStatsQuerySchema,
} from '../schemas/record.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/records
router.get('/', validateQuery(getRecordsQuerySchema), asyncHandler(async (req, res) => {
  const result = await recordService.getRecords(req.userId!, req.query as any);

  res.json({
    success: true,
    data: result,
  });
}));

// GET /api/records/today-stats
router.get('/today-stats', validateQuery(todayStatsQuerySchema), asyncHandler(async (req, res) => {
  const result = await recordService.getTodayStats(req.userId!, req.query.babyId as string);

  res.json({
    success: true,
    data: { stats: result },
  });
}));

// GET /api/records/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await recordService.getRecordById(req.userId!, req.params.id);

  res.json({
    success: true,
    data: { record: result },
  });
}));

// POST /api/records
router.post('/', validateBody(createRecordSchema), asyncHandler(async (req, res) => {
  const result = await recordService.createRecord(req.userId!, req.body);

  res.status(201).json({
    success: true,
    data: { record: result },
  });
}));

// PATCH /api/records/:id
router.patch('/:id', validateBody(updateRecordSchema), asyncHandler(async (req, res) => {
  const result = await recordService.updateRecord(req.userId!, req.params.id, req.body);

  res.json({
    success: true,
    data: { record: result },
  });
}));

// DELETE /api/records/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await recordService.deleteRecord(req.userId!, req.params.id);

  res.json({
    success: true,
    data: result,
  });
}));

export default router;
