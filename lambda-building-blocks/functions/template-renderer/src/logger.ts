/**
 * Structured logging for CloudWatch Logs Insights
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private requestId?: string;

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.requestId && { requestId: this.requestId }),
      ...data,
    };

    console.log(JSON.stringify(entry));
  }

  debug(message: string, data?: any): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      this.log('DEBUG', message, data);
    }
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  error(message: string, error?: any, data?: any): void {
    this.log('ERROR', message, {
      ...data,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          ...error,
        },
      }),
    });
  }
}

export const logger = new Logger();
