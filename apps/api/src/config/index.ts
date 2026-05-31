import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env['PORT'] || '4000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  isDev: (process.env['NODE_ENV'] || 'development') === 'development',

  database: {
    url: process.env['DATABASE_URL'] || 'postgresql://localhost:5432/veyon_aw_dashboard',
  },

  redis: {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env['JWT_SECRET'] || 'dev-secret-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
  },

  veyon: {
    cliPath: process.env['VEYON_CLI_PATH'] || 'veyon-cli',
    apiKey: process.env['VEYON_API_KEY'] || '',
    webapiUrl: process.env['VEYON_WEBAPI_URL'] || 'http://localhost:11080/api/v1',
    privateKeyPath: process.env['VEYON_PRIVATE_KEY_PATH'] || '',
    keyName: process.env['VEYON_KEY_NAME'] || 'dashboard-key',
  },

  activityWatch: {
    apiUrl: process.env['ACTIVITYWATCH_API_URL'] || 'http://localhost:5600/api',
    apiKey: process.env['ACTIVITYWATCH_API_KEY'] || '',
  },

  encryption: {
    key: process.env['ENCRYPTION_KEY'] || 'default-32-char-encryption-key!',
  },

  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  },
} as const;
