import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as automationTools from '../../src/tools/automation-tools';
import { MCPServer } from '../../src/server/mcp-server';
import { safeExecSync } from '../../src/core/security-utils';

// Mock nut.js objects
const mockNutjs = {
  mouse: {
    move: vi.fn(),
    setPosition: vi.fn()
  },
  keyboard: {
    type: vi.fn(),
    pressKey: vi.fn(),
    releaseKey: vi.fn()
  },
  Point: class {
    constructor(public x: number, public y: number) {}
  },
  Key: {
    LeftSuper: 'KEY_LeftSuper',
    LeftControl: 'KEY_LeftControl',
    C: 'KEY_C',
    V: 'KEY_V',
    X: 'KEY_X',
    Z: 'KEY_Z',
    A: 'KEY_A',
    S: 'KEY_S'
  }
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

const mockSafeExecSync = vi.mocked(safeExecSync);

const isMac = process.platform === 'darwin';
const CMD_KEY = isMac ? 'KEY_LeftSuper' : 'KEY_LeftControl';
const itMac = isMac ? it : it.skip;

const KEY_LETTER: Record<string, string> = {
    copy: 'KEY_C',
    paste: 'KEY_V',
    cut: 'KEY_X',
    undo: 'KEY_Z',
    selectAll: 'KEY_A',
    save: 'KEY_S'
};

const withPlatform = (platform: string, fn: () => Promise<void>) => {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    return fn().finally(() => {
        if (descriptor) Object.defineProperty(process, 'platform', descriptor);
    });
};

describe('Automation Tools', () => {
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
        automationTools.registerAutomationTools(mockServer as unknown as MCPServer);
    });

    it('should register all automation tools', () => {
        expect(registeredTools.has('sleep')).toBe(true);
        expect(registeredTools.has('mouseMovePath')).toBe(true);
        expect(registeredTools.has('systemCommand')).toBe(true);
    });

    it('should sleep for the requested time', async () => {
        const tool = registeredTools.get('sleep');
        const result = await tool.execute({ ms: 5 });
        expect(result).toBe('Slept for 5 milliseconds');
    });

    it('should sleep with fake timers', async () => {
        vi.useFakeTimers();
        try {
            const tool = registeredTools.get('sleep');
            const promise = tool.execute({ ms: 1000 });
            await vi.advanceTimersByTimeAsync(1000);
            const result = await promise;
            expect(result).toBe('Slept for 1000 milliseconds');
        } finally {
            vi.useRealTimers();
        }
    });

    it('should move the mouse along a coordinate path', async () => {
        const tool = registeredTools.get('mouseMovePath');
        const result = await tool.execute({ path: [0, 0, 10, 20, 30, 40] });
        expect(mockNutjs.mouse.move).toHaveBeenCalledTimes(1);
        const points = mockNutjs.mouse.move.mock.calls[0]![0];
        expect(points).toHaveLength(3);
        expect(points[0]).toMatchObject({ x: 0, y: 0 });
        expect(points[1]).toMatchObject({ x: 10, y: 20 });
        expect(points[2]).toMatchObject({ x: 30, y: 40 });
        expect(result).toBe('Moved along path with 3 points');
    });

    it('should move along an empty path', async () => {
        const tool = registeredTools.get('mouseMovePath');
        const result = await tool.execute({ path: [] });
        expect(mockNutjs.mouse.move).toHaveBeenCalledWith([]);
        expect(result).toBe('Moved along path with 0 points');
    });

    it('should throw when the path has an odd number of coordinates', async () => {
        const tool = registeredTools.get('mouseMovePath');
        await expect(tool.execute({ path: [1, 2, 3] }))
            .rejects.toThrow('Path must be even (x,y pairs)');
        expect(mockNutjs.mouse.move).not.toHaveBeenCalled();
    });

    it.each(['copy', 'paste', 'cut', 'undo', 'selectAll', 'save'])(
        'systemCommand should execute "%s" via keyboard shortcut',
        async (command) => {
            const tool = registeredTools.get('systemCommand');
            const result = await tool.execute({ command });
            expect(mockNutjs.keyboard.pressKey).toHaveBeenCalledWith(CMD_KEY, KEY_LETTER[command]);
            expect(mockNutjs.keyboard.releaseKey).toHaveBeenCalledWith(CMD_KEY, KEY_LETTER[command]);
            expect(result).toBe(`Executed ${command}`);
        }
    );

    itMac.each(['redo', 'quit', 'minimize', 'switchApp', 'newTab', 'closeTab'])(
        'systemCommand should execute "%s" via AppleScript on macOS',
        async (command) => {
            const tool = registeredTools.get('systemCommand');
            const result = await tool.execute({ command });
            expect(mockSafeExecSync).toHaveBeenCalledWith(
                'osascript',
                ['-e', expect.stringContaining('tell application "System Events"')]
            );
            expect(result).toBe(`Executed ${command} via AppleScript`);
        }
    );

    it('systemCommand should propagate AppleScript failures', async () => {
        if (!isMac) return;
        mockSafeExecSync.mockImplementationOnce(() => {
            throw new Error('exec denied');
        });
        const tool = registeredTools.get('systemCommand');
        await expect(tool.execute({ command: 'quit' })).rejects.toThrow('exec denied');
    });

    it('systemCommand should use LeftControl as the modifier on non-macOS', async () => {
        await withPlatform('linux', async () => {
            const tool = registeredTools.get('systemCommand');
            const result = await tool.execute({ command: 'copy' });
            expect(mockNutjs.keyboard.pressKey).toHaveBeenCalledWith('KEY_LeftControl', 'KEY_C');
            expect(mockNutjs.keyboard.releaseKey).toHaveBeenCalledWith('KEY_LeftControl', 'KEY_C');
            expect(result).toBe('Executed copy');
        });
    });

    it('systemCommand should throw for AppleScript-only commands on non-macOS', async () => {
        await withPlatform('linux', async () => {
            const tool = registeredTools.get('systemCommand');
            await expect(tool.execute({ command: 'quit' }))
                .rejects.toThrow('Command quit not supported or failed.');
            expect(mockSafeExecSync).not.toHaveBeenCalled();
        });
    });
});
