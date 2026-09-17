import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as keyboardTools from '../../src/tools/keyboard-tools';
import { MCPServer } from '../../src/server/mcp-server';
import { getActiveWindowInfo } from '../../src/services/ui-service';

// Mock nut.js objects
const mockNutjs = {
  keyboard: {
    type: vi.fn(),
    pressKey: vi.fn(),
    releaseKey: vi.fn()
  },
  Key: {
    LeftControl: 'KEY_LeftControl',
    LeftShift: 'KEY_LeftShift',
    LeftSuper: 'KEY_LeftSuper',
    C: 'KEY_C',
    V: 'KEY_V',
    A: 'KEY_A',
    Escape: 'KEY_Escape',
    Return: 'KEY_Return'
  }
};

// Mock the integration layer instead of the package
vi.mock('../../src/server/nutjs-integration', () => ({
    getNutjs: vi.fn(() => mockNutjs),
    requireNutjs: vi.fn(() => mockNutjs)
}));

// Mock the focus guard window lookup
vi.mock('../../src/services/ui-service', () => ({
    getActiveWindowInfo: vi.fn()
}));

const mockGetActiveWindowInfo = vi.mocked(getActiveWindowInfo);

const FRONT_WINDOW = { title: 'Editor', bundleId: 'com.example.editor' };

describe('Keyboard Tools', () => {
    let mockServer: any;
    let registeredTools: Map<string, any>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActiveWindowInfo.mockReturnValue(FRONT_WINDOW);
        registeredTools = new Map();
        mockServer = {
            addTool: vi.fn((tool) => {
                registeredTools.set(tool.name, tool);
            })
        };
        keyboardTools.registerKeyboardTools(mockServer as unknown as MCPServer);
    });

    it('should register all keyboard tools', () => {
        expect(registeredTools.has('type')).toBe(true);
        expect(registeredTools.has('keyControl')).toBe(true);
    });

    it('should type literal text', async () => {
        const tool = registeredTools.get('type');
        const result = await tool.execute({ text: 'hello world' });
        expect(mockNutjs.keyboard.type).toHaveBeenCalledWith('hello world');
        expect(result).toBe('Typed text: "hello world"');
    });

    it('should abort when the active window cannot be verified', async () => {
        mockGetActiveWindowInfo.mockReturnValue(null);
        const tool = registeredTools.get('type');
        const result = await tool.execute({ text: 'hello' });
        expect(result).toBe('Safety: Could not verify active window. Typing aborted.');
        expect(mockNutjs.keyboard.type).not.toHaveBeenCalled();
        expect(mockNutjs.keyboard.pressKey).not.toHaveBeenCalled();
    });

    it('should abort typing when the active window changes', async () => {
        mockGetActiveWindowInfo
            .mockReturnValueOnce(FRONT_WINDOW)
            .mockReturnValueOnce({ title: 'Other Window', bundleId: 'com.other.app' });
        const tool = registeredTools.get('type');
        const result = await tool.execute({ text: 'hello' });
        expect(result).toContain('Safety: Active window changed');
        expect(result).toContain('Other Window');
        expect(result).toContain('Typing aborted');
        expect(mockNutjs.keyboard.type).not.toHaveBeenCalled();
    });

    it('should report "unknown" when the active window disappears before typing', async () => {
        mockGetActiveWindowInfo
            .mockReturnValueOnce(FRONT_WINDOW)
            .mockReturnValueOnce(null);
        const tool = registeredTools.get('type');
        const result = await tool.execute({ text: 'hello' });
        expect(result).toContain('now "unknown"');
        expect(mockNutjs.keyboard.type).not.toHaveBeenCalled();
    });

    it('should press a key combination via the keys param', async () => {
        const tool = registeredTools.get('type');
        const result = await tool.execute({ keys: 'LeftControl,C' });
        expect(mockNutjs.keyboard.pressKey).toHaveBeenCalledWith('KEY_LeftControl', 'KEY_C');
        expect(mockNutjs.keyboard.releaseKey).toHaveBeenCalledWith('KEY_LeftControl', 'KEY_C');
        expect(result).toBe('Pressed key combination [LeftControl + C].');
    });

    it('should map Command to LeftSuper in combinations', async () => {
        const tool = registeredTools.get('type');
        const result = await tool.execute({ keys: 'Command,V' });
        expect(mockNutjs.keyboard.pressKey).toHaveBeenCalledWith('KEY_LeftSuper', 'KEY_V');
        expect(mockNutjs.keyboard.releaseKey).toHaveBeenCalledWith('KEY_LeftSuper', 'KEY_V');
        expect(result).toBe('Pressed key combination [Command + V].');
    });

    it('should abort a key combination when the active window changes', async () => {
        mockGetActiveWindowInfo
            .mockReturnValueOnce(FRONT_WINDOW)
            .mockReturnValueOnce({ title: 'Editor', bundleId: 'com.different.app' });
        const tool = registeredTools.get('type');
        const result = await tool.execute({ keys: 'LeftControl,C' });
        expect(result).toContain('Safety: Active window changed');
        expect(result).toContain('Key press aborted');
        expect(mockNutjs.keyboard.pressKey).not.toHaveBeenCalled();
    });

    it('should report "unknown" when the active window disappears before a key combination', async () => {
        mockGetActiveWindowInfo
            .mockReturnValueOnce(FRONT_WINDOW)
            .mockReturnValueOnce(null);
        const tool = registeredTools.get('type');
        const result = await tool.execute({ keys: 'LeftControl,C' });
        expect(result).toContain('now "unknown"');
        expect(mockNutjs.keyboard.pressKey).not.toHaveBeenCalled();
    });

    it('should throw on unknown key names in a combination', async () => {
        const tool = registeredTools.get('type');
        await expect(tool.execute({ keys: 'LeftControl,NotAKey' }))
            .rejects.toThrow('Unknown key: NotAKey');
        expect(mockNutjs.keyboard.pressKey).not.toHaveBeenCalled();
    });

    it('should throw when neither text nor keys are provided', async () => {
        const tool = registeredTools.get('type');
        await expect(tool.execute({}))
            .rejects.toThrow("Provide either 'text' to type or 'keys' for key combination.");
    });

    it('keyControl should press keys', async () => {
        const tool = registeredTools.get('keyControl');
        const result = await tool.execute({ action: 'press', keys: 'LeftControl,LeftShift' });
        expect(mockNutjs.keyboard.pressKey).toHaveBeenCalledWith('KEY_LeftControl', 'KEY_LeftShift');
        expect(result).toBe('Pressed keys: [LeftControl, LeftShift]');
    });

    it('keyControl should release keys', async () => {
        const tool = registeredTools.get('keyControl');
        const result = await tool.execute({ action: 'release', keys: 'Escape' });
        expect(mockNutjs.keyboard.releaseKey).toHaveBeenCalledWith('KEY_Escape');
        expect(result).toBe('Released keys: [Escape]');
    });

    it('keyControl should map Command to LeftSuper', async () => {
        const tool = registeredTools.get('keyControl');
        await tool.execute({ action: 'press', keys: 'Command' });
        expect(mockNutjs.keyboard.pressKey).toHaveBeenCalledWith('KEY_LeftSuper');
    });

    it('keyControl should throw on unknown keys', async () => {
        const tool = registeredTools.get('keyControl');
        await expect(tool.execute({ action: 'press', keys: 'BogusKey' }))
            .rejects.toThrow('Unknown key: BogusKey');
    });
});
