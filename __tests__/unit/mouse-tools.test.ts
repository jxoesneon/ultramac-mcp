import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mouseTools from '../../src/tools/mouse-tools';
import { MCPServer } from '../../src/server/mcp-server';

// Mock nut.js objects
const mockSetPosition = vi.fn();
const mockMove = vi.fn();
const mockDrag = vi.fn();
const mockClick = vi.fn();
const mockDoubleClick = vi.fn();
const mockScrollDown = vi.fn();
const mockScrollUp = vi.fn();
const mockScrollLeft = vi.fn();
const mockScrollRight = vi.fn();
const mockGetPosition = vi.fn().mockResolvedValue({ x: 100, y: 200 });

const mockNutjs = {
  mouse: {
    setPosition: mockSetPosition,
    move: mockMove,
    drag: mockDrag,
    click: mockClick,
    leftClick: mockClick,
    rightClick: mockClick,
    doubleClick: mockDoubleClick,
    scrollDown: mockScrollDown,
    scrollUp: mockScrollUp,
    scrollLeft: mockScrollLeft,
    scrollRight: mockScrollRight,
    getPosition: mockGetPosition,
    config: {
        mouseSpeed: 1000
    },
    pressButton: vi.fn(),
    releaseButton: vi.fn()
  },
  Point: class {
    constructor(public x: number, public y: number) {}
  },
  Button: {
    LEFT: 'left',
    RIGHT: 'right',
    MIDDLE: 'middle'
  },
  straightTo: vi.fn(),
  centerOf: vi.fn(),
  Region: class { constructor(x: number, y: number, w: number, h: number){} }
};

// Mock the integration layer instead of the package
vi.mock('../../src/server/nutjs-integration', () => ({
    getNutjs: vi.fn(() => mockNutjs),
    requireNutjs: vi.fn(() => mockNutjs)
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

describe('Mouse Tools', () => {
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

    it('should register all mouse tools', () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        expect(registeredTools.has('mouseMove')).toBe(true);
        expect(registeredTools.has('mouseClick')).toBe(true);
        expect(registeredTools.has('click')).toBe(true);
        expect(registeredTools.has('mouseDoubleClick')).toBe(true);
        expect(registeredTools.has('mouseScroll')).toBe(true);
        expect(registeredTools.has('mouseDrag')).toBe(true);
        expect(registeredTools.has('mouseGetPosition')).toBe(true);
        expect(registeredTools.has('mouseButtonControl')).toBe(true);
    });

    it('should execute mouseMove', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseMove');
        await tool.execute({ x: 50, y: 50 });
        expect(mockSetPosition).toHaveBeenCalled();
    });

    it('should execute mouseClick', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseClick');
        await tool.execute({ button: 'left' });
        expect(mockClick).toHaveBeenCalled();
    });

    it('should execute click alias like mouseClick', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('click');
        const result = await tool.execute({ x: 10, y: 20, button: 'right' });
        expect(mockSetPosition).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalledWith('right');
        expect(result).toContain('10, 20');
    });

    it('should execute mouseDoubleClick', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseDoubleClick');
        await tool.execute({});
        expect(mockDoubleClick).toHaveBeenCalled();
    });

    it('should execute mouseScroll', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseScroll');
        await tool.execute({ direction: 'down', amount: 100 });
        expect(mockScrollDown).toHaveBeenCalledWith(100);
        
        await tool.execute({ direction: 'up', amount: 50 });
        expect(mockScrollUp).toHaveBeenCalledWith(50);
    });

    it('should execute mouseDrag', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseDrag');
        await tool.execute({ x: 100, y: 100 });
        expect(mockDrag).toHaveBeenCalled();
    });

    it('should execute mouseGetPosition', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseGetPosition');
        const result = await tool.execute({});
        expect(result).toContain('100, 200');
    });
    
    it('should execute mouseButtonControl', async () => {
        mouseTools.registerMouseTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('mouseButtonControl');
        await tool.execute({ action: 'press', button: 'left' });
        expect(mockNutjs.mouse.pressButton).toHaveBeenCalled();
        
        await tool.execute({ action: 'release', button: 'left' });
        expect(mockNutjs.mouse.releaseButton).toHaveBeenCalled();
    });
});
