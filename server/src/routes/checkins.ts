/**
 * daily-checkin routes (v7.2 T-S2-F11-BE-02)
 *
 * 挂载点：`/api/babies/:id/checkins`
 *
 * | 路由 | 说明 |
 * |------|------|
 * | GET    /                  | 列表（默认本月，按 checkinDate desc，可 startDate/endDate 过滤）|
 * | POST   /                  | 创建（含 7d 窗口校验、唯一约束防重）|
 * | GET    /:date             | 单日详情（YYYY-MM-DD）|
 * | PATCH  /:date             | 部分更新；带 aiSummary 时 aiSummaryAt 自动置 null |
 * | DELETE /:date             | 删除（DB 立即删；COS 对象由 patrol 异步清理）|
 *
 * AI 小记生成的 `POST /:date/ai-summary` 在 BE-03 task 加。
 *
 * 权限：与 jaundice / vaccine 一致，由 service 层根据 createdBy + role 决策。
 */
import { Router } from 'express';
import { dailyCheckinService } from '../services/daily-checkin.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { babyIdParamSchema } from '../schemas/baby.schema';
import {
  createCheckinSchema,
  updateCheckinSchema,
  listCheckinQuerySchema,
  checkinDateParamSchema,
} from '../schemas/daily-checkin.schema';

const router = Router();
router.use(authenticate);

// GET /api/babies/:id/checkins
router.get(
  '/:id/checkins',
  validateParams(babyIdParamSchema),
  validateQuery(listCheckinQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await dailyCheckinService.list(
      req.userId!,
      req.params.id,
      req.query as any,
    );
    res.json({ success: true, data: result });
  }),
);

// POST /api/babies/:id/checkins
router.post(
  '/:id/checkins',
  validateParams(babyIdParamSchema),
  validateBody(createCheckinSchema),
  asyncHandler(async (req, res) => {
    const checkin = await dailyCheckinService.create(req.userId!, req.params.id, req.body);
    res.status(201).json({ success: true, data: { checkin } });
  }),
);

// GET /api/babies/:id/checkins/:date
router.get(
  '/:id/checkins/:date',
  validateParams(checkinDateParamSchema),
  asyncHandler(async (req, res) => {
    const checkin = await dailyCheckinService.getByDate(
      req.userId!,
      req.params.id,
      req.params.date,
    );
    res.json({ success: true, data: { checkin } });
  }),
);

// PATCH /api/babies/:id/checkins/:date
router.patch(
  '/:id/checkins/:date',
  validateParams(checkinDateParamSchema),
  validateBody(updateCheckinSchema),
  asyncHandler(async (req, res) => {
    const checkin = await dailyCheckinService.update(
      req.userId!,
      req.params.id,
      req.params.date,
      req.body,
    );
    res.json({ success: true, data: { checkin } });
  }),
);

// DELETE /api/babies/:id/checkins/:date
router.delete(
  '/:id/checkins/:date',
  validateParams(checkinDateParamSchema),
  asyncHandler(async (req, res) => {
    const result = await dailyCheckinService.remove(
      req.userId!,
      req.params.id,
      req.params.date,
    );
    res.json({ success: true, data: result });
  }),
);

export default router;
