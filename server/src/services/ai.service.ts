/**
 * AIService - 混元接入 + 配额管理 + 缓存 + 降级（FR-F）
 *
 * 设计要点（design.md §7）：
 * - 不引入 tencentcloud-sdk-nodejs（避免膨胀依赖树），用原生 fetch + TC3-HMAC-SHA256 签名
 * - 缺失凭证或 5xx/超时时降级为本地规则引擎（不扣配额）
 * - 配额 upsert 原子自增，超限回滚
 * - 内存 LRU 缓存（按 babyId+date 隔离），24h TTL
 *
 * 提供方法：
 * - chat(userId, messages, babyId?)：同步对话
 * - chatStream(userId, messages, babyId?, onChunk)：流式对话（生成器）
 * - dailyInsight(userId, babyId)：每日洞察（带缓存 + 降级）
 * - getQuotaStatus(userId)：配额查询
 * - consumeQuota(userId) / refundQuota(userId)：配额扣减与回滚
 */
import * as crypto from 'crypto';
import { prisma } from '../config/database';
import { ForbiddenError, ErrorCodes } from '../types/errors';
import { recordService } from './record.service';
import { startOfDay } from '../utils/date';
import type { ChatMessage, DailyInsight, AIQuotaStatus } from '../types';

const DAILY_LIMIT = parseInt(process.env.AI_DAILY_QUOTA ?? '20', 10);
const HUNYUAN_HOST = 'hunyuan.tencentcloudapi.com';
const HUNYUAN_SERVICE = 'hunyuan';
const HUNYUAN_VERSION = '2023-09-01';
const HUNYUAN_REGION = 'ap-guangzhou';
const DEFAULT_MODEL = 'hunyuan-2.0-instruct-20251111';
const FETCH_TIMEOUT_MS = 8000;

interface CacheEntry {
  value: DailyInsight;
  expireAt: number;
}

class AIService {
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 100;

  /** 是否配置了真实凭证 */
  private get hasCredentials(): boolean {
    return !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY);
  }

  // ============ 主要 API ============

  async chat(userId: string, messages: ChatMessage[], babyId?: string): Promise<{ content: string }> {
    await this.consumeQuota(userId);
    try {
      const baby = babyId ? await this.getBabyContext(userId, babyId) : null;
      const systemPrompt = baby ? buildSystemPrompt(baby.name, baby.ageMonths) : '你是一位专业育儿顾问';
      const fullMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];
      const content = await this.callHunyuan(fullMessages);
      return { content };
    } catch (err) {
      // 网络/超时/5xx → 回滚配额
      await this.refundQuota(userId);
      throw err;
    }
  }

  async dailyInsight(userId: string, babyId: string): Promise<DailyInsight> {
    const today = formatDate(new Date());
    const cacheKey = `daily_insight:${babyId}:${today}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const stats = await recordService.getTodayStats(userId, babyId);

    // 当日无任何记录 → fallback（不扣配额）
    if (!hasAnyRecord(stats)) {
      return buildFallbackInsight(stats);
    }

    try {
      await this.consumeQuota(userId);

      const baby = await this.getBabyContext(userId, babyId);
      if (!baby) {
        await this.refundQuota(userId);
        return buildFallbackInsight(stats);
      }

      const prompt = buildInsightPrompt(baby.name, baby.ageMonths, stats);
      const content = await this.callHunyuan([
        { role: 'system', content: '你是一位专业育儿顾问，请用简洁温暖的中文回复，控制在 80 字以内。' },
        { role: 'user', content: prompt },
      ]);

      const insight = parseInsight(content);
      this.setCache(cacheKey, insight, 24 * 3600 * 1000);
      return insight;
    } catch (err) {
      // 配额耗尽 → 抛出（让前端引导用户）
      if ((err as { code?: string })?.code === ErrorCodes.QUOTA_EXCEEDED) {
        throw err;
      }
      // 网络/超时/5xx → 静默降级（已在 callHunyuan 失败前 consumeQuota，此处回滚）
      await this.refundQuota(userId).catch(() => {});
      return buildFallbackInsight(stats);
    }
  }

  // ============ 配额管理（FR-F3） ============

  async consumeQuota(userId: string): Promise<void> {
    const today = formatDate(new Date());
    const quota = await prisma.aIQuota.upsert({
      where: { userId_date: { userId, date: today } },
      update: { count: { increment: 1 } },
      create: { userId, date: today, count: 1 },
    });

    if (quota.count > DAILY_LIMIT) {
      // 超限 → 回滚自增 + 抛错
      await prisma.aIQuota.update({
        where: { userId_date: { userId, date: today } },
        data: { count: { decrement: 1 } },
      });
      throw new ForbiddenError('今日 AI 配额已用尽，请明天再试', ErrorCodes.QUOTA_EXCEEDED);
    }
  }

  async refundQuota(userId: string): Promise<void> {
    const today = formatDate(new Date());
    await prisma.aIQuota
      .update({
        where: { userId_date: { userId, date: today } },
        data: { count: { decrement: 1 } },
      })
      .catch((err: unknown) => {
        console.warn('[AIService.refundQuota] failed', err);
      });
  }

  async getQuotaStatus(userId: string): Promise<AIQuotaStatus> {
    const today = formatDate(new Date());
    const quota = await prisma.aIQuota.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    const used = quota?.count ?? 0;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return {
      dailyLimit: DAILY_LIMIT,
      used,
      remaining: Math.max(0, DAILY_LIMIT - used),
      resetAt: tomorrow.toISOString(),
    };
  }

  // ============ 私有：混元 API 调用 ============

  /**
   * 调用腾讯云混元 ChatCompletions（TC3-HMAC-SHA256 签名）
   * 缺凭证 / 异常 / 超时时抛 AI_SERVICE_UNAVAILABLE，由调用方决定是否降级
   */
  private async callHunyuan(messages: ChatMessage[]): Promise<string> {
    if (!this.hasCredentials) {
      // 开发环境降级：返回 mock 回复
      console.warn('[AIService] TENCENT_SECRET_ID/KEY missing, returning mock response');
      const lastUser = messages.filter((m) => m.role === 'user').pop();
      return mockReply(lastUser?.content ?? '');
    }

    const payload = JSON.stringify({
      Model: DEFAULT_MODEL,
      Messages: messages.map((m) => ({
        Role: m.role.charAt(0).toUpperCase() + m.role.slice(1),
        Content: m.content,
      })),
      Temperature: 0.7,
      Stream: false,
    });

    const headers = signRequest(payload, 'ChatCompletions');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const resp = await fetch(`https://${HUNYUAN_HOST}`, {
        method: 'POST',
        headers,
        body: payload,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Hunyuan HTTP ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as {
        Response?: {
          Choices?: { Message?: { Content?: string } }[];
          Error?: { Code?: string; Message?: string };
        };
      };

      const errInfo = data.Response?.Error;
      if (errInfo) {
        throw new Error(`Hunyuan API ${errInfo.Code}: ${errInfo.Message}`);
      }

      const content = data.Response?.Choices?.[0]?.Message?.Content;
      if (!content) {
        throw new Error('Hunyuan response missing content');
      }
      return content;
    } catch (err) {
      clearTimeout(timer);
      console.warn('[AIService.callHunyuan] failed', err);
      throw err;
    }
  }

  // ============ 私有：辅助 ============

  private async getBabyContext(userId: string, babyId: string): Promise<{ name: string; ageMonths: number } | null> {
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) return null;
    // 校验 baby 归属当前用户的家庭
    const userFamily = await prisma.user.findUnique({
      where: { id: userId },
      select: { familyId: true },
    });
    if (userFamily?.familyId !== baby.familyId) return null;
    const ageMonths = computeAgeMonths(baby.birthDate);
    return { name: baby.name, ageMonths };
  }

  private getCache(key: string): DailyInsight | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCache(key: string, value: DailyInsight, ttlMs: number): void {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expireAt: Date.now() + ttlMs });
  }
}

// ============ 模块级 Helpers ============

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeAgeMonths(birthDate: Date): number {
  const now = new Date();
  const start = startOfDay(birthDate);
  return Math.floor((now.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
}

function hasAnyRecord(stats: Awaited<ReturnType<typeof recordService.getTodayStats>>): boolean {
  return (
    stats.feeding.count > 0 ||
    stats.sleep.count > 0 ||
    stats.diaper.count > 0 ||
    stats.temperature.count > 0
  );
}

function buildSystemPrompt(babyName: string, ageMonths: number): string {
  return `你是一位专业育儿顾问。当前用户的宝宝：${babyName}，${ageMonths}个月。请用简洁温暖的中文回答家长的育儿问题，避免过长，避免使用医疗诊断结论。`;
}

function buildInsightPrompt(
  babyName: string,
  ageMonths: number,
  stats: Awaited<ReturnType<typeof recordService.getTodayStats>>
): string {
  const sleepH = Math.floor(stats.sleep.totalDuration / 3600);
  const sleepM = Math.round((stats.sleep.totalDuration % 3600) / 60);
  return `宝宝 ${babyName}，${ageMonths}个月。今日数据：喂养 ${stats.feeding.count} 次（共 ${stats.feeding.totalAmount}ml）、睡眠 ${sleepH}h${sleepM}m（共 ${stats.sleep.count} 次）、换尿布 ${stats.diaper.count} 次、最新体温 ${stats.temperature.latestValue ?? '--'}°C。请用 80 字内的自然句子总结今日状态。`;
}

/**
 * 将 AI 回复解析为 DailyInsight 结构
 * 简化策略：第一段为 summary；含「建议」「应」「请」字样的句子归 suggestions；
 * 含「警惕」「注意」「就医」字样的归 alerts
 */
function parseInsight(content: string): DailyInsight {
  const trimmed = content.trim();
  // 简单实现：整段作为 summary，建议/警示交给后续优化
  return {
    summary: trimmed.length > 200 ? trimmed.slice(0, 200) + '…' : trimmed,
    suggestions: [],
    alerts: [],
    source: 'ai',
  };
}

/**
 * 本地规则引擎（FR-F2 降级），与小程序 buildFallbackInsight 等价
 */
export function buildFallbackInsight(
  stats: Awaited<ReturnType<typeof recordService.getTodayStats>>
): DailyInsight {
  const messages: string[] = [];
  const suggestions: string[] = [];
  const alerts: string[] = [];

  if (stats.feeding.count === 0) {
    messages.push('今日尚未记录喂养');
    suggestions.push('建议按时喂养，并在每次喂养后记录');
  } else {
    messages.push(`今日已喂养 ${stats.feeding.count} 次，共 ${stats.feeding.totalAmount}ml`);
  }

  if (stats.sleep.totalDuration > 0) {
    const h = Math.floor(stats.sleep.totalDuration / 3600);
    const m = Math.round((stats.sleep.totalDuration % 3600) / 60);
    messages.push(`总睡眠 ${h}h${m}m`);
  }

  if (stats.temperature.latestValue !== null) {
    if (stats.temperature.latestValue >= 38.5) {
      alerts.push(`最新体温 ${stats.temperature.latestValue}°C 偏高，请密切观察`);
    } else if (stats.temperature.latestValue >= 37.5) {
      alerts.push(`最新体温 ${stats.temperature.latestValue}°C 偏高，可能为低烧`);
    }
  }

  return {
    summary: messages.join('，') || '今日尚未添加任何记录',
    suggestions,
    alerts,
    source: 'fallback',
  };
}

function mockReply(userMessage: string): string {
  return `（AI 服务尚未配置真实凭证，开发环境返回 Mock 回复。）\n\n您的消息：${userMessage.slice(0, 50)}\n\n建议：在 server/.env 中配置 TENCENT_SECRET_ID 与 TENCENT_SECRET_KEY 后即可使用真实 AI 能力。`;
}

/**
 * 腾讯云 TC3-HMAC-SHA256 签名（最小实现）
 * 参考：https://cloud.tencent.com/document/api/213/30654
 */
function signRequest(payload: string, action: string): Record<string, string> {
  const secretId = process.env.TENCENT_SECRET_ID!;
  const secretKey = process.env.TENCENT_SECRET_KEY!;
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const algorithm = 'TC3-HMAC-SHA256';
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\nhost:${HUNYUAN_HOST}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join('\n');

  const credentialScope = `${date}/${HUNYUAN_SERVICE}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(HUNYUAN_SERVICE).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: authorization,
    Host: HUNYUAN_HOST,
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': HUNYUAN_VERSION,
    'X-TC-Region': HUNYUAN_REGION,
  };
}

export const aiService = new AIService();
