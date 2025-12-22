import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performHealthCheck, livenessProbe, readinessProbe, registerHealthEndpoints } from '../../src/core/health';

describe('Health Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should perform health check and return healthy status', async () => {
    const health = await performHealthCheck();
    expect(health.status).toBe('healthy');
  });

  it('should return liveness result', async () => {
    const liveness = await livenessProbe();
    expect(liveness.alive).toBe(true);
  });

  it('should return readiness result based on health', async () => {
    const readiness = await readinessProbe();
    expect(readiness.ready).toBe(true);
  });

  it('should register and execute health endpoints', async () => {
    const mockServer = {
      addTool: vi.fn()
    };
    registerHealthEndpoints(mockServer as any);
    
    // Get the execute functions
    const healthTool = mockServer.addTool.mock.calls.find(call => call[0].name === 'health')![0];
    const livenessTool = mockServer.addTool.mock.calls.find(call => call[0].name === 'liveness')![0];
    const readinessTool = mockServer.addTool.mock.calls.find(call => call[0].name === 'readiness')![0];
    
    // Execute them
    const healthResult = await healthTool.execute();
    expect(JSON.parse(healthResult).status).toBe('healthy');
    
    // Use optional chaining/assertion for test simplicity
    const livenessResult = await livenessTool?.execute();
    expect(JSON.parse(livenessResult).alive).toBe(true);
    
    const readinessResult = await readinessTool?.execute();
    expect(JSON.parse(readinessResult).ready).toBe(true);
  });

  it('should handle filesystem check failure', async () => {
    // Mock fs/promises to throw
    vi.doMock('fs/promises', () => ({
      access: vi.fn().mockRejectedValue(new Error('EACCES')),
      constants: { W_OK: 2 }
    }));
    
    // Re-import to apply mock? 
    // performHealthCheck imports fs/promises dynamically: `const fs = await import('fs/promises');`
    // So vi.doMock should work if we reset modules or if it's dynamic.
    
    const health = await performHealthCheck();
    // Use assertion or optional chaining
    expect(health.checks['filesystem']?.status).toBe('fail');
    expect(health.status).not.toBe('healthy'); // degraded or unhealthy
    
    vi.doUnmock('fs/promises');
  });

  it('should handle high memory usage', async () => {
    const os = await import('os');
    const totalMem = os.totalmem();
    
    // Force 90% usage
    const highUsage = Math.floor(totalMem * 0.9);
    
    // Mock process.memoryUsage
    const originalMemoryUsage = process.memoryUsage;
    
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: highUsage,
      rss: highUsage + 1000,
      heapTotal: highUsage + 1000,
      external: 0,
      arrayBuffers: 0
    });
    
    const health = await performHealthCheck();
    expect(health.checks['memory']?.status).toBe('fail');
    
    // Restore
    // process.memoryUsage is a function on the global process object.
    // vi.spyOn mocks it. vi.restoreAllMocks() (called in beforeEach) checks this?
    // But here we are IN the test. We should restore if it affects others?
    // beforeEach calls vi.resetAllMocks (or clearAllMocks).
    // I should use `vi.restoreAllMocks()` or rely on beforeEach.
    // The previous error was unrelated to restore.
    
    // NOTE: PerformHealthCheck uses `os.totalmem()`.
  });
});
