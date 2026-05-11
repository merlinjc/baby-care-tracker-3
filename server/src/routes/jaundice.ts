/**
 * jaundice routes (v7.2 T-S1-F2-02)
 *
 * 挂载点：`/api/babies/:id/jaundice`
 *
 * | 路由 | 说明 |
 * |------|------|
 * | GET    /                  | 列表（默认 100 条，按 recordDate 倒序，可 startDate/endDate 过滤）|
 * | POST   /                  | 创建 |
 * | GET    /:recordId         | 详情 |
 * | PATCH  /:recordId         | 部分更新 |
 * | DELETE /:recordId         | 删除 |
 *
 * 权限：与 vaccine / milestone 一致，由 service 层根据 createdBy + role 决策。
 */
import { Router } from 'express';
import { jaundiceService } from '../services/jaundice.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { babyIdParamSchema } from '../schemas/baby.schema';
import {
  createJaundiceSchema,
  updateJaundiceSchema,
  listJaundiceQuerySchema,
  jaundiceIdParamSchema,
} from '../schemas/jaundice.schema';

const router = Router();
router.use(authenticate);

// GET /api/babies/:id/jaundice
router.get(
  '/:id/jaundice',
  validateParams(babyIdParamSchema),
  validateQuery(listJaundiceQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await jaundiceService.list(
      req.userId!,
      req.params.id,
      req.query as any,
    );
    res.json({ success: true, data: result });
  }),
);

// POST /api/babies/:id/jaundice
router.post(
  '/:id/jaundice',
  validateParams(babyIdParamSchema),
  validateBody(createJaundiceSchema),
  asyncHandler(async (req, res) => {
    const record = await jaundiceService.create(req.userId!, req.params.id, req.body);
    res.status(201).json({ success: true, data: { record } });
  }),
);

// GET /api/babies/:id/jaundice/:recordId
router.get(
  '/:id/jaundice/:recordId',
  validateParams(jaundiceIdParamSchema),
  asyncHandler(async (req, res) => {
    const record = await jaundiceService.getById(
      req.userId!,
      req.params.id,
      req.params.recordId,
    );
    res.json({ success: true, data: { record } });
  }),
);

// PATCH /api/babies/:id/jaundice/:recordId
router.patch(
  '/:id/jaundice/:recordId',
  validateParams(jaundiceIdParamSchema),
  validateBody(updateJaundiceSchema),
  asyncHandler(async (req, res) => {
    const record = await jaundiceService.update(
      req.userId!,
      req.params.id,
      req.params.recordId,
      req.body,
    );
    res.json({ success: true, data: { record } });
  }),
);

// DELETE /api/babies/:id/jaundice/:recordId
router.delete(
  '/:id/jaundice/:recordId',
  validateParams(jaundiceIdParamSchema),
  asyncHandler(async (req, res) => {
    const result = await jaundiceService.delete(
      req.userId!,
      req.params.id,
      req.params.recordId,
    );
    res.json({ success: true, data: result });
  }),
);

export default router;
