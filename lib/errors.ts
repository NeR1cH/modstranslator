/**
 * Centralized error handling with typed errors
 */

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Translation-related errors
 */
export class TranslationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'TRANSLATION_ERROR', 500, details);
  }
}

/**
 * API-related errors (DeepL)
 */
export class ApiError extends AppError {
  constructor(message: string, statusCode: number, details?: any) {
    super(message, 'API_ERROR', statusCode, details);
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

/**
 * Quota exceeded errors
 */
export class QuotaExceededError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'QUOTA_EXCEEDED', 456, details);
  }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', 403, details);
  }
}

/**
 * File parsing errors
 */
export class ParseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'PARSE_ERROR', 400, details);
  }
}

/**
 * Security errors
 */
export class SecurityError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'SECURITY_ERROR', 403, details);
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', 500, details);
  }
}

/**
 * File system errors
 */
export class FileSystemError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'FILE_SYSTEM_ERROR', 500, details);
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', 500, { originalError: error });
  }

  return new AppError('Unknown error occurred', 'UNKNOWN_ERROR', 500, { error });
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode >= 500 || error.statusCode === 429;
  }
  return false;
}
