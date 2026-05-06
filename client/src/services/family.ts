import api from './api';
import type {
  FamilyDetail,
  FamilyMember,
  FamilyRole,
  LeaveFamilyResult,
} from '@baby-care-tracker/shared';

export const familyApi = {
  create: async (name: string, nickname?: string, relation?: string): Promise<FamilyDetail> => {
    const res = await api.post('/families', { name, nickname: nickname || name, relation });
    return res.data.data.family;
  },

  getCurrent: async (): Promise<FamilyDetail | null> => {
    const res = await api.get('/families/current');
    return res.data.data?.family ?? null;
  },

  getDetail: async (id: string): Promise<FamilyDetail> => {
    const res = await api.get(`/families/${id}`);
    return res.data.data.family;
  },

  getMembers: async (familyId: string): Promise<FamilyMember[]> => {
    const res = await api.get(`/families/${familyId}/members`);
    return res.data.data.members;
  },

  join: async (
    inviteCode: string,
    nickname?: string,
  ): Promise<{ family: FamilyDetail }> => {
    const res = await api.post('/families/join', { inviteCode, nickname: nickname || '成员' });
    return res.data.data;
  },

  /** FR-C5：返回完整 LeaveFamilyResult，由调用方根据 status 字段分支处理 */
  leave: async (familyId: string): Promise<LeaveFamilyResult> => {
    const res = await api.post(`/families/${familyId}/leave`);
    return res.data.data as LeaveFamilyResult;
  },

  dissolve: async (familyId: string): Promise<void> => {
    await api.delete(`/families/${familyId}`);
  },

  refreshInviteCode: async (
    familyId: string,
  ): Promise<{ inviteCode: string; inviteCodeExpiry: string }> => {
    const res = await api.post(`/families/${familyId}/refresh-invite`);
    return res.data.data;
  },

  updateMemberRole: async (
    familyId: string,
    userId: string,
    role: FamilyRole,
  ): Promise<FamilyMember> => {
    const res = await api.patch(`/families/${familyId}/members/${userId}/role`, { role });
    return res.data.data.member;
  },

  removeMember: async (familyId: string, userId: string): Promise<void> => {
    await api.delete(`/families/${familyId}/members/${userId}`);
  },

  transferAdmin: async (familyId: string, newAdminId: string): Promise<void> => {
    await api.post(`/families/${familyId}/transfer-admin`, { newAdminId });
  },
};

// Alias for compatibility with stores
export const familyService = familyApi;