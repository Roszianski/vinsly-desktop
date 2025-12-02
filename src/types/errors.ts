/**
 * Structured error types for consistent error handling throughout the application.
 * Each error code maps to a specific error category with appropriate user messaging.
 */

/**
 * Error codes used throughout the application.
 * These provide structured categorization for error handling and recovery.
 */
export type AppErrorCode =
  // File operations
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'FILE_READ_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'FILE_PERMISSION_DENIED'
  | 'INVALID_FILE_FORMAT'
  // Network operations
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'API_ERROR'
  // License operations
  | 'LICENSE_INVALID'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_REVOKED'
  | 'LICENSE_DEVICE_LIMIT'
  | 'LICENSE_VALIDATION_FAILED'
  // Data operations
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_ENTRY'
  | 'NOT_FOUND'
  // Cache operations
  | 'CACHE_ERROR'
  | 'CACHE_EXPIRED'
  // General
  | 'UNKNOWN_ERROR'
  | 'OPERATION_CANCELLED';

/**
 * Recovery action that can be presented to users
 */
export interface ErrorRecoveryAction {
  label: string;
  action: () => void;
}

/**
 * Structured application error with code, message, and optional recovery actions
 */
export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: string;
  recoveryActions?: ErrorRecoveryAction[];
  originalError?: unknown;
}

/**
 * Custom error class for structured errors
 */
export class StructuredError extends Error {
  code: AppErrorCode;
  details?: string;
  recoveryActions?: ErrorRecoveryAction[];
  originalError?: unknown;

  constructor(error: AppError) {
    super(error.message);
    this.name = 'StructuredError';
    this.code = error.code;
    this.details = error.details;
    this.recoveryActions = error.recoveryActions;
    this.originalError = error.originalError;
  }

  toAppError(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoveryActions: this.recoveryActions,
      originalError: this.originalError,
    };
  }
}

/**
 * Default user-friendly messages for each error code
 */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  // File operations
  FILE_NOT_FOUND: 'The requested file could not be found',
  FILE_TOO_LARGE: 'The file exceeds the maximum allowed size',
  FILE_READ_ERROR: 'Unable to read the file',
  FILE_WRITE_ERROR: 'Unable to save the file',
  FILE_PERMISSION_DENIED: 'Permission denied to access the file',
  INVALID_FILE_FORMAT: 'The file format is not supported',
  // Network operations
  NETWORK_ERROR: 'Unable to connect to the server',
  TIMEOUT: 'The operation took too long and timed out',
  SERVER_ERROR: 'The server encountered an error',
  API_ERROR: 'The API request failed',
  // License operations
  LICENSE_INVALID: 'The license key is invalid',
  LICENSE_EXPIRED: 'Your license has expired',
  LICENSE_REVOKED: 'Your license has been revoked',
  LICENSE_DEVICE_LIMIT: 'Maximum device limit reached for this license',
  LICENSE_VALIDATION_FAILED: 'Unable to validate your license',
  // Data operations
  PARSE_ERROR: 'Unable to parse the data',
  VALIDATION_ERROR: 'The data is invalid',
  DUPLICATE_ENTRY: 'An item with this name already exists',
  NOT_FOUND: 'The requested item was not found',
  // Cache operations
  CACHE_ERROR: 'Unable to access cached data',
  CACHE_EXPIRED: 'Cached data has expired',
  // General
  UNKNOWN_ERROR: 'An unexpected error occurred',
  OPERATION_CANCELLED: 'The operation was cancelled',
};

/**
 * Create an AppError with default message if not provided
 */
export function createAppError(
  code: AppErrorCode,
  options?: {
    message?: string;
    details?: string;
    recoveryActions?: ErrorRecoveryAction[];
    originalError?: unknown;
  }
): AppError {
  return {
    code,
    message: options?.message ?? ERROR_MESSAGES[code],
    details: options?.details,
    recoveryActions: options?.recoveryActions,
    originalError: options?.originalError,
  };
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof StructuredError) {
    return error.toAppError();
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return createAppError('TIMEOUT', { originalError: error, details: error.message });
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return createAppError('NETWORK_ERROR', { originalError: error, details: error.message });
    }
    if (error.message.includes('permission')) {
      return createAppError('FILE_PERMISSION_DENIED', { originalError: error, details: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('No such file')) {
      return createAppError('FILE_NOT_FOUND', { originalError: error, details: error.message });
    }
    if (error.message.includes('parse') || error.message.includes('JSON')) {
      return createAppError('PARSE_ERROR', { originalError: error, details: error.message });
    }

    return createAppError('UNKNOWN_ERROR', {
      message: error.message,
      originalError: error,
    });
  }

  if (typeof error === 'string') {
    return createAppError('UNKNOWN_ERROR', { message: error });
  }

  return createAppError('UNKNOWN_ERROR', { originalError: error });
}

/**
 * Check if an error is a specific error code
 */
export function isErrorCode(error: unknown, code: AppErrorCode): boolean {
  if (error instanceof StructuredError) {
    return error.code === code;
  }
  const appError = toAppError(error);
  return appError.code === code;
}
