/**
 * @registry-id: ErrorTypes
 * @created: 2026-01-15T15:00:00.000Z
 * @last-modified: 2026-01-15T15:00:00.000Z
 * @description: Type-safe error handling utilities
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/** => Type-safe error handling
 * ✓ app/components/** => Type-safe error handling
 */

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Type for API request body validation
 */
export type RequestBody<T> = Partial<T> & Record<string, unknown>;
