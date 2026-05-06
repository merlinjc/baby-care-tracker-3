import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { aiRateLimit } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { aiService } from '../services/ai.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1, '至少一条消息'),
  babyId: z.string().optional(),
});

const dailyInsightSchema = z.object({
  babyId: z.string().min(1, '宝宝ID不能为空'),
});

// POST /api/ai/chat — FR-F1 同步对话
router.post(
  '/chat',
  aiRateLimit,
  validateBody(chatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { messages, babyId } = req.body;
    const result = await aiService.chat(req.userId!, messages, babyId);
    res.json({
      success: true,
      data: { content: result.content },
    });
  }),
);

// POST /api/ai/chat/stream — FR-F4 流式对话（SSE）
router.post(
  '/chat/stream',
  aiRateLimit,
  validateBody(chatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { messages, babyId } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      // 当前实现：先调用同步接口，再切片成 chunk 输出（占位，待真正接入流式 SSE）
      // 这样客户端 EventSource 能正常工作，未来切换到混元 stream API 时无需改 client
      const result = await aiService.chat(req.userId!, messages, babyId);
      const content = result.content;
      const chunkSize = 8;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        await new Promise((r) => setTimeout(r, 50));
      }
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          code: e.code ?? 'AI_SERVICE_UNAVAILABLE',
          message: e.message ?? 'AI 服务不可用',
        })}\n\n`,
      );
      res.end();
    }
  }),
);

// GET /api/ai/insight/daily — FR-F2 每日洞察
router.get(
  '/insight/daily',
  asyncHandler(async (req: Request, res: Response) => {
    const babyId = (req.query.babyId as string) ?? '';
    if (!babyId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: '缺少 babyId' },
      });
      return;
    }
    const insight = await aiService.dailyInsight(req.userId!, babyId);
    res.json({
      success: true,
      data: { insight, date: new Date().toISOString() },
    });
  }),
);

// 兼容旧接口（POST /api/ai/daily-insight）
router.post(
  '/daily-insight',
  validateBody(dailyInsightSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const insight = await aiService.dailyInsight(req.userId!, req.body.babyId);
    res.json({
      success: true,
      data: { insight, date: new Date().toISOString() },
    });
  }),
);

// GET /api/ai/quota — FR-F3 配额查询
router.get(
  '/quota',
  asyncHandler(async (req: Request, res: Response) => {
    const quota = await aiService.getQuotaStatus(req.userId!);
    res.json({
      success: true,
      data: { quota },
    });
  }),
);

export default router;
