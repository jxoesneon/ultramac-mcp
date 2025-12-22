/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Enum for standardized error codes in ultramac-mcp
 */
export enum ErrorCode {
  // Authentication Errors
  AUTH_INVALID_KEY = 'AUTH_001',
  AUTH_MISSING_KEY = 'AUTH_002',
  AUTH_RATE_LIMIT_EXCEEDED = 'AUTH_003',

  // Security Errors
  SECURITY_COMMAND_NOT_ALLOWED = 'SEC_001',
  SECURITY_PATH_NOT_ALLOWED = 'SEC_002',
  SECURITY_INVALID_INPUT = 'SEC_003',

  // Tool Errors
  TOOL_EXECUTION_FAILED = 'TOOL_001',
  TOOL_NOT_FOUND = 'TOOL_002',
  TOOL_TIMEOUT = 'TOOL_003',

  // System Errors
  SYSTEM_RESOURCE_ERROR = 'SYS_001',
  SYSTEM_ENVIRONMENT_ERROR = 'SYS_002',
  SYSTEM_SHUTDOWN_IN_PROGRESS = 'SYS_003',

  // Unexpected
  INTERNAL_SERVER_ERROR = 'INT_001'
}

/**
 * Custom error class for ultramac-mcp with machine-readable codes
 */
export class AutomationError extends Error {
  public code: ErrorCode;
  public details?: any;

  constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR, details?: any) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.details = details;
  }

  /**
   * Returns a sanitized object for client consumption
   */
  public toClientObject() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      // We explicitly exclude the stack trace here
      details: this.details
    };
  }
}

/**
 * Utility to sanitize any error for client output
 */
export function sanitizeErrorForClient(error: any): any {
  if (error instanceof AutomationError) {
    return error.toClientObject();
  }

  // Generic error sanitization
  return {
    error: true,
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: error.message || 'An unexpected error occurred',
    // We do NOT include details or stack for unknown errors
  };
}
/**
 * Helper to wrap tool execution with standardized error handling and sanitization
 * Note: This version is for unit testing the logic. 
 * In index.ts, it uses a slightly different version that integrates with winston.
 */
export async function handleToolError(toolName: string, error: any, args?: any): Promise<string> {
  const sanitized = sanitizeErrorForClient(error);
  const codeStr = sanitized.code ? `[${sanitized.code}] ` : '';
  return `${codeStr}Error: ${sanitized.message}`;
}

/**
 * Functional wrapper for catch-all error sanitization
 */
export async function withSanitizedError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error instanceof AutomationError) {
      throw error;
    }
    throw new Error('An internal error occurred during tool execution');
  }
}
