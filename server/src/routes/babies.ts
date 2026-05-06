import { Router } from 'express';
import { babyService } from '../services/baby.service';
import { trendService } from '../services/trend.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import {
  createBabySchema,
  updateBabySchema,
  deleteBabySchema,
  babyIdParamSchema,
  babiesQuerySchema,
} from '../schemas/baby.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/babies
router.get('/', validateQuery(babiesQuerySchema), asyncHandler(async (req, res) => {
  const result = await babyService.getBabiesByFamilyId(req.userId!, req.query.familyId as string);

  res.json({
    success: true,
    data: { babies: result },
  });
}));

// POST /api/babies
router.post('/', validateBody(createBabySchema), asyncHandler(async (req, res) => {
  const result = await babyService.createBaby(req.userId!, req.body);

  res.status(201).json({
    success: true,
    data: { baby: result },
  });
}));

// GET /api/babies/:id
router.get('/:id', validateParams(babyIdParamSchema), asyncHandler(async (req, res) => {
  const result = await babyService.getBabyById(req.userId!, req.params.id);

  res.json({
    success: true,
    data: { baby: result },
  });
}));

// PATCH /api/babies/:id
router.patch(
  '/:id',
  validateParams(babyIdParamSchema),
  validateBody(updateBabySchema),
  asyncHandler(async (req, res) => {
    const result = await babyService.updateBaby(req.userId!, req.params.id, req.body);

    res.json({
      success: true,
      data: { baby: result },
    });
  }),
);

// DELETE /api/babies/:id
router.delete(
  '/:id',
  validateParams(babyIdParamSchema),
  validateBody(deleteBabySchema),
  asyncHandler(async (req, res) => {
    const cursor = req.query.cursor as string | undefined;
    const result = await babyService.deleteBaby(req.userId!, req.params.id, req.body.familyId, cursor);

    res.json({
      success: true,
      data: result,
    });
  }),
);

// GET /api/babies/:id/trend/weekly  — FR-B 增强本周趋势
router.get(
  '/:id/trend/weekly',
  validateParams(babyIdParamSchema),
  asyncHandler(async (req, res) => {
    const result = await trendService.getEnhancedWeeklyTrend(req.userId!, req.params.id);
    res.json({
      success: true,
      data: { trend: result },
    });
  }),
);

export default router;
