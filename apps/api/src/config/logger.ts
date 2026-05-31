import winston from 'winston';
import { config } from './index.js';

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'veyon-aw-api' },
  transports: [
    new winston.transports.Console({
      format: config.isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 1
                ? JSON.stringify(meta, null, 2)
                : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            }),
          )
        : winston.format.json(),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
