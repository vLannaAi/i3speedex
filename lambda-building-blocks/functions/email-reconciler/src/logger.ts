/**
 * Structured logger for CloudWatch Logs
 * Outputs JSON-formatted logs for easy parsing and querying
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
  }

  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toUpperCase();
    if (Object.values(LogLevel).includes(normalized as LogLevel)) {
      return normalized as LogLevel;
    }
    return LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      requestId: process.env.AWS_REQUEST_ID,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memoryLimit: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      region: process.env.AWS_REGION
    };

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }
}

export const logger = new Logger();
