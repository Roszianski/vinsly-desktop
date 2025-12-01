/**
 * Centralized error handling utilities for consistent error reporting
 * and user feedback throughout the application.
 */

import { ToastType } from '../components/Toast';

/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
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
  showToast?: (type: ToastType, message: string) => void,
  silent = false
): void {
  const errorMessage = getErrorMessage(error);

  // Always log to console for debugging
  console.error(`Error ${context}:`, error);

  // Show user-friendly toast notification unless silent
  if (showToast && !silent) {
    showToast('error', `Failed ${context}: ${errorMessage}`);
  }
}

/**
 * Wrapper for async operations that ensures errors are properly handled
 * @param fn - The async function to execute
 * @param context - Context about the operation (e.g., "to load theme")
 * @param showToast - Optional toast function for user notification
 * @param silent - If true, don't show toast to user (only log)
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  showToast?: (type: ToastType, message: string) => void,
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
 * Wrapper for async operations with timeout support
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds (default 30s)
 * @param context - Context about the operation
 * @param showToast - Optional toast function for user notification
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
  context: string,
  showToast?: (type: ToastType, message: string) => void
): Promise<T | null> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } catch (error) {
    handleAsyncError(error, context, showToast);
    return null;
  }
}
