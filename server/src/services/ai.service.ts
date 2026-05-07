/**
 * AIService - OpenAI 兼容接入 + 配额管理 + 缓存 + 降级（FR-F）
 *
 * 设计要点：
 * - 走 OpenAI 兼容的 `/v1/chat/completions`（默认：TokenHub · hy3-preview）
 *   端点：https://tokenhub.tencentmaas.com/v1/chat/completions
 *   鉴权：Authorization: Bearer ${OPENAI_API_KEY}
 *   模型：${OPENAI_MODEL}，默认 hy3-preview
 *   原生 fetch（Node 18+），不引入任何 SDK
 * - 缺 `OPENAI_API_KEY` 或 5xx/超时时降级为本地规则引擎（不扣配额）
 * - 配额 upsert 原子自增，超限回滚
 * - 内存 LRU 缓存（按 babyId+date 隔离），24h TTL
 * - 支持真正的流式（SSE）：chatStream 按 OpenAI chunk 协议逐块回调
 *
 * 提供方法：
 * - chat(userId, messages, babyId?)：同步对话
 * - chatStream(userId, messages, babyId?, onChunk)：流式对话
 * - dailyInsight(userId, babyId)：每日洞察（带缓存 + 降级）
 * - getQuotaStatus(userId)：配额查询
 * - consumeQuota(userId) / refundQuota(userId)：配额扣减与回滚
 */
import { prisma } from '../config/database';
import { ForbiddenError, ErrorCodes } from '../types/errors';
import { recordService } from './record.service';
import { startOfDay } from '../utils/date';
import type { ChatMessage, DailyInsight, AIQuotaStatus, CareRole } from '../types';

const DAILY_LIMIT = parseInt(process.env.AI_DAILY_QUOTA ?? '100', 10);

// OpenAI 兼容端点（默认走 TokenHub），可通过环境变量覆盖
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? 'https://tokenhub.tencentmaas.com/v1').replace(/\/+$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'hy3-preview';
const FETCH_TIMEOUT_MS = parseInt(process.env.AI_FETCH_TIMEOUT_MS ?? '30000', 10);

interface CacheEntry {
  value: DailyInsight;
  expireAt: number;
}

class AIService {
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 100;

  /** 是否配置了真实 API Key */
  private get hasCredentials(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  // ============ 主要 API ============

  async chat(
    userId: string,
    messages: ChatMessage[],
    babyId?: string,
    role?: CareRole,
  ): Promise<{ content: string }> {
    await this.consumeQuota(userId);
    try {
      const fullMessages = await this.buildFullMessages(userId, messages, babyId, role);
      const content = await this.callOpenAI(fullMessages);
      return { content };
    } catch (err) {
      // 网络/超时/5xx → 回滚配额
      await this.refundQuota(userId);
      throw err;
    }
  }

  /**
   * 流式对话：按 OpenAI Chat Completions chunk 协议实时回调文本增量
   * onChunk: 每次收到一段增量 content 时触发
   * 抛错时配额已回滚，调用方负责将错误作为 SSE error 事件下发
   */
  async chatStream(
    userId: string,
    messages: ChatMessage[],
    babyId: string | undefined,
    onChunk: (delta: string) => void,
    role?: CareRole,
  ): Promise<{ content: string }> {
    await this.consumeQuota(userId);
    try {
      const fullMessages = await this.buildFullMessages(userId, messages, babyId, role);

      // 无凭证 → 直接 mock 流式
      if (!this.hasCredentials) {
        console.warn('[AIService] OPENAI_API_KEY missing, streaming mock response');
        const mock = mockReply(lastUserContent(messages));
        for (const seg of chunkByChars(mock, 8)) {
          onChunk(seg);
          await sleep(40);
        }
        return { content: mock };
      }

      const content = await this.callOpenAIStream(fullMessages, onChunk);
      return { content };
    } catch (err) {
      await this.refundQuota(userId);
      throw err;
    }
  }

  async dailyInsight(userId: string, babyId: string, role?: CareRole): Promise<DailyInsight> {
    const today = formatDate(new Date());
    // 缓存 key 额外区分 role：不同视角的洞察内容不同，不能共用缓存
    const cacheKey = `daily_insight:${babyId}:${today}:${role ?? 'default'}`;
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

      const prompt = buildInsightPrompt(baby.name, baby.ageMonths, stats, role);
      const systemPrompt = buildRoleSystemPrompt(role, {
        babyName: baby.name,
        ageMonths: baby.ageMonths,
        insightMode: true,
      });

      const content = await this.callOpenAI([
        { role: 'system', content: systemPrompt },
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
      // 网络/超时/5xx → 静默降级（配额已在 callOpenAI 失败前 consume，此处回滚）
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

  // ============ 私有：消息组装 ============

  private async buildFullMessages(
    userId: string,
    messages: ChatMessage[],
    babyId?: string,
    role?: CareRole,
  ): Promise<ChatMessage[]> {
    const baby = babyId ? await this.getBabyContext(userId, babyId) : null;
    const systemPrompt = buildRoleSystemPrompt(role, {
      babyName: baby?.name,
      ageMonths: baby?.ageMonths,
      insightMode: false,
    });
    return [{ role: 'system', content: systemPrompt }, ...messages];
  }

  // ============ 私有：OpenAI 兼容 API 调用 ============

  /**
   * 非流式：POST {base}/chat/completions
   * 缺凭证 / 异常 / 超时时抛错，由调用方决定是否降级
   */
  private async callOpenAI(messages: ChatMessage[]): Promise<string> {
    if (!this.hasCredentials) {
      console.warn('[AIService] OPENAI_API_KEY missing, returning mock response');
      return mockReply(lastUserContent(messages));
    }

    const payload = JSON.stringify({
      model: OPENAI_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      stream: false,
    });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: payload,
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`OpenAI-compatible HTTP ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { code?: string; message?: string };
      };

      if (data.error) {
        throw new Error(`OpenAI-compatible API ${data.error.code ?? ''}: ${data.error.message ?? ''}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI-compatible response missing content');
      return content;
    } catch (err) {
      console.warn('[AIService.callOpenAI] failed', err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 流式：按 OpenAI chunk SSE 协议解析 `data: {...}`，聚合 `choices[0].delta.content`
   */
  private async callOpenAIStream(
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
  ): Promise<string> {
    const payload = JSON.stringify({
      model: OPENAI_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      stream: true,
    });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          ...this.buildHeaders(),
          Accept: 'text/event-stream',
        },
        body: payload,
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => '');
        throw new Error(`OpenAI-compatible stream HTTP ${resp.status}: ${text}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let full = '';

      // SSE 事件分隔：规范允许 \n\n 或 \r\n\r\n
      const findEventEnd = (buf: string): number => {
        const a = buf.indexOf('\n\n');
        const b = buf.indexOf('\r\n\r\n');
        if (a === -1) return b;
        if (b === -1) return a;
        return Math.min(a, b);
      };
      const eventSepLen = (buf: string, idx: number): number =>
        buf.slice(idx, idx + 4) === '\r\n\r\n' ? 4 : 2;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx = findEventEnd(buffer);
        while (idx !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + eventSepLen(buffer, idx));
          idx = findEventEnd(buffer);

          for (const line of rawEvent.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: { delta?: { content?: string } }[];
                error?: { code?: string; message?: string };
              };
              if (parsed.error) {
                throw new Error(
                  `OpenAI-compatible stream error ${parsed.error.code ?? ''}: ${parsed.error.message ?? ''}`,
                );
              }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                onChunk(delta);
              }
            } catch (e) {
              // 单条 chunk 解析失败不终止整体流，打一条警告继续
              console.warn('[AIService.callOpenAIStream] parse chunk failed', dataStr, e);
            }
          }
        }
      }

      if (!full) throw new Error('OpenAI-compatible stream returned empty content');
      return full;
    } catch (err) {
      console.warn('[AIService.callOpenAIStream] failed', err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };
  }

  // ============ 私有：辅助 ============

  private async getBabyContext(
    userId: string,
    babyId: string,
  ): Promise<{ name: string; ageMonths: number } | null> {
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

/**
 * 角色映射到「你是谁 + 你会怎么说话」的视角描述。
 * 不同角色关注点不同，语气 / 称呼 / 建议侧重也不同：
 *  - mom  ：妈妈视角，兼顾宝宝与自身产后/哺乳
 *  - dad  ：爸爸视角，鼓励分担、夜间协作、情感支持
 *  - 祖辈 ：尊重经验，同时用温和语气补充现代科学育儿观点
 *  - nanny：专业护理人员视角，强调交接要点 / 观察指标
 *  - other/未提供：中立育儿顾问
 */
function getRolePersona(role?: CareRole): string {
  switch (role) {
    case 'mom':
      return '你面向的是宝宝的妈妈。回答时兼顾宝宝护理和妈妈自身的恢复/喂奶体验；在涉及母乳、产后情绪、频繁夜醒等话题时给出共情式建议，语气温暖亲切，可以使用"妈妈"作为称呼。';
    case 'dad':
      return '你面向的是宝宝的爸爸。回答时强调如何主动分担（换尿布 / 夜间陪睡 / 哄睡）、如何支持伴侣和理解宝宝信号；语气平实、行动导向、避免说教，可使用"爸爸"作为称呼。';
    case 'grandma_m':
    case 'grandma_p':
      return '你面向的是宝宝的奶奶 / 外婆。回答时尊重祖辈的经验，同时在必要时用温和方式补充现代科学育儿建议（如不要过度包被、夜奶处理、辅食安全等），语气温和，避免评判；可使用"奶奶"或"您"作为称呼。';
    case 'grandpa_m':
    case 'grandpa_p':
      return '你面向的是宝宝的爷爷 / 外公。回答时侧重「可以动手帮什么」、如何与年轻父母配合、避免传统做法带来的风险；语气平实稳重，可使用"爷爷"或"您"作为称呼。';
    case 'nanny':
      return '你面向的是专业月嫂 / 育儿嫂。回答时以专业护理视角展开，侧重可观察指标（吃睡拉量化、体温曲线、异常信号识别）与和家属的交接要点；语气客观中立、条目化。';
    case 'other':
    default:
      return '你是一位中立的专业育儿顾问。请用简洁温暖的中文回答，避免医疗诊断结论。';
  }
}

/**
 * 统一的 system prompt 构造器
 * - insightMode=true ：用于每日洞察（限制 80 字以内）
 * - insightMode=false：用于自由对话
 */
function buildRoleSystemPrompt(
  role: CareRole | undefined,
  ctx: { babyName?: string; ageMonths?: number; insightMode: boolean },
): string {
  const persona = getRolePersona(role);
  const babyLine =
    ctx.babyName && typeof ctx.ageMonths === 'number'
      ? `当前宝宝：${ctx.babyName}，${ctx.ageMonths}个月。`
      : '';
  const styleLine = ctx.insightMode
    ? '请用简洁温暖的中文回复，控制在 80 字以内，避免使用医疗诊断结论。'
    : '回答请简洁实用，避免过长，避免使用医疗诊断结论。';
  return [persona, babyLine, styleLine].filter(Boolean).join(' ');
}

function buildInsightPrompt(
  babyName: string,
  ageMonths: number,
  stats: Awaited<ReturnType<typeof recordService.getTodayStats>>,
  role?: CareRole,
): string {
  const sleepH = Math.floor(stats.sleep.totalDuration / 3600);
  const sleepM = Math.round((stats.sleep.totalDuration % 3600) / 60);
  const audienceHint = getInsightAudienceHint(role);
  return `宝宝 ${babyName}，${ageMonths}个月。今日数据：喂养 ${stats.feeding.count} 次（共 ${stats.feeding.totalAmount}ml）、睡眠 ${sleepH}h${sleepM}m（共 ${stats.sleep.count} 次）、换尿布 ${stats.diaper.count} 次、最新体温 ${stats.temperature.latestValue ?? '--'}°C。${audienceHint}请用 80 字内的自然句子总结今日状态。`;
}

/** 根据阅读对象给出一句话的内容侧重提示（可拼接到 user prompt 中） */
function getInsightAudienceHint(role?: CareRole): string {
  switch (role) {
    case 'mom':
      return '请用「妈妈」视角评价宝宝并附一条对妈妈自身的关怀建议。';
    case 'dad':
      return '请用「爸爸」视角总结，并给一条爸爸今晚可以分担的具体动作。';
    case 'grandma_m':
    case 'grandma_p':
    case 'grandpa_m':
    case 'grandpa_p':
      return '请用祖辈能听懂的温和语言总结，并温和地附一条现代科学育儿小贴士。';
    case 'nanny':
      return '请以专业护理视角总结，并点出一条明日需要重点观察的指标。';
    default:
      return '';
  }
}

/**
 * 将 AI 回复解析为 DailyInsight 结构
 * 简化策略：整段作为 summary；suggestions / alerts 留待后续结构化 prompt 升级
 */
function parseInsight(content: string): DailyInsight {
  const trimmed = content.trim();
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
  stats: Awaited<ReturnType<typeof recordService.getTodayStats>>,
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
  return `（AI 服务尚未配置真实凭证，开发环境返回 Mock 回复。）\n\n您的消息：${userMessage.slice(0, 50)}\n\n建议：在 server/.env 中配置 OPENAI_API_KEY 后即可使用真实 AI 能力。`;
}

function lastUserContent(messages: ChatMessage[]): string {
  return messages.filter((m) => m.role === 'user').pop()?.content ?? '';
}

function chunkByChars(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const aiService = new AIService();
