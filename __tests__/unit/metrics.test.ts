import { describe, it, expect, vi } from 'vitest';
import { getMetrics, recordToolInvocation, recordAuthAttempt, recordRateLimitViolation, recordError, updateCacheMetrics } from '../../src/core/metrics';

describe('Metrics Module', () => {
  it('should return prometheus metrics string', async () => {
    const metrics = await getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('ultramac_mcp_tool_invocations_total');
    expect(metrics).toContain('ultramac_mcp_tool_execution_duration_seconds');
  });

  it('should record tool invocation', async () => {
    recordToolInvocation('test-tool', 0.5, true);
    const metrics = await getMetrics();
    expect(metrics).toContain('tool_name="test-tool"');
    expect(metrics).toContain('status="success"');
  });

  it('should record auth attempts', async () => {
    recordAuthAttempt(true);
    recordAuthAttempt(false);
    const metrics = await getMetrics();
    expect(metrics).toContain('status="success"');
    expect(metrics).toContain('status="failure"');
  });

  it('should record rate limit violations', async () => {
    recordRateLimitViolation('client-1');
    const metrics = await getMetrics();
    expect(metrics).toContain('client_id="client-1"');
  });

  it('should record errors', async () => {
    recordError('type-A', 'tool-X');
    const metrics = await getMetrics();
    expect(metrics).toContain('type="type-A"');
    expect(metrics).toContain('tool="tool-X"');
  });

  it('should update cache metrics', async () => {
    updateCacheMetrics(100, 200);
    const metrics = await getMetrics();
    expect(metrics).toContain('ultramac_mcp_action_history_size 100');
    expect(metrics).toContain('ultramac_mcp_ocr_cache_size 200');
  });
});
