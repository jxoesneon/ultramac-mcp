import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as screenTools from '../../src/tools/screen-tools';
import { MCPServer } from '../../src/server/mcp-server';
import { getScreenDimensions, captureScreenshot } from '../../src/services/screen-service';
import { getUITree, findElement } from '../../src/services/ui-service';
import { performOCR } from '../../src/services/ocr-service';
import { findIcon } from '../../src/services/vision-service';
import { getSpatialFocus, setSpatialFocus } from '../../src/services/spatial-context';

// Mock nut.js objects
const mockNutjs = {
    screen: {
        highlight: vi.fn(async (_region: any) => {}),
        colorAt: vi.fn(async (_point: any) => ({ R: 1, G: 2, B: 3, A: 255 })),
        width: vi.fn(async () => 1920),
        height: vi.fn(async () => 1080),
    },
    Point: class {
        constructor(public x: number, public y: number) {}
    },
    Region: class {
        constructor(public x: number, public y: number, public width: number, public height: number) {}
    },
};

vi.mock('get-windows', () => ({
    openWindows: vi.fn(async () => [
        {
            id: 1,
            title: 'Martensite — Industrial Workstation',
            owner: { name: 'Martensite', processId: 42, bundleId: 'com.martensite.app' },
            bounds: { x: 0, y: 0, width: 800, height: 600 },
        },
        {
            id: 2,
            title: 'Documents',
            owner: { name: 'Finder', processId: 10, bundleId: 'com.apple.finder' },
            bounds: { x: 0, y: 0, width: 400, height: 300 },
        },
    ]),
}));

// Mock the integration layer instead of the package
vi.mock('../../src/server/nutjs-integration', () => ({
    getNutjs: vi.fn(() => mockNutjs),
    requireNutjs: vi.fn(() => mockNutjs),
    isNutjsAvailable: vi.fn(() => true),
}));

vi.mock('../../src/services/applescript-service', () => ({
    runJXA: vi.fn(() => '{"found":false}'),
    runAS: vi.fn(),
}));

vi.mock('../../src/services/screen-service', () => ({
    getScreenDimensions: vi.fn(async () => 'Screen dimensions: 1x1'),
    captureScreenshot: vi.fn(async (mode: string, _options: any) => ({ mode })),
}));

// Keep the real buildTargetPreamble/UITarget helpers; mock only the JXA-backed queries.
vi.mock('../../src/services/ui-service', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/services/ui-service')>()),
    getUITree: vi.fn(async () => ({ role: 'AXWindow' })),
    findElement: vi.fn(),
}));

vi.mock('../../src/services/ocr-service', () => ({
    performOCR: vi.fn(async () => ({ matches: [] })),
}));

vi.mock('../../src/services/vision-service', () => ({
    findIcon: vi.fn(async () => ({ found: true })),
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

describe('Screen Tools', () => {
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

    it('registers the list_windows tool', () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        expect(registeredTools.has('list_windows')).toBe(true);
        expect(registeredTools.has('screenshot')).toBe(true);
        expect(registeredTools.has('find_element')).toBe(true);
    });

    it('list_windows returns all windows as JSON', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('list_windows');
        const result = JSON.parse(await tool.execute({}));
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            id: 1,
            title: 'Martensite — Industrial Workstation',
            owner: 'Martensite',
            pid: 42,
            bundleId: 'com.martensite.app',
        });
        expect(result[0].bounds).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    });

    it('list_windows filters by process substring (case-insensitive)', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('list_windows');
        const result = JSON.parse(await tool.execute({ process: 'mart' }));
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });

    it('list_windows filters by bundleId substring', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('list_windows');
        const result = JSON.parse(await tool.execute({ process: 'com.apple.finder' }));
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    it('screenshot delegates to captureScreenshot with mode and options', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('screenshot');
        const result = await tool.execute({
            mode: 'region',
            regionX: 1,
            regionY: 2,
            regionWidth: 3,
            regionHeight: 4,
            windowName: 'Documents',
            windowId: 9,
        });
        expect(captureScreenshot).toHaveBeenCalledWith('region', {
            x: 1,
            y: 2,
            w: 3,
            h: 4,
            windowName: 'Documents',
            windowId: 9,
        });
        expect(result).toEqual({ mode: 'region' });
    });

    it('screenshot passes undefined region/window fields through', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('screenshot');
        const result = await tool.execute({ mode: 'full' });
        expect(captureScreenshot).toHaveBeenCalledWith('full', {
            x: undefined,
            y: undefined,
            w: undefined,
            h: undefined,
            windowName: undefined,
            windowId: undefined,
        });
        expect(result).toEqual({ mode: 'full' });
    });

    it('screenInfo returns screen dimensions from the service', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('screenInfo');
        const result = await tool.execute({});
        expect(getScreenDimensions).toHaveBeenCalled();
        expect(result).toBe('Screen dimensions: 1x1');
    });

    it('screenHighlight highlights a Region via nutjs', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('screenHighlight');
        const result = await tool.execute({ x: 10, y: 20, width: 100, height: 50 });
        expect(mockNutjs.screen.highlight).toHaveBeenCalledTimes(1);
        expect(mockNutjs.screen.highlight.mock.calls[0]?.[0]).toMatchObject({
            x: 10,
            y: 20,
            width: 100,
            height: 50,
        });
        expect(result).toBe('Highlighted region at (10, 20) with size 100x50');
    });

    it('colorAt returns the pixel color via nutjs', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('colorAt');
        const result = await tool.execute({ x: 5, y: 6 });
        expect(mockNutjs.screen.colorAt).toHaveBeenCalledTimes(1);
        expect(mockNutjs.screen.colorAt.mock.calls[0]?.[0]).toMatchObject({ x: 5, y: 6 });
        expect(result).toBe('Color at (5, 6): R=1, G=2, B=3, A=255');
    });

    it('set_spatial_focus stores the region in spatial context', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('set_spatial_focus');
        const result = await tool.execute({ x: 1, y: 2, w: 3, h: 4 });
        expect(result).toBe('Spatial focus set to Region(1, 2, 3x4).');
        expect(getSpatialFocus()).toEqual({ x: 1, y: 2, w: 3, h: 4 });
        setSpatialFocus(null);
    });

    it('set_spatial_focus with zero size clears the region', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('set_spatial_focus');
        await tool.execute({ x: 1, y: 2, w: 3, h: 4 });
        const result = await tool.execute({ x: 0, y: 0, w: 0, h: 0 });
        expect(result).toBe('Spatial focus cleared.');
        expect(getSpatialFocus()).toBeNull();
    });

    it('get_ui_tree returns JSON tree and passes undefined target', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('get_ui_tree');
        const result = JSON.parse(await tool.execute({ depth: 3 }));
        expect(getUITree).toHaveBeenCalledWith(3, undefined);
        expect(result).toEqual({ role: 'AXWindow' });
    });

    it('get_ui_tree forwards target params', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('get_ui_tree');
        await tool.execute({ depth: 2, process: 'Finder', pid: 10, window: 'Documents' });
        expect(getUITree).toHaveBeenCalledWith(2, {
            process: 'Finder',
            pid: 10,
            window: 'Documents',
        });
    });

    it('find_element reports found element with center coordinates', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({
            found: true,
            name: 'OK',
            role: 'AXButton',
            position: [100, 200],
            size: [50, 20],
        });
        const tool = registeredTools.get('find_element');
        const result = await tool.execute({ criteria: 'ok', role: 'AXButton' });
        expect(findElement).toHaveBeenCalledWith('ok', 'AXButton', undefined);
        expect(result).toBe("Found 'OK' (AXButton) at (100, 200). Center: (125, 210)");
    });

    it('find_element returns generic message when not found', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: false });
        const tool = registeredTools.get('find_element');
        expect(await tool.execute({ criteria: 'missing' })).toBe('Element not found.');
    });

    it('find_element surfaces error details when present', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: false, error: 'target_not_found' });
        const tool = registeredTools.get('find_element');
        expect(await tool.execute({ criteria: 'x' })).toBe('Element not found: target_not_found');
    });

    it('find_element forwards target params', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: false });
        const tool = registeredTools.get('find_element');
        await tool.execute({ criteria: 'x', process: 'Safari', window: 1 });
        expect(findElement).toHaveBeenCalledWith('x', undefined, {
            process: 'Safari',
            pid: undefined,
            window: 1,
        });
    });

    it('find_text_on_screen returns OCR result as JSON', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('find_text_on_screen');
        const result = JSON.parse(await tool.execute({ text: 'hello' }));
        expect(performOCR).toHaveBeenCalledWith('hello');
        expect(result).toEqual({ matches: [] });
    });

    it('find_icon returns vision result as JSON', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        const tool = registeredTools.get('find_icon');
        const result = JSON.parse(await tool.execute({ description: 'trash icon' }));
        expect(findIcon).toHaveBeenCalledWith('trash icon');
        expect(result).toEqual({ found: true });
    });

    it('wait_for_ui_element returns immediately when found', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: true });
        const tool = registeredTools.get('wait_for_ui_element');
        const result = await tool.execute({ criteria: 'Save', timeoutMs: 5000 });
        expect(result).toBe('Element "Save" found!');
        expect(findElement).toHaveBeenCalledTimes(1);
    });

    it('wait_for_ui_element fails fast on error', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: false, error: 'window_not_found' });
        const tool = registeredTools.get('wait_for_ui_element');
        const result = await tool.execute({ criteria: 'X', timeoutMs: 5000 });
        expect(result).toBe('Element not found: window_not_found');
        expect(findElement).toHaveBeenCalledTimes(1);
    });

    it('wait_for_ui_element times out when element never appears', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: false });
        const tool = registeredTools.get('wait_for_ui_element');
        const result = await tool.execute({ criteria: 'Slow', role: 'AXButton', timeoutMs: 600 });
        expect(result).toBe('Timeout waiting for element "Slow"');
        expect(findElement).toHaveBeenCalledWith('Slow', 'AXButton', undefined);
    }, 10000);

    it('wait_for_ui_element forwards target params', async () => {
        screenTools.registerScreenTools(mockServer as unknown as MCPServer);
        vi.mocked(findElement).mockResolvedValue({ found: true });
        const tool = registeredTools.get('wait_for_ui_element');
        await tool.execute({ criteria: 'Y', pid: 42, timeoutMs: 5000 });
        expect(findElement).toHaveBeenCalledWith('Y', undefined, {
            process: undefined,
            pid: 42,
            window: undefined,
        });
    });
});
