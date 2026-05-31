import winston from 'winston';
import path from 'node:path';

let _logger: winston.Logger | null = null;

export function initLogger(dataDir: string) {
  _logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
      }),
    ),
    transports: [
      new winston.transports.Console({ format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
      )}),
      new winston.transports.File({ filename: path.join(dataDir, 'agent.log'), maxsize: 5 * 1024 * 1024, maxFiles: 3 }),
      new winston.transports.File({ filename: path.join(dataDir, 'error.log'), level: 'error', maxsize: 5 * 1024 * 1024, maxFiles: 3 }),
    ],
  });
  return _logger;
}

export function getLogger(): winston.Logger {
  if (!_logger) {
    _logger = winston.createLogger({
      level: 'info',
      transports: [new winston.transports.Console({
        format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.simple()),
      })],
    });
  }
  return _logger;
}

export const logger = new Proxy({} as winston.Logger, {
  get(_target, prop: string | symbol) {
    return (...args: unknown[]) => (getLogger() as never as Record<string | symbol, (...a: unknown[]) => void>)[prop]?.(...args);
  },
});
