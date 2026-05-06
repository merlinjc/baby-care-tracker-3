type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatLog(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: unknown) {
    console.log(formatLog('info', message, meta));
  },
  warn(message: string, meta?: unknown) {
    console.warn(formatLog('warn', message, meta));
  },
  error(message: string, meta?: unknown) {
    console.error(formatLog('error', message, meta));
  },
  debug(message: string, meta?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog('debug', message, meta));
    }
  },
};
