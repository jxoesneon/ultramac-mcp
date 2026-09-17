import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPServer } from '../../src/server/mcp-server';
import { FastMCP } from 'fastmcp';
import * as Sentry from '@sentry/node';

// Shared spies
const mockAddTool = vi.fn();
const mockStart = vi.fn();

// Mock FastMCP
vi.mock("fastmcp", () => ({
    FastMCP: vi.fn().mockImplementation(function() {
        return {
            addTool: mockAddTool,
            start: mockStart
        };
    })
}));

// Mock services
vi.mock("../../src/services/image-service", () => ({
    initializeImageService: vi.fn()
}));
vi.mock("../../src/services/ocr-service", () => ({
    initializeOCRService: vi.fn()
}));
vi.mock("../../src/core/health", () => ({
    registerHealthEndpoints: vi.fn()
}));

// Mock Sentry
vi.mock("@sentry/node", () => ({
    init: vi.fn(),
    withScope: vi.fn((cb: any) => cb({ setTags: vi.fn(), setExtra: vi.fn() })),
    captureException: vi.fn()
}));

// Mock security utils
vi.mock('../../src/core/security-utils', () => ({
    RateLimiter: class {
        isAllowed() { return true; }
        reset() {}
        getCount() { return 0; }
    },
    sanitizeIdentifier: vi.fn(x => x)
}));

describe('MCPServer', () => {
    let server: MCPServer;
    const originalArgv = process.argv;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.argv = originalArgv;
        delete process.env.SENTRY_DSN;
        delete process.env.PORT;
        delete process.env.ULTRAMAC_MCP_DISABLE_AUTH;
    });

    it('should initialize correctly', () => {
        server = new MCPServer();
        expect(FastMCP).toHaveBeenCalled();
    });

    it('should add tools and wrap execution', async () => {
        server = new MCPServer();
        const executeSpy = vi.fn().mockResolvedValue("success");
        const tool = {
            name: 'testTool',
            description: 'desc',
            parameters: {} as any,
            execute: executeSpy
        };
        server.addTool(tool);
        
        expect(mockAddTool).toHaveBeenCalled();

        // Verify interceptor logic by calling the tool's execute method which was mutated
        const result = await tool.execute({ arg: 1 }, {});
        expect(result).toBe("success");
        expect(executeSpy).toHaveBeenCalled();
    });

    it('should handle tool execution errors', async () => {
        server = new MCPServer();
        const executeSpy = vi.fn().mockRejectedValue(new Error("failure"));
        const tool = {
            name: 'failTool',
            description: 'desc',
            parameters: {} as any,
            execute: executeSpy
        };
        server.addTool(tool);
        
        // Execute and expect JSON error string as per interceptor logic
        const result = await tool.execute({}, {});
        expect(result).toContain("error");
    });

    it('should get registry', () => {
        server = new MCPServer();
        const registry = server.getRegistry();
        expect(registry).toBeDefined();
    });

    it('should start server', async () => {
         server = new MCPServer();
         await server.start();
         
         expect(mockStart).toHaveBeenCalled();
    });

    it('should categorize tools by name', () => {
        server = new MCPServer();
        expect(server.categorizeTool('mouseClick')).toBe('mouse');
        expect(server.categorizeTool('click')).toBe('mouse');
        expect(server.categorizeTool('keyControl')).toBe('keyboard');
        expect(server.categorizeTool('screenshot')).toBe('vision');
        expect(server.categorizeTool('element_contains_text')).toBe('vision');
        expect(server.categorizeTool('assert_element_exists')).toBe('vision');
        expect(server.categorizeTool('systemCommand')).toBe('admin');
        expect(server.categorizeTool('sleep')).toBe('admin');
        expect(server.categorizeTool('recent_process_logs')).toBe('admin');
        expect(server.categorizeTool('list_windows')).toBe('admin');
        expect(server.categorizeTool('click_element')).toBe('automation');
        expect(server.categorizeTool('type_into_element')).toBe('automation');
        expect(server.categorizeTool('click_in_window')).toBe('automation');
        expect(server.categorizeTool('someOther')).toBe('automation');
    });

    it('should only register tools in the selected categories (token efficiency)', () => {
        server = new MCPServer('UltraMac MCP', '1.0.0', ['mouse']);
        const mouseTool = { name: 'mouseClick', description: 'd', parameters: {} as any, execute: vi.fn() };
        const keyTool = { name: 'keyControl', description: 'd', parameters: {} as any, execute: vi.fn() };
        server.addTool(mouseTool);
        server.addTool(keyTool);
        const registry = server.getRegistry();
        expect(registry.has('mouseClick')).toBe(true);
        expect(registry.has('keyControl')).toBe(false);
    });

    it('should provide an authenticate callback when not stdio and auth enabled', async () => {
        process.argv = [originalArgv[0]!, originalArgv[1]!];
        server = new MCPServer();

        const options = vi.mocked(FastMCP).mock.calls.at(-1)![0] as any;
        expect(typeof options.authenticate).toBe('function');

        // authMiddleware allows the request in non-production without a key
        const result = await options.authenticate({ headers: {} });
        expect(result).toEqual({});
    });

    it('should not provide an authenticate callback when using stdio', () => {
        process.argv = [...process.argv, '--stdio'];
        server = new MCPServer();

        const options = vi.mocked(FastMCP).mock.calls.at(-1)![0] as any;
        expect(options.authenticate).toBeUndefined();
    });

    it('should not provide an authenticate callback when auth is disabled', () => {
        process.argv = [originalArgv[0]!, originalArgv[1]!];
        process.env.ULTRAMAC_MCP_DISABLE_AUTH = 'true';
        server = new MCPServer();

        const options = vi.mocked(FastMCP).mock.calls.at(-1)![0] as any;
        expect(options.authenticate).toBeUndefined();
    });

    it('should report tool errors to Sentry when SENTRY_DSN is set', async () => {
        process.env.SENTRY_DSN = 'https://fake@sentry.example/123';
        server = new MCPServer();
        const executeSpy = vi.fn().mockRejectedValue(new Error('sentry boom'));
        const tool = {
            name: 'sentryFailTool',
            description: 'desc',
            parameters: {} as any,
            execute: executeSpy
        };
        server.addTool(tool);

        const result = await tool.execute({ x: 1 }, {});
        expect(result).toContain('error');
        expect(Sentry.withScope).toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should start with stdio transport when --stdio is passed', async () => {
        process.argv = [...process.argv, '--stdio'];
        server = new MCPServer();
        await server.start();

        expect(mockStart).toHaveBeenCalledWith({ transportType: 'stdio' });
    });

    it('should start with httpStream transport on the configured PORT', async () => {
        process.argv = [originalArgv[0]!, originalArgv[1]!];
        process.env.PORT = '4567';
        server = new MCPServer();
        await server.start();

        expect(mockStart).toHaveBeenCalledWith({
            transportType: 'httpStream',
            httpStream: { port: 4567 }
        });
    });
});
