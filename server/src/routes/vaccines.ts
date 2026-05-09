import { Router } from 'express';
import { vaccineService } from '../services/vaccine.service';
import { milestoneService } from '../services/milestone.service';
import { trendService } from '../services/trend.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { babyIdParamSchema } from '../schemas/baby.schema';
import { vaccineSchema, milestoneSchema, updateMilestoneSchema, trendQuerySchema, paginationSchema } from '../schemas/common.schema';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============ Vaccines ============

// GET /api/babies/:id/vaccines
router.get(
  '/:id/vaccines',
  validateParams(babyIdParamSchema),
  validateQuery(paginationSchema.extend({ status: z.enum(['pending', 'completed', 'overdue']).optional() })),
  asyncHandler(async (req, res) => {
    const result = await vaccineService.getVaccines(req.userId!, req.params.id, req.query as any);

    res.json({
      success: true,
      data: result,
    });
  }),
);

// POST /api/babies/:id/vaccines
router.post(
  '/:id/vaccines',
  validateParams(babyIdParamSchema),
  validateBody(vaccineSchema),
  asyncHandler(async (req, res) => {
    const result = await vaccineService.createVaccine(req.userId!, req.params.id, req.body);

    res.status(201).json({
      success: true,
      data: { vaccine: result },
    });
  }),
);

// GET /api/babies/:id/vaccine-stats
router.get(
  '/:id/vaccine-stats',
  validateParams(babyIdParamSchema),
  asyncHandler(async (req, res) => {
    // Simplified vaccine stats - in production would use WHO vaccine plan
    const vaccines = await vaccineService.getVaccines(req.userId!, req.params.id, { page: 1, pageSize: 100 });

    res.json({
      success: true,
      data: {
        total: vaccines.total,
        overdue: 0,
        upcoming: 0,
        items: vaccines.items,
      },
    });
  }),
);

// ============ Milestones ============

// GET /api/babies/:id/milestones
router.get(
  '/:id/milestones',
  validateParams(babyIdParamSchema),
  validateQuery(paginationSchema.extend({
    category: z.string().optional(),
    status: z.enum(['pending', 'achieved']).optional(),
  })),
  asyncHandler(async (req, res) => {
    const result = await milestoneService.getMilestones(req.userId!, req.params.id, req.query as any);

    res.json({
      success: true,
      data: result,
    });
  }),
);

// POST /api/babies/:id/milestones
router.post(
  '/:id/milestones',
  validateParams(babyIdParamSchema),
  validateBody(milestoneSchema),
  asyncHandler(async (req, res) => {
    const result = await milestoneService.createMilestone(req.userId!, req.params.id, req.body);

    res.status(201).json({
      success: true,
      data: { milestone: result },
    });
  }),
);

// PATCH /api/babies/:id/milestones/:milestoneId
router.patch(
  '/:id/milestones/:milestoneId',
  validateParams(babyIdParamSchema.extend({ milestoneId: z.string().min(1) })),
  validateBody(updateMilestoneSchema),
  asyncHandler(async (req, res) => {
    const result = await milestoneService.updateMilestone(
      req.userId!,
      req.params.id,
      req.params.milestoneId,
      req.body,
    );

    res.json({
      success: true,
      data: { milestone: result },
    });
  }),
);

// DELETE /api/babies/:id/milestones/:milestoneId
router.delete(
  '/:id/milestones/:milestoneId',
  validateParams(babyIdParamSchema.extend({ milestoneId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const result = await milestoneService.deleteMilestone(
      req.userId!,
      req.params.id,
      req.params.milestoneId,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

// ============ Trends ============

// GET /api/babies/:id/trends
router.get(
  '/:id/trends',
  validateParams(babyIdParamSchema),
  validateQuery(trendQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await trendService.getTrendData(req.userId!, req.params.id, req.query as any);

    res.json({
      success: true,
      data: { trend: result },
    });
  }),
);

export default router;
