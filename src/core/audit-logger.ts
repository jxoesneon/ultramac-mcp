/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import winston from 'winston';
import path from 'path';
import os from 'os';

/**
 * Audit Logger for security and compliance
 * Logs all tool invocations with timestamps in structured JSON format
 */

// Log directory setup - use user home if /var/log not accessible
const LOG_DIR = path.join(os.homedir(), '.ultramac-mcp', 'logs');

// Ensure log directory exists
import fs from 'fs';
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 }); // User-only permissions
}

// Configure Winston logger
export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ultramac-mcp',
    hostname: os.hostname(),
    pid: process.pid
  },
  transports: [
    // Audit log - JSON format, daily rotation
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 30, // Keep 30 days
      tailable: true
    }),
    // Error log - separate file for errors only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 30
    })
  ]
});

// Add console output for development (can be disabled in production)
if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log a tool invocation for audit trail
 */
export function logToolInvocation(
  toolName: string,
  args: Record<string, any>,
  result: any,
  durationMs: number,
  success: boolean = true
): void {
  auditLogger.info('Tool invocation', {
    event: 'tool_invocation',
    tool: toolName,
    args: sanitizeArgsForLogging(args),
    success,
    duration_ms: durationMs,
    result_summary: typeof result === 'string' 
      ? result.substring(0, 200) 
      : JSON.stringify(result).substring(0, 200)
  });
}

/**
 * Log a security event
 */
export function logSecurityEvent(
  eventType: string,
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): void {
  auditLogger.warn('Security event', {
    event: 'security',
    type: eventType,
    severity,
    ...details
  });
}

/**
 * Log an error
 */
export function logError(
  context: string,
  error: Error | string,
  additionalData?: Record<string, any>
): void {
  auditLogger.error('Error occurred', {
    event: 'error',
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error,
    ...additionalData
  });
}

/**
 * Sanitize arguments for logging (remove sensitive data)
 */
function sanitizeArgsForLogging(args: Record<string, any>): Record<string, any> {
  const sanitized = { ...args };
  
  // Remove potentially sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'credential'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Get audit log location for user reference
 */
export function getAuditLogPath(): string {
  return path.join(LOG_DIR, 'audit.log');
}

// Log startup
auditLogger.info('Audit logger initialized', {
  event: 'startup',
  log_directory: LOG_DIR,
  node_version: process.version,
  platform: process.platform
});
