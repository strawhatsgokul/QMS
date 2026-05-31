import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { authRouter } from './routes/auth.js';
import { computersRouter } from './routes/computers.js';
import { roomsRouter } from './routes/rooms.js';
import { activityRouter } from './routes/activity.js';
import { veyonRouter } from './routes/veyon.js';
import { usersRouter } from './routes/users.js';
import { dashboardRouter } from './routes/dashboard.js';
import { settingsRouter } from './routes/settings.js';
import { logsRouter } from './routes/logs.js';
import { auditLogsRouter } from './routes/audit-logs.js';
import { notificationsRouter } from './routes/notifications.js';
import { watchRulesRouter } from './routes/watch-rules.js';
import { alertsRouter } from './routes/alerts.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfCheck } from './middleware/csrf.js';
import { authenticate } from './middleware/auth.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import cron from 'node-cron';
import { deleteOldLogs } from './services/auditLog.js';
import { seedDemoNotifications } from './services/notification.service.js';
import { alertMonitorService } from './services/alertMonitor.service.js';

const app = express();
const httpServer = createServer(app);

export const prisma = new PrismaClient();

const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
  },
});

app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(csrfCheck);
morgan.token('body', (req: express.Request) => {
  if (req.method === 'GET' || req.method === 'DELETE') return '';
  const body = (req as express.Request & { body: unknown }).body;
  if (!body || typeof body !== 'object') return '';
  const sanitized = { ...body as Record<string, unknown> };
  if (sanitized.password) sanitized.password = '***';
  if (sanitized.newPassword) sanitized.newPassword = '***';
  if (sanitized.privateKey) sanitized.privateKey = '***';
  return JSON.stringify(sanitized).slice(0, 500);
});
app.use(morgan(':method :url :status :res[content-length] - :response-time ms :body', { stream: { write: (msg: string) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'QMS Dashboard API',
}));

app.get('/api/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/computers', authenticate, computersRouter);
app.use('/api/rooms', authenticate, roomsRouter);
app.use('/api/activity', authenticate, activityRouter);
app.use('/api/veyon', authenticate, veyonRouter);
app.use('/api/users', authenticate, usersRouter);
app.use('/api/dashboard', authenticate, dashboardRouter);
app.use('/api/settings', authenticate, settingsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/audit-logs', authenticate, auditLogsRouter);
app.use('/api/notifications', authenticate, notificationsRouter);
app.use('/api/watch-rules', authenticate, watchRulesRouter);
app.use('/api/alerts', authenticate, alertsRouter);

app.use(errorHandler);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe:computer', (computerId: string) => {
    socket.join(`computer:${computerId}`);
  });

  socket.on('subscribe:room', (roomId: string) => {
    socket.join(`room:${roomId}`);
  });

  socket.on('unsubscribe:computer', (computerId: string) => {
    socket.leave(`computer:${computerId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

export { io };

httpServer.listen(config.port, () => {
  logger.info(`API server running on port ${config.port}`);
  logger.info(`Health check: http://localhost:${config.port}/api/health`);

  cron.schedule('0 3 * * *', async () => {
    logger.info('Running scheduled audit log cleanup...');
    await deleteOldLogs();
  });
  logger.info('Cron: audit log cleanup scheduled daily at 3:00 AM');

  // Seed demo notifications for all users on first run
  prisma.user.findMany().then((users) => {
    for (const user of users) {
      prisma.notification.count({ where: { userId: user.id } }).then((count) => {
        if (count === 0) {
          seedDemoNotifications(user.id).then((n) => {
            logger.info(`Seeded ${n} demo notifications for ${user.email}`);
          });
        }
      });
    }
  });

  // Seed default watch rules if none exist
  prisma.watchRule.count().then((count) => {
    if (count === 0) {
      const defaults = [
        { name: 'Social Media', pattern: 'facebook', category: 'entertainment', severity: 'warning' },
        { name: 'Social Media', pattern: 'instagram', category: 'entertainment', severity: 'warning' },
        { name: 'Social Media', pattern: 'twitter', category: 'entertainment', severity: 'warning' },
        { name: 'Social Media', pattern: 'reddit', category: 'entertainment', severity: 'warning' },
        { name: 'Streaming', pattern: 'youtube', category: 'entertainment', severity: 'warning' },
        { name: 'Streaming', pattern: 'netflix', category: 'entertainment', severity: 'error' },
        { name: 'Gaming', pattern: 'game', category: 'entertainment', severity: 'warning' },
        { name: 'Gaming', pattern: 'steam', category: 'entertainment', severity: 'error' },
        { name: 'Chat', pattern: 'whatsapp', category: 'communication', severity: 'info' },
        { name: 'Chat', pattern: 'telegram', category: 'communication', severity: 'info' },
        { name: 'Shopping', pattern: 'amazon', category: 'entertainment', severity: 'warning' },
        { name: 'Shopping', pattern: 'flipkart', category: 'entertainment', severity: 'warning' },
        { name: 'Mail', pattern: 'gmail', category: 'communication', severity: 'warning' },
        { name: 'Mail', pattern: 'outlook', category: 'productivity', severity: 'info' },
      ];
      prisma.watchRule.createMany({ data: defaults }).then((r) => {
        logger.info(`Seeded ${r.count} default watch rules`);
        alertMonitorService.start();
      });
    } else {
      alertMonitorService.start();
    }
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
});
