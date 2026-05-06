import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { prisma } from './config/database';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import { generalRateLimit } from './middleware/rate-limit';
import routes from './routes';
// FR-E3：注册 patrol 巡检任务（自启动逻辑在模块内部，受 NODE_ENV / PATROL_ENABLED 守卫）
import './utils/patrol';

const app = express();

// ============ Middleware ============
app.use(helmet());
app.use(corsMiddleware);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// ============ Health Check ============
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: dbStatus,
    },
  });
});

// ============ API Routes ============
app.use('/api', generalRateLimit);
app.use('/api', routes);

// ============ 404 Handler ============
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在',
    },
  });
});

// ============ Global Error Handler ============
app.use(errorHandler);

// ============ Start Server ============
const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please kill the existing process or change PORT in .env`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Safety net: prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

export default app;
