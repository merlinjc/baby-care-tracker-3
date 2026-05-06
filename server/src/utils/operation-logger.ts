/**
 * OperationLogger - 关键写操作的可追溯日志（FR-E1）
 *
 * 设计原则：
 * - 写入失败不阻断主业务流程（catch + console.warn）
 * - 支持 4 种状态流转：started → succeeded / partial / failed
 * - 步骤式累积：start() → step(name, status, data)+ → succeed/partial/fail()
 * - 支持 resume(id)：从已存在的 OperationLog 中恢复 logger 实例（用于
 *   deleteBaby cursor 续传，FR-E5）
 *
 * 用法：
 *   const logger = await new OperationLogger('joinFamily', userId, { inviteCode }).start();
 *   logger.step('validate_code', 'ok');
 *   logger.step('add_member', 'ok', { membershipId });
 *   await logger.succeed({ familyId });
 */
import { prisma } from '../config/database';

export type StepStatus = 'ok' | 'skip' | 'fail';
export type LogStatus = 'started' | 'succeeded' | 'partial' | 'failed';

export interface OperationStep {
  step: string;
  status: StepStatus;
  data?: unknown;
  ts: number;
}

export class OperationLogger {
  private id?: string;
  private steps: OperationStep[] = [];
  private startedAt = new Date();

  constructor(
    public readonly action: string,
    public readonly userId?: string,
    public readonly context?: Record<string, unknown>
  ) {}

  /**
   * 从已存在的 OperationLog 恢复一个 logger（用于 cursor 续传）
   * 已有的 steps 会被加载到内存，后续 step() 会追加
   */
  static async resume(id: string): Promise<OperationLogger | null> {
    try {
      const log = await prisma.operationLog.findUnique({ where: { id } });
      if (!log || log.status !== 'started') return null;
      const ctx = log.context
        ? safeParseJson<Record<string, unknown>>(log.context) ?? undefined
        : undefined;
      const logger = new OperationLogger(log.action, log.userId ?? undefined, ctx);
      logger.id = log.id;
      logger.startedAt = log.startedAt;
      logger.steps = log.steps ? safeParseJson<OperationStep[]>(log.steps) ?? [] : [];
      return logger;
    } catch (err) {
      console.warn('[OperationLogger.resume] failed to load log', id, err);
      return null;
    }
  }

  /**
   * 查找最新一个 status='started' 的同 action + context.babyId 日志（cursor 续传场景）
   */
  static async findOngoing(action: string, babyId: string): Promise<OperationLogger | null> {
    try {
      const log = await prisma.operationLog.findFirst({
        where: {
          action,
          status: 'started',
          context: { contains: `"babyId":"${babyId}"` },
        },
        orderBy: { startedAt: 'desc' },
      });
      if (!log) return null;
      return OperationLogger.resume(log.id);
    } catch (err) {
      console.warn('[OperationLogger.findOngoing] query failed', err);
      return null;
    }
  }

  async start(): Promise<this> {
    if (this.id) return this; // already started
    try {
      const log = await prisma.operationLog.create({
        data: {
          action: this.action,
          userId: this.userId,
          context: this.context ? JSON.stringify(this.context) : null,
          status: 'started',
          startedAt: this.startedAt,
        },
      });
      this.id = log.id;
    } catch (err) {
      console.warn(`[OperationLogger.start] failed to log ${this.action}`, err);
    }
    return this;
  }

  step(name: string, status: StepStatus, data?: unknown): void {
    this.steps.push({ step: name, status, data, ts: Date.now() });
  }

  /** 仅刷新 steps 到 DB，不关闭日志（cursor 续传中间态） */
  async flushSteps(): Promise<void> {
    if (!this.id) return;
    try {
      await prisma.operationLog.update({
        where: { id: this.id },
        data: { steps: JSON.stringify(this.steps) },
      });
    } catch (err) {
      console.warn('[OperationLogger.flushSteps] failed', err);
    }
  }

  async succeed(result?: unknown): Promise<void> {
    if (!this.id) return;
    try {
      await prisma.operationLog.update({
        where: { id: this.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          steps: JSON.stringify(this.steps),
          result: result === undefined ? null : JSON.stringify(result),
        },
      });
    } catch (err) {
      console.warn('[OperationLogger.succeed] failed', err);
    }
  }

  async fail(reason: string, error?: Error): Promise<void> {
    if (!this.id) return;
    try {
      await prisma.operationLog.update({
        where: { id: this.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          steps: JSON.stringify(this.steps),
          reason,
          error: error
            ? JSON.stringify({ message: error.message, stack: error.stack })
            : null,
        },
      });
    } catch (err) {
      console.warn('[OperationLogger.fail] failed', err);
    }
  }

  async partial(reason: string, result?: unknown): Promise<void> {
    if (!this.id) return;
    try {
      await prisma.operationLog.update({
        where: { id: this.id },
        data: {
          status: 'partial',
          finishedAt: new Date(),
          steps: JSON.stringify(this.steps),
          reason,
          result: result === undefined ? null : JSON.stringify(result),
        },
      });
    } catch (err) {
      console.warn('[OperationLogger.partial] failed', err);
    }
  }

  /** 暴露 id 给上层（patrol 等场景需要） */
  get logId(): string | undefined {
    return this.id;
  }

  /** 累计某个 step 类型的 data 数值（用于 cursor 续传统计） */
  reduceStepData<T extends number>(stepPrefix: string, key: string, init: T = 0 as T): T {
    return this.steps
      .filter((s) => s.step.startsWith(stepPrefix))
      .reduce<T>((sum, s) => {
        const val = (s.data as Record<string, unknown> | undefined)?.[key];
        return typeof val === 'number' ? ((sum + val) as T) : sum;
      }, init);
  }
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
