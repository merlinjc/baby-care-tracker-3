import { Router } from 'express';
import { familyService } from '../services/family.service';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { familyRateLimit } from '../middleware/rate-limit';
import { asyncHandler } from '../utils/async-handler';
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
router.post('/:id/leave', validateParams(familyIdParamSchema), asyncHandler(async (req, res) => {
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
