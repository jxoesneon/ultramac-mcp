/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import os from 'os';
import { auditLogger } from './audit-logger';

/**
 * Health check module for monitoring and load balancer integration
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      message?: string;
      responseTime?: number;
    };
  };
}

let serverStartTime = Date.now();

/**
 * Reset server start time (for testing)
 */
export function resetStartTime(): void {
  serverStartTime = Date.now();
}

/**
 * Perform health checks
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {};

  // 1. Memory check
  const memoryCheck = Date.now();
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const usedMemPercent = (memUsage.heapUsed / totalMem) * 100;
  
  checks.memory = {
    status: usedMemPercent < 80 ? 'pass' : 'fail',
    message: `${Math.round(usedMemPercent)}% used (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB)`,
    responseTime: Date.now() - memoryCheck
  };

  // 2. Filesystem check (log directory writable)
  const fsCheck = Date.now();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const logDir = path.join(os.homedir(), '.ultramac-mcp', 'logs');
    await fs.access(logDir, fs.constants.W_OK);
    checks.filesystem = {
      status: 'pass',
      message: 'Log directory writable',
      responseTime: Date.now() - fsCheck
    };
  } catch (e) {
    checks.filesystem = {
      status: 'fail',
      message: 'Log directory not writable',
      responseTime: Date.now() - fsCheck
    };
  }

  // 3. Process health
  const processCheck = Date.now();
  const cpuUsage = process.cpuUsage();
  checks.process = {
    status: 'pass',
    message: `PID ${process.pid}, CPU: ${Math.round(cpuUsage.user / 1000)}ms user`,
    responseTime: Date.now() - processCheck
  };

  // Determine overall status
  const failedChecks = Object.values(checks).filter(c => c.status === 'fail');
  const status: HealthStatus['status'] = 
    failedChecks.length === 0 ? 'healthy' :
    failedChecks.length < Object.keys(checks).length ? 'degraded' :
    'unhealthy';

  const uptime = (Date.now() - serverStartTime) / 1000;

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime),
    version: process.env.npm_package_version || '1.0.0',
    checks
  };
}

/**
 * Liveness probe - returns 200 if process is alive
 * Used by Kubernetes/Docker to restart unhealthy containers
 */
export async function livenessProbe(): Promise<{ alive: boolean }> {
  // Simple check: if we can respond, we're alive
  return { alive: true };
}

/**
 * Readiness probe - returns 200 if ready to accept traffic
 * Used by load balancers to route traffic
 */
export async function readinessProbe(): Promise<{ ready: boolean; reason?: string }> {
  try {
    const health = await performHealthCheck();
    
    // Ready if healthy or degraded (but not unhealthy)
    const ready = health.status !== 'unhealthy';
    
    return {
      ready,
      reason: ready ? undefined : 'Health checks failing'
    };
  } catch (e) {
    return {
      ready: false,
      reason: `Health check error: ${e}`
    };
  }
}

/**
 * Register health endpoints with FastMCP server
 */
export function registerHealthEndpoints(server: FastMCP<any>): void {
  // Main health endpoint
  server.addTool({
    name: 'health',
    description: 'Get server health status',
    parameters: z.object({}),
    execute: async () => {
      const health = await performHealthCheck();
      auditLogger.info('Health check performed', {
        event: 'health_check',
        status: health.status
      });
      return JSON.stringify(health, null, 2);
    }
  });

  // Liveness probe
  server.addTool({
    name: 'liveness',
    description: 'Liveness probe for container orchestration',
    parameters: z.object({}),
    execute: async () => {
      const result = await livenessProbe();
      return JSON.stringify(result);
    }
  });

  // Readiness probe
  server.addTool({
    name: 'readiness',
    description: 'Readiness probe for load balancers',
    parameters: z.object({}),
    execute: async () => {
      const result = await readinessProbe();
      return JSON.stringify(result);
    }
  });
}
