import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QMS Dashboard API',
      version: '1.0.0',
      description: 'REST API for classroom management (Veyon) and activity monitoring (ActivityWatch) with agent-based computer control.',
      contact: {
        name: 'QMS Team',
      },
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        Computer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            hostname: { type: 'string' },
            ipAddress: { type: 'string' },
            macAddress: { type: 'string' },
            roomId: { type: 'string' },
            status: { type: 'string', enum: ['online', 'offline', 'locked', 'sleeping'] },
            currentUser: { type: 'string' },
            os: { type: 'string' },
            veyonVersion: { type: 'string' },
            source: { type: 'string', enum: ['agent', 'veyon'] },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login',
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
          responses: { '200': { description: 'JWT token' } },
        },
      },
      '/api/computers': {
        get: {
          tags: ['Computers'],
          summary: 'List all computers',
          parameters: [
            { name: 'roomId', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Computer list' } },
        },
        post: {
          tags: ['Computers'],
          summary: 'Create a computer',
          security: [{ bearerAuth: ['admin', 'staff'] }],
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/computers/{id}': {
        get: { tags: ['Computers'], summary: 'Get computer by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Computer detail' } } },
        patch: { tags: ['Computers'], summary: 'Update computer', security: [{ bearerAuth: ['admin', 'staff'] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Computers'], summary: 'Delete computer', security: [{ bearerAuth: ['admin'] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
      },
      '/api/computers/{id}/scan': {
        post: { tags: ['Computers'], summary: 'Scan computer status', security: [{ bearerAuth: ['admin', 'staff'] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Status result' } } },
      },
      '/api/rooms': {
        get: { tags: ['Rooms'], summary: 'List rooms', responses: { '200': { description: 'Room list' } } },
        post: { tags: ['Rooms'], summary: 'Create room', security: [{ bearerAuth: ['admin'] }], responses: { '201': { description: 'Created' } } },
      },
      '/api/veyon/screen/lock': {
        post: { tags: ['Veyon'], summary: 'Lock computer screens', security: [{ bearerAuth: ['admin', 'staff'] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { computerIds: { type: 'array', items: { type: 'string' } } } } } } }, responses: { '200': { description: 'Lock result (agent-queued or direct)' } } },
      },
      '/api/veyon/screen/unlock': {
        post: { tags: ['Veyon'], summary: 'Unlock computer screens', security: [{ bearerAuth: ['admin', 'staff'] }], responses: { '200': { description: 'Unlock result' } } },
      },
      '/api/veyon/screen/{computerId}': {
        get: { tags: ['Veyon'], summary: 'Get screenshot', security: [{ bearerAuth: ['admin', 'staff'] }], parameters: [{ name: 'computerId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Screenshot base64 PNG' } } },
      },
      '/api/veyon/message': {
        post: { tags: ['Veyon'], summary: 'Send message to computers', security: [{ bearerAuth: ['admin', 'staff'] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { computerIds: { type: 'array', items: { type: 'string' } }, message: { type: 'string' }, title: { type: 'string' } } } } } }, responses: { '200': { description: 'Message result' } } },
      },
      '/api/veyon/power/restart': { post: { tags: ['Veyon'], summary: 'Restart computers', security: [{ bearerAuth: ['admin', 'staff'] }], responses: { '200': { description: 'Restart result' } } } },
      '/api/veyon/power/shutdown': { post: { tags: ['Veyon'], summary: 'Shutdown computers', security: [{ bearerAuth: ['admin', 'staff'] }], responses: { '200': { description: 'Shutdown result' } } } },
      '/api/activity/buckets': { get: { tags: ['ActivityWatch'], summary: 'List AW buckets', responses: { '200': { description: 'Bucket list' } } } },
      '/api/activity/events': { get: { tags: ['ActivityWatch'], summary: 'Get events', responses: { '200': { description: 'Events' } } } },
      '/api/activity/metrics': { get: { tags: ['ActivityWatch'], summary: 'Productivity metrics', responses: { '200': { description: 'Metrics' } } } },
      '/api/activity/summary': { get: { tags: ['ActivityWatch'], summary: 'Daily summary', responses: { '200': { description: 'Summary' } } } },
      '/api/dashboard/stats': { get: { tags: ['Dashboard'], summary: 'Dashboard stats', responses: { '200': { description: 'Stats with Redis cache support' } } } },
      '/api/dashboard/recent-activity': { get: { tags: ['Dashboard'], summary: 'Recent activity', responses: { '200': { description: 'Activity data' } } } },
      '/api/users': { get: { tags: ['Users'], summary: 'List users (admin)', security: [{ bearerAuth: ['admin'] }], responses: { '200': { description: 'User list' } } } },
      '/api/settings': {
        get: { tags: ['Settings'], summary: 'Get settings', security: [{ bearerAuth: ['admin'] }], responses: { '200': { description: 'Settings' } } },
        put: { tags: ['Settings'], summary: 'Update settings', security: [{ bearerAuth: ['admin'] }], responses: { '200': { description: 'Updated' } } },
      },
      '/api/notifications': { get: { tags: ['Notifications'], summary: 'Get notifications', responses: { '200': { description: 'Notifications' } } } },
      '/api/notifications/{id}/read': { put: { tags: ['Notifications'], summary: 'Mark notification read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Marked' } } } },
      '/api/notifications/read-all': { post: { tags: ['Notifications'], summary: 'Mark all notifications read', responses: { '200': { description: 'All marked' } } } },
      '/api/watch-rules': { get: { tags: ['Watch Rules'], summary: 'List watch rules', responses: { '200': { description: 'Rules' } } } },
      '/api/audit-logs': { get: { tags: ['Audit Logs'], summary: 'Get audit logs', responses: { '200': { description: 'Logs' } } } },
      '/api/v1/agent/register': { post: { tags: ['Agent'], summary: 'Register agent', responses: { '200': { description: 'Agent token' } } } },
      '/api/v1/agent/heartbeat': { post: { tags: ['Agent'], summary: 'Agent heartbeat', responses: { '200': { description: 'Acknowledged' } } } },
      '/api/v1/agent/commands': { get: { tags: ['Agent'], summary: 'Get pending commands', responses: { '200': { description: 'Command list' } } } },
      '/api/v1/agent/commands/{id}/result': { post: { tags: ['Agent'], summary: 'Report command result', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Acknowledged' } } } },
      '/api/v1/agent/veyon-config': { get: { tags: ['Agent'], summary: 'Get Veyon configuration for agent', responses: { '200': { description: 'Veyon config with private key' } } } },
      '/api/health': { get: { tags: ['System'], summary: 'Health check', responses: { '200': { description: 'OK' } } } },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
