import { isTest } from '../config/env.js';

type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: unknown) => {
  if (isTest && level !== 'error') return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  const stream = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) stream(line);
  else stream(line, meta);
};

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
