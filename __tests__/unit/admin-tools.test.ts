import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as adminTools from '../../src/tools/admin-tools';
import { MCPServer } from '../../src/server/mcp-server';
import { actionLogger } from '../../src/core/action-logger';
import { getMetrics } from '../../src/core/metrics';

// Mock the action logger singleton
vi.mock('../../src/core/action-logger', () => ({
    actionLogger: {
        log: vi.fn(),
        getHistory: vi.fn(),
        getById: vi.fn(),
        removeRecord: vi.fn(),
        clear: vi.fn()
    },
    ActionLogger: class {}
}));

// Mock the metrics module (prom-client registry)
vi.mock('../../src/core/metrics', () => ({
    register: { metrics: vi.fn() },
    getMetrics: vi.fn(),
    recordToolInvocation: vi.fn(),
    recordAuthAttempt: vi.fn(),
    recordRateLimitViolation: vi.fn(),
    recordError: vi.fn(),
    updateCacheMetrics: vi.fn(),
    toolInvocationsTotal: { inc: vi.fn() },
    toolExecutionDuration: { observe: vi.fn() },
    authAttempts: { inc: vi.fn() },
    rateLimitViolations: { inc: vi.fn() },
    activeConnections: { inc: vi.fn(), dec: vi.fn(), set: vi.fn() },
    errorsTotal: { inc: vi.fn() },
    actionHistorySize: { set: vi.fn() },
    ocrCacheSize: { set: vi.fn() }
}));

const mockGetHistory = vi.mocked(actionLogger.getHistory);
const mockGetById = vi.mocked(actionLogger.getById);
const mockClear = vi.mocked(actionLogger.clear);
const mockGetMetrics = vi.mocked(getMetrics);

const RECORD = {
    id: 'abc123',
    timestamp: 1700000000000,
    tool: 'mouseMove',
    args: { x: 5, y: 6 },
    result: 'moved',
    duration: 12,
    success: true
};

describe('Admin Tools', () => {
    let mockServer: any;
    let registeredTools: Map<string, any>;
    let registry: Map<string, any>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetMetrics.mockResolvedValue('# HELP metrics');
        mockGetHistory.mockReturnValue([]);
        mockGetById.mockReturnValue(undefined);
        registeredTools = new Map();
        registry = new Map();
        mockServer = {
            addTool: vi.fn((tool) => {
                registeredTools.set(tool.name, tool);
            }),
            getRegistry: vi.fn(() => registry)
        };
        adminTools.registerAdminTools(mockServer as unknown as MCPServer);
    });

    it('should register all admin tools', () => {
        expect(registeredTools.has('metrics')).toBe(true);
        expect(registeredTools.has('get_action_history')).toBe(true);
        expect(registeredTools.has('replay_action')).toBe(true);
        expect(registeredTools.has('clear_action_history')).toBe(true);
    });

    it('metrics should return prometheus metrics', async () => {
        const tool = registeredTools.get('metrics');
        const result = await tool.execute({});
        expect(mockGetMetrics).toHaveBeenCalled();
        expect(result).toBe('# HELP metrics');
    });

    it('metrics should propagate registry errors', async () => {
        mockGetMetrics.mockRejectedValue(new Error('registry fail'));
        const tool = registeredTools.get('metrics');
        await expect(tool.execute({})).rejects.toThrow('registry fail');
    });

    it('get_action_history should return formatted JSON with a limit', async () => {
        mockGetHistory.mockReturnValue([RECORD]);
        const tool = registeredTools.get('get_action_history');
        const result = await tool.execute({ limit: 10 });
        expect(mockGetHistory).toHaveBeenCalledWith(10);
        const parsed = JSON.parse(result);
        expect(parsed.count).toBe(1);
        expect(parsed.actions[0].id).toBe('abc123');
        expect(parsed.actions[0].tool).toBe('mouseMove');
        expect(parsed.actions[0].args).toEqual({ x: 5, y: 6 });
        expect(parsed.actions[0].success).toBe(true);
        expect(parsed.actions[0].duration).toBe('12ms');
        expect(parsed.actions[0].timestamp).toBe(new Date(1700000000000).toISOString());
        expect(parsed.actions[0].result).toBe('moved');
    });

    it('get_action_history should work without a limit', async () => {
        mockGetHistory.mockReturnValue([RECORD]);
        const tool = registeredTools.get('get_action_history');
        const result = await tool.execute({});
        expect(mockGetHistory).toHaveBeenCalledWith(undefined);
        expect(JSON.parse(result).count).toBe(1);
    });

    it('get_action_history should truncate long string results and pass through non-strings', async () => {
        const longResult = 'x'.repeat(500);
        mockGetHistory.mockReturnValue([
            { ...RECORD, result: longResult },
            { ...RECORD, id: 'def456', result: { complex: true } }
        ]);
        const tool = registeredTools.get('get_action_history');
        const result = await tool.execute({});
        const parsed = JSON.parse(result);
        expect(parsed.count).toBe(2);
        expect(parsed.actions[0].result).toBe('x'.repeat(200));
        expect(parsed.actions[1].result).toEqual({ complex: true });
    });

    it('get_action_history should propagate logger errors', async () => {
        mockGetHistory.mockImplementation(() => {
            throw new Error('history broken');
        });
        const tool = registeredTools.get('get_action_history');
        await expect(tool.execute({})).rejects.toThrow('history broken');
    });

    it('replay_action should report unknown action IDs', async () => {
        const tool = registeredTools.get('replay_action');
        const result = await tool.execute({ id: 'missing' });
        expect(result).toBe('Action record "missing" not found.');
    });

    it('replay_action should report when the recorded tool is not registered', async () => {
        mockGetById.mockReturnValue({ ...RECORD, tool: 'ghostTool' });
        const tool = registeredTools.get('replay_action');
        const result = await tool.execute({ id: 'abc123' });
        expect(result).toBe('Tool "ghostTool" is not registered.');
    });

    it('replay_action should re-execute the recorded tool and return its result', async () => {
        const replayTool = { name: 'mouseMove', execute: vi.fn().mockResolvedValue('moved ok') };
        registry.set('mouseMove', replayTool);
        mockGetById.mockReturnValue(RECORD);
        const tool = registeredTools.get('replay_action');
        const result = await tool.execute({ id: 'abc123' });
        expect(mockGetById).toHaveBeenCalledWith('abc123');
        expect(replayTool.execute).toHaveBeenCalledWith({ x: 5, y: 6 }, {});
        expect(result).toContain('Replay Result:');
        expect(result).toContain('moved ok');
    });

    it('replay_action should propagate tool execution errors', async () => {
        const replayTool = { name: 'mouseMove', execute: vi.fn().mockRejectedValue(new Error('replay fail')) };
        registry.set('mouseMove', replayTool);
        mockGetById.mockReturnValue(RECORD);
        const tool = registeredTools.get('replay_action');
        await expect(tool.execute({ id: 'abc123' })).rejects.toThrow('replay fail');
    });

    it('clear_action_history should clear and confirm', async () => {
        const tool = registeredTools.get('clear_action_history');
        const result = await tool.execute({});
        expect(mockClear).toHaveBeenCalled();
        expect(result).toBe('Action history cleared.');
    });
});
