/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics for monitoring
 */

// Create a Registry to register metrics
export const register = new Registry();

// Enable collection of default metrics
collectDefaultMetrics({ register });

// Custom metrics

/**
 * Counter: Total tool invocations
 */
export const toolInvocationsTotal = new Counter({
  name: 'ultramac_mcp_tool_invocations_total',
  help: 'Total number of tool invocations',
  labelNames: ['tool_name', 'status'],
  registers: [register]
});

/**
 * Histogram: Tool execution duration
 */
export const toolExecutionDuration = new Histogram({
  name: 'ultramac_mcp_tool_execution_duration_seconds',
  help: 'Tool execution duration in seconds',
  labelNames: ['tool_name'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

/**
 * Counter: Authentication attempts
 */
export const authAttempts = new Counter({
  name: 'ultramac_mcp_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['status'],
  registers: [register]
});

/**
 * Counter: Rate limit violations
 */
export const rateLimitViolations = new Counter({
  name: 'ultramac_mcp_rate_limit_violations_total',
  help: 'Total rate limit violations',
  labelNames: ['client_id'],
  registers: [register]
});

/**
 * Gauge: Active connections
 */
export const activeConnections = new Gauge({
  name: 'ultramac_mcp_active_connections',
  help: 'Number of active MCP connections',
  registers: [register]
});

/**
 * Counter: Errors
 */
export const errorsTotal = new Counter({
  name: 'ultramac_mcp_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'tool'],
  registers: [register]
});

/**
 * Gauge: Action history size
 */
export const actionHistorySize = new Gauge({
  name: 'ultramac_mcp_action_history_size',
  help: 'Number of actions in history',
  registers: [register]
});

/**
 * Gauge: OCR cache size
 */
export const ocrCacheSize = new Gauge({
  name: 'ultramac_mcp_ocr_cache_size',
  help: 'Number of entries in OCR cache',
  registers: [register]
});

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Record a tool invocation
 */
export function recordToolInvocation(toolName: string, durationSeconds: number, success: boolean): void {
  toolInvocationsTotal.inc({ tool_name: toolName, status: success ? 'success' : 'error' });
  toolExecutionDuration.observe({ tool_name: toolName }, durationSeconds);
}

/**
 * Record an authentication attempt
 */
export function recordAuthAttempt(success: boolean): void {
  authAttempts.inc({ status: success ? 'success' : 'failure' });
}

/**
 * Record a rate limit violation
 */
export function recordRateLimitViolation(clientId: string): void {
  rateLimitViolations.inc({ client_id: clientId });
}

/**
 * Record an error
 */
export function recordError(type: string, tool?: string): void {
  errorsTotal.inc({ type, tool: tool || 'unknown' });
}

/**
 * Update cache metrics
 */
export function updateCacheMetrics(actionHistoryCount: number, ocrCacheCount: number): void {
  actionHistorySize.set(actionHistoryCount);
  ocrCacheSize.set(ocrCacheCount);
}
