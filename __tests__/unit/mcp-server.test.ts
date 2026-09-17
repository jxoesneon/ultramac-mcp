import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPServer } from '../../src/server/mcp-server';
import { FastMCP } from 'fastmcp';

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

    beforeEach(() => {
        vi.clearAllMocks();
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
});
