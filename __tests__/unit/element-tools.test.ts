import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as elementTools from '../../src/tools/element-tools';
import { MCPServer } from '../../src/server/mcp-server';
import { findElement } from '../../src/services/ui-service';
import { openWindows } from 'get-windows';

// Mock nut.js objects
const mockSetPosition = vi.fn();
const mockClick = vi.fn();
const mockType = vi.fn();

const mockNutjs = {
  mouse: {
    setPosition: mockSetPosition,
    click: mockClick,
  },
  keyboard: {
    type: mockType,
  },
  Point: class {
    constructor(public x: number, public y: number) {}
  },
  Button: {
    LEFT: 'left',
    RIGHT: 'right',
    MIDDLE: 'middle'
  },
};

// Mock the integration layer instead of the package
vi.mock('../../src/server/nutjs-integration', () => ({
    getNutjs: vi.fn(() => mockNutjs),
    requireNutjs: vi.fn(() => mockNutjs)
}));

// Mock the UI query service — tests control found / not-found results
vi.mock('../../src/services/ui-service', () => ({
    findElement: vi.fn(),
}));

// Mock window enumeration (must be a static import target for vi.mock)
vi.mock('get-windows', () => ({
    openWindows: vi.fn(),
}));

// Mock security utils to avoid delays or side effects
vi.mock('../../src/core/security-utils', () => ({
    safeExecSync: vi.fn(),
    sanitizeShellArg: vi.fn(x => x),
    RateLimiter: class {
        isAllowed() { return true; }
        reset() {}
        getCount() { return 0; }
    },
    sanitizeIdentifier: vi.fn(x => x),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    isAlphanumericSafe: vi.fn(() => true)
}));

const mockFindElement = vi.mocked(findElement);
const mockOpenWindows = vi.mocked(openWindows);

describe('Element Tools', () => {
    let mockServer: any;
    let registeredTools: Map<string, any>;

    beforeEach(() => {
        vi.clearAllMocks();
        registeredTools = new Map();
        mockServer = {
            addTool: vi.fn((tool) => {
                registeredTools.set(tool.name, tool);
            })
        };
    });

    it('should register all element tools', () => {
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        expect(registeredTools.has('click_element')).toBe(true);
        expect(registeredTools.has('type_into_element')).toBe(true);
        expect(registeredTools.has('click_in_window')).toBe(true);
    });

    it('click_element calls findElement with the target and clicks the computed center', async () => {
        mockFindElement.mockResolvedValue({
            found: true,
            position: [100, 200],
            size: [20, 10],
            name: 'Save',
            role: 'AXButton',
        });
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_element');
        const result = await tool.execute({
            criteria: 'Save',
            role: 'AXButton',
            process: 'Safari',
            pid: 42,
            window: 'Main',
            button: 'left',
        });
        expect(mockFindElement).toHaveBeenCalledWith('Save', 'AXButton', {
            process: 'Safari',
            pid: 42,
            window: 'Main',
        });
        expect(mockSetPosition).toHaveBeenCalledWith(
            expect.objectContaining({ x: 110, y: 205 })
        );
        expect(mockClick).toHaveBeenCalledWith('left');
        expect(result).toBe("Clicked 'Save' (AXButton) at (110, 205).");
    });

    it('click_element omits the target when no selectors are given', async () => {
        mockFindElement.mockResolvedValue({
            found: true,
            position: [0, 0],
            size: [10, 10],
            name: 'OK',
            role: 'AXButton',
        });
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_element');
        await tool.execute({ criteria: 'OK', button: 'left' });
        expect(mockFindElement).toHaveBeenCalledWith('OK', undefined, undefined);
    });

    it('click_element returns a not-found message without clicking', async () => {
        mockFindElement.mockResolvedValue({ found: false, error: 'ax_timeout' });
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_element');
        const result = await tool.execute({ criteria: 'Nope', button: 'left' });
        expect(result).toContain('Element not found: Nope');
        expect(result).toContain('ax_timeout');
        expect(mockSetPosition).not.toHaveBeenCalled();
        expect(mockClick).not.toHaveBeenCalled();
    });

    it('type_into_element clicks to focus then types the text', async () => {
        mockFindElement.mockResolvedValue({
            found: true,
            position: [50, 60],
            size: [100, 20],
            name: 'Search field',
            role: 'AXTextField',
        });
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('type_into_element');
        const result = await tool.execute({ criteria: 'search', text: 'hello' });
        expect(mockSetPosition).toHaveBeenCalledWith(
            expect.objectContaining({ x: 100, y: 70 })
        );
        expect(mockClick).toHaveBeenCalledWith('left');
        expect(mockType).toHaveBeenCalledWith('hello');
        expect(result).toBe("Typed 5 chars into 'Search field'.");
    });

    it('type_into_element returns a not-found message without typing', async () => {
        mockFindElement.mockResolvedValue({ found: false });
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('type_into_element');
        const result = await tool.execute({ criteria: 'missing', text: 'abc' });
        expect(result).toContain('Element not found: missing');
        expect(mockType).not.toHaveBeenCalled();
    });

    it('click_in_window translates window-relative coordinates to screen coordinates', async () => {
        mockOpenWindows.mockResolvedValue([
            {
                title: 'Main',
                id: 1,
                bounds: { x: 100, y: 50, width: 800, height: 600 },
                owner: { name: 'Safari', processId: 42, bundleId: 'com.apple.Safari' },
            },
        ] as any);
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_in_window');
        const result = await tool.execute({ x: 10, y: 20, window: 'main', button: 'left' });
        expect(mockSetPosition).toHaveBeenCalledWith(
            expect.objectContaining({ x: 110, y: 70 })
        );
        expect(mockClick).toHaveBeenCalledWith('left');
        expect(result).toBe("Clicked at window-relative (10, 20) → screen (110, 70) in 'Main'.");
    });

    it('click_in_window selects the Nth window of a matching process', async () => {
        mockOpenWindows.mockResolvedValue([
            {
                title: 'Doc A',
                id: 1,
                bounds: { x: 0, y: 0, width: 400, height: 300 },
                owner: { name: 'Editor', processId: 7, bundleId: 'com.example.Editor' },
            },
            {
                title: 'Doc B',
                id: 2,
                bounds: { x: 500, y: 100, width: 400, height: 300 },
                owner: { name: 'Editor', processId: 7, bundleId: 'com.example.Editor' },
            },
            {
                title: 'Other',
                id: 3,
                bounds: { x: 0, y: 0, width: 100, height: 100 },
                owner: { name: 'OtherApp', processId: 9, bundleId: 'com.example.Other' },
            },
        ] as any);
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_in_window');
        const result = await tool.execute({ x: 5, y: 5, window: 1, process: 'editor', button: 'right' });
        expect(mockSetPosition).toHaveBeenCalledWith(
            expect.objectContaining({ x: 505, y: 105 })
        );
        expect(mockClick).toHaveBeenCalledWith('right');
        expect(result).toContain("in 'Doc B'");
    });

    it('click_in_window matches by pid', async () => {
        mockOpenWindows.mockResolvedValue([
            {
                title: 'Target',
                id: 1,
                bounds: { x: 10, y: 10, width: 100, height: 100 },
                owner: { name: 'App', processId: 123, bundleId: 'com.example.App' },
            },
            {
                title: 'Decoy',
                id: 2,
                bounds: { x: 0, y: 0, width: 100, height: 100 },
                owner: { name: 'App', processId: 456, bundleId: 'com.example.App' },
            },
        ] as any);
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_in_window');
        const result = await tool.execute({ x: 1, y: 2, window: 0, pid: 123, button: 'left' });
        expect(mockSetPosition).toHaveBeenCalledWith(
            expect.objectContaining({ x: 11, y: 12 })
        );
        expect(result).toContain("in 'Target'");
    });

    it('click_in_window rejects coordinates outside window bounds', async () => {
        mockOpenWindows.mockResolvedValue([
            {
                title: 'Main',
                id: 1,
                bounds: { x: 100, y: 50, width: 800, height: 600 },
                owner: { name: 'Safari', processId: 42, bundleId: 'com.apple.Safari' },
            },
        ] as any);
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_in_window');
        const result = await tool.execute({ x: 900, y: 20, window: 'main', button: 'left' });
        expect(result).toContain('outside window bounds');
        expect(mockSetPosition).not.toHaveBeenCalled();
        expect(mockClick).not.toHaveBeenCalled();
    });

    it('click_in_window returns a not-found message when no window matches', async () => {
        mockOpenWindows.mockResolvedValue([
            {
                title: 'Unrelated',
                id: 1,
                bounds: { x: 0, y: 0, width: 100, height: 100 },
                owner: { name: 'App', processId: 1, bundleId: 'com.example.App' },
            },
        ] as any);
        elementTools.registerElementTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click_in_window');
        const result = await tool.execute({ x: 0, y: 0, window: 'does not exist', button: 'left' });
        expect(result).toContain('Window not found');
        expect(mockSetPosition).not.toHaveBeenCalled();
        expect(mockClick).not.toHaveBeenCalled();
    });
});
