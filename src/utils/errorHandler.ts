/**
 * Centralized error handling utilities for consistent error reporting
 * and user feedback throughout the application.
 */

import { ToastType, ToastAction } from '../components/Toast';
import {
  AppError,
  AppErrorCode,
  toAppError,
  createAppError,
  StructuredError,
} from '../types/errors';
import { devLog } from './devLogger';

// Re-export types and utilities for convenience
export type { AppError, AppErrorCode } from '../types/errors';
export { createAppError, StructuredError, toAppError } from '../types/errors';

/**
 * Toast function type with optional action support
 */
export type ShowToastFn = (
  type: ToastType,
  message: string,
  duration?: number,
  action?: ToastAction
) => void;

/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof StructuredError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Handle async errors with consistent logging and toast notifications
 * @param error - The error that occurred
 * @param context - Context about where the error occurred (e.g., "loading agents")
 * @param showToast - Optional toast function for user notification
 * @param silent - If true, don't show toast to user (only log)
 */
export function handleAsyncError(
  error: unknown,
  context: string,
  showToast?: ShowToastFn,
  silent = false
): AppError {
  const appError = toAppError(error);

  // Always log to console for debugging (without sensitive data)
  devLog.error(`Error ${context}:`, {
    code: appError.code,
    message: appError.message,
    details: appError.details,
  });

  // Show user-friendly toast notification unless silent
  if (showToast && !silent) {
    const action = appError.recoveryActions?.[0]
      ? { label: appError.recoveryActions[0].label, onClick: appError.recoveryActions[0].action }
      : undefined;
    showToast('error', `Failed ${context}: ${appError.message}`, undefined, action);
  }

  return appError;
}

/**
 * Handle errors with recovery actions shown in toast
 * @param error - The error or AppError
 * @param showToast - Toast function
 * @param duration - Optional toast duration (defaults to 5000ms for errors with actions)
 */
export function handleErrorWithRecovery(
  error: AppError | unknown,
  showToast: ShowToastFn,
  duration?: number
): void {
  const appError = 'code' in (error as AppError) ? (error as AppError) : toAppError(error);

  const action = appError.recoveryActions?.[0]
    ? { label: appError.recoveryActions[0].label, onClick: appError.recoveryActions[0].action }
    : undefined;

  // Errors with actions should stay longer
  const toastDuration = duration ?? (action ? 5000 : 3000);

  showToast('error', appError.message, toastDuration, action);
}

/**
 * Create and show an error with a retry action
 * @param code - Error code
 * @param message - Error message
 * @param retryFn - Function to retry the operation
 * @param showToast - Toast function
 */
export function showRetryableError(
  code: AppErrorCode,
  message: string,
  retryFn: () => void,
  showToast: ShowToastFn
): void {
  const appError = createAppError(code, {
    message,
    recoveryActions: [{ label: 'Retry', action: retryFn }],
  });
  handleErrorWithRecovery(appError, showToast);
}

/**
 * Result type for operations that may fail
 */
export type OperationResult<T> =
  | { success: true; result: T; error: null }
  | { success: false; result: null; error: AppError };

/**
 * Wrapper for async operations that ensures errors are properly handled
 * Returns the result or null for backward compatibility
 * @param fn - The async function to execute
 * @param context - Context about the operation (e.g., "to load theme")
 * @param showToast - Optional toast function for user notification
 * @param silent - If true, don't show toast to user (only log)
 * @returns The result of the function, or null if an error occurred
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  showToast?: ShowToastFn,
  silent = false
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleAsyncError(error, context, showToast, silent);
    return null;
  }
}

/**
 * Enhanced wrapper that returns both result and error information
 * @param fn - The async function to execute
 * @param context - Context about the operation
 * @param showToast - Optional toast function for user notification
 * @param silent - If true, don't show toast to user (only log)
 * @returns OperationResult with success status, result, and error details
 */
export async function withErrorHandlingDetailed<T>(
  fn: () => Promise<T>,
  context: string,
  showToast?: ShowToastFn,
  silent = false
): Promise<OperationResult<T>> {
  try {
    const result = await fn();
    return { success: true, result, error: null };
  } catch (error) {
    const appError = handleAsyncError(error, context, showToast, silent);
    return { success: false, result: null, error: appError };
  }
}

/**
 * Wrapper for async operations with timeout support
 * Returns the result or null for backward compatibility
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds (default 30s)
 * @param context - Context about the operation
 * @param showToast - Optional toast function for user notification
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
  context: string,
  showToast?: ShowToastFn
): Promise<T | null> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutError = new StructuredError(
      createAppError('TIMEOUT', {
        message: `Operation timed out after ${timeoutMs}ms`,
        details: context,
      })
    );
    setTimeout(() => reject(timeoutError), timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } catch (error) {
    handleAsyncError(error, context, showToast);
    return null;
  }
}

/**
 * Enhanced wrapper with timeout that returns both result and error information
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds (default 30s)
 * @param context - Context about the operation
 * @param showToast - Optional toast function for user notification
 */
export async function withTimeoutDetailed<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
  context: string,
  showToast?: ShowToastFn
): Promise<OperationResult<T>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutError = new StructuredError(
      createAppError('TIMEOUT', {
        message: `Operation timed out after ${timeoutMs}ms`,
        details: context,
      })
    );
    setTimeout(() => reject(timeoutError), timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return { success: true, result, error: null };
  } catch (error) {
    const appError = handleAsyncError(error, context, showToast);
    return { success: false, result: null, error: appError };
  }
}
