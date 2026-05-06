import { Router } from 'express';
import { familyService } from '../services/family.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { familyRateLimit } from '../middleware/rate-limit';
import { asyncHandler } from '../utils/async-handler';
import { getFamilyIdForUser } from '../utils/permission';
import { ForbiddenError, ErrorCodes } from '../types/errors';
import {
  createFamilySchema,
  joinFamilySchema,
  updateMemberRoleSchema,
  transferAdminSchema,
  familyIdParamSchema,
  familyMemberParamSchema,
} from '../schemas/family.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/families
router.post('/', familyRateLimit, validateBody(createFamilySchema), asyncHandler(async (req, res) => {
  const result = await familyService.createFamily(req.userId!, req.body);

  res.status(201).json({
    success: true,
    data: { family: result },
  });
}));

// GET /api/families/current
router.get('/current', asyncHandler(async (req, res) => {
  const result = await familyService.getFamilyByUserId(req.userId!);

  res.json({
    success: true,
    data: { family: result },
  });
}));

// POST /api/families/join
router.post('/join', familyRateLimit, validateBody(joinFamilySchema), asyncHandler(async (req, res) => {
  const result = await familyService.joinByInviteCode(req.userId!, req.body);

  res.json({
    success: true,
    data: { family: result },
  });
}));

// GET /api/families/:id
router.get('/:id', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
  const result = await familyService.getFamilyDetail(req.userId!, req.params.id);

  res.json({
    success: true,
    data: { family: result },
  });
}));

// GET /api/families/:id/members
router.get('/:id/members', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
  const result = await familyService.getFamilyMembers(req.userId!, req.params.id);

  res.json({
    success: true,
    data: { members: result },
  });
}));

// POST /api/families/:id/leave
// 安全闸（HTTP 入口）：避免攻击者通过任意 familyId 调 leave 探测家庭存在性。
// 仅当目标 familyId 与用户当前 familyId 一致才放行；service 内部仍保留状态机用于自愈并发场景。
router.post('/:id/leave', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
  const ownFamilyId = await getFamilyIdForUser(req.userId!);
  if (ownFamilyId !== req.params.id) {
    throw new ForbiddenError('无权操作该家庭', ErrorCodes.PERMISSION_DENIED);
  }
  const result = await familyService.leaveFamily(req.userId!, req.params.id);

  res.json({
    success: true,
    data: result,
  });
}));

// DELETE /api/families/:id
router.delete('/:id', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
  const result = await familyService.dissolveFamily(req.userId!, req.params.id);

  res.json({
    success: true,
    data: result,
  });
}));

// POST /api/families/:id/refresh-invite
router.post('/:id/refresh-invite', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
  const result = await familyService.refreshInviteCode(req.userId!, req.params.id);

  res.json({
    success: true,
    data: result,
  });
}));

// PATCH /api/families/:id/members/:userId/role
router.patch(
  '/:id/members/:userId/role',
  validateParams(familyMemberParamSchema),
  validateBody(updateMemberRoleSchema),
  asyncHandler(async (req, res) => {
    const result = await familyService.updateMemberRole(
      req.userId!,
      req.params.id,
      req.params.userId,
      req.body.role,
    );

    res.json({
      success: true,
      data: { member: result },
    });
  }),
);

// DELETE /api/families/:id/members/:userId
router.delete(
  '/:id/members/:userId',
  validateParams(familyMemberParamSchema),
  asyncHandler(async (req, res) => {
    const result = await familyService.removeMember(req.userId!, req.params.id, req.params.userId);

    res.json({
      success: true,
      data: result,
    });
  }),
);

// POST /api/families/:id/transfer-admin
router.post(
  '/:id/transfer-admin',
  validateParams(familyIdParamSchema),
  validateBody(transferAdminSchema),
  asyncHandler(async (req, res) => {
    const result = await familyService.transferAdmin(req.userId!, req.params.id, req.body.newAdminId);

    res.json({
      success: true,
      data: result,
    });
  }),
);

export default router;
