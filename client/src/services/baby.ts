import api from './api';
import type { Baby } from '@baby-care-tracker/shared';

export const babyApi = {
  create: async (data: { familyId: string; name: string; gender: string; birthDate: string; avatar?: string }): Promise<Baby> => {
    const res = await api.post('/babies', data);
    return res.data.data.baby;
  },

  list: async (familyId: string): Promise<Baby[]> => {
    const res = await api.get('/babies', { params: { familyId } });
    return res.data.data.babies;
  },

  get: async (id: string): Promise<Baby> => {
    const res = await api.get(`/babies/${id}`);
    return res.data.data.baby;
  },

  update: async (id: string, data: Partial<Baby>): Promise<Baby> => {
    const res = await api.patch(`/babies/${id}`, data);
    return res.data.data.baby;
  },

  delete: async (id: string, familyId: string): Promise<void> => {
    await api.delete(`/babies/${id}`, { data: { familyId } });
  },
};

// Alias for compatibility with stores
export const babyService = babyApi;
