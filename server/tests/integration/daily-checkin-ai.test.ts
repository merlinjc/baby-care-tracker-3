/**
 * daily-checkin AI 小记单元测试（v7.2 T-S2-F11-BE-03）
 *
 * 测试范围：
 * 1) buildCheckinPrompt 的 prompt 字符串断言（基调、数据条目、role hint）
 * 2) generateAiSummary 成功路径：mock aiService.chat → DB 写入 aiSummary + aiSummaryAt
 * 3) generateAiSummary 失败路径：aiService.chat 抛错 → DB 不变，错误透传
 * 4) generateAiSummary 不存在的打卡 → 404 CHECKIN_NOT_FOUND
 * 5) generateAiSummary 跨家庭 → 403
 * 6) generateAiSummary editor 不能改别人创建的 → 403
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  dailyCheckinService,
  buildCheckinPrompt,
} from '../../src/services/daily-checkin.service';
import { aiService } from '../../src/services/ai.service';
import { prisma } from '../../src/config/database';
import { createUser, createFamilyWithMembers, createBaby } from '../helpers/factories';

let admin: { id: string };
let editor: { id: string };
let familyId: string;
let babyId: string;

const NOW = new Date(2026, 4, 15, 10, 30, 0);

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  const editorUser = await createUser({ nickname: 'EditorUser' });
  const { family, admin: adminUser } = await createFamilyWithMembers({
    extraMembers: [{ user: editorUser, role: 'editor' }],
  });
  admin = adminUser;
  editor = editorUser;
  familyId = family.id;
  const baby = await createBaby(family.id, '小满');
  babyId = baby.id;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildCheckinPrompt', () => {
  it('包含日期、宝宝名、温柔基调、字数限制', () => {
    const prompt = buildCheckinPrompt({
      babyName: '小满',
      checkinDate: '2026-05-15',
      caption: null,
      ctx: { counts: {}, milestones: [], hasJaundice: false, jaundiceTcb: null },
    });
    expect(prompt).toContain('2026-05-15');
    expect(prompt).toContain('小满');
    expect(prompt).toContain('温柔感性');
    expect(prompt).toContain('60 字');
  });

  it('caption 与当天数据被纳入 prompt', () => {
    const prompt = buildCheckinPrompt({
      babyName: '小满',
      checkinDate: '2026-05-15',
      caption: '第一次翻身',
      ctx: {
        counts: { feeding: 6, sleep: 3, diaper: 5 },
        milestones: ['翻身'],
        hasJaundice: false,
        jaundiceTcb: null,
      },
    });
    expect(prompt).toContain('第一次翻身');
    expect(prompt).toContain('喂养 6 次');
    expect(prompt).toContain('睡眠 3 次');
    expect(prompt).toContain('换尿布 5 次');
    expect(prompt).toContain('翻身');
  });

  it('黄疸 tcb 拼入 prompt', () => {
    const prompt = buildCheckinPrompt({
      babyName: '小满',
      checkinDate: '2026-05-15',
      caption: null,
      ctx: { counts: {}, milestones: [], hasJaundice: true, jaundiceTcb: 12.3 },
    });
    expect(prompt).toContain('12.3');
  });

  it('mom role 添加第一人称 hint', () => {
    const prompt = buildCheckinPrompt({
      babyName: '小满',
      checkinDate: '2026-05-15',
      caption: null,
      ctx: { counts: {}, milestones: [], hasJaundice: false, jaundiceTcb: null },
      role: 'mom',
    });
    expect(prompt).toContain('第一人称');
  });

  it('grandma role 用祖辈口吻', () => {
    const prompt = buildCheckinPrompt({
      babyName: '小满',
      checkinDate: '2026-05-15',
      caption: null,
      ctx: { counts: {}, milestones: [], hasJaundice: false, jaundiceTcb: null },
      role: 'grandma_m',
    });
    expect(prompt).toContain('祖辈');
  });
});

describe('generateAiSummary', () => {
  async function seedCheckin(creator: string, date = '2026-05-15') {
    return dailyCheckinService.create(creator, babyId, {
      checkinDate: date,
      photoKey: `checkins/${familyId}/${babyId}/${date}-x.jpg`,
    });
  }

  it('成功路径：mock chat 返回内容 → DB 写入 aiSummary + aiSummaryAt', async () => {
    await seedCheckin(admin.id);

    const chatSpy = vi
      .spyOn(aiService, 'chat')
      .mockResolvedValue({ content: '今天小满冲我笑了一下，妈妈心都化了。' });

    const result = await dailyCheckinService.generateAiSummary(
      admin.id,
      babyId,
      '2026-05-15',
      'mom',
    );

    expect(chatSpy).toHaveBeenCalledTimes(1);
    expect(result.aiSummary).toBe('今天小满冲我笑了一下，妈妈心都化了。');
    expect(result.aiSummaryAt).not.toBeNull();

    const row = await prisma.dailyCheckin.findUnique({
      where: { babyId_checkinDate: { babyId, checkinDate: '2026-05-15' } },
    });
    expect(row?.aiSummary).toBe('今天小满冲我笑了一下，妈妈心都化了。');
    expect(row?.aiSummaryAt).not.toBeNull();
  });

  it('失败路径：chat 抛错 → DB 不变，错误透传', async () => {
    await seedCheckin(admin.id);
    // 先手动写一个旧 aiSummary 模拟"已经有过 AI 小记"
    await prisma.dailyCheckin.update({
      where: { babyId_checkinDate: { babyId, checkinDate: '2026-05-15' } },
      data: { aiSummary: '上一次的小记', aiSummaryAt: new Date(2026, 4, 14) },
    });

    vi.spyOn(aiService, 'chat').mockRejectedValue(new Error('OpenAI HTTP 503'));

    await expect(
      dailyCheckinService.generateAiSummary(admin.id, babyId, '2026-05-15'),
    ).rejects.toThrow('OpenAI HTTP 503');

    const row = await prisma.dailyCheckin.findUnique({
      where: { babyId_checkinDate: { babyId, checkinDate: '2026-05-15' } },
    });
    expect(row?.aiSummary).toBe('上一次的小记');
  });

  it('打卡不存在 → 404 CHECKIN_NOT_FOUND', async () => {
    await expect(
      dailyCheckinService.generateAiSummary(admin.id, babyId, '2026-05-15'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'CHECKIN_NOT_FOUND' });
  });

  it('跨家庭 → 403', async () => {
    await seedCheckin(admin.id);
    const outsider = await createUser({ nickname: 'Outsider' });
    await createFamilyWithMembers({ creator: outsider });

    await expect(
      dailyCheckinService.generateAiSummary(outsider.id, babyId, '2026-05-15'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('editor 不能给 admin 的打卡生成（按 update 权限矩阵）', async () => {
    await seedCheckin(admin.id);
    await expect(
      dailyCheckinService.generateAiSummary(editor.id, babyId, '2026-05-15'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('editor 可以给自己创建的打卡生成', async () => {
    await seedCheckin(editor.id, '2026-05-14');

    vi.spyOn(aiService, 'chat').mockResolvedValue({ content: 'editor 的小记' });

    const result = await dailyCheckinService.generateAiSummary(editor.id, babyId, '2026-05-14');
    expect(result.aiSummary).toBe('editor 的小记');
  });

  it('日期格式非法 → 400 CHECKIN_DATE_INVALID', async () => {
    await expect(
      dailyCheckinService.generateAiSummary(admin.id, babyId, 'not-a-date'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'CHECKIN_DATE_INVALID' });
  });
});
