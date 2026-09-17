import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as screenTools from '../../src/tools/screen-tools';
import { MCPServer } from '../../src/server/mcp-server';

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

vi.mock('../../src/server/nutjs-integration', () => ({
    getNutjs: vi.fn(),
    requireNutjs: vi.fn(),
    isNutjsAvailable: vi.fn(() => false),
}));

vi.mock('../../src/services/applescript-service', () => ({
    runJXA: vi.fn(() => '{"found":false}'),
    runAS: vi.fn(),
}));

vi.mock('../../src/services/ocr-service', () => ({
    performOCR: vi.fn(async () => ({})),
}));

vi.mock('../../src/services/vision-service', () => ({
    findIcon: vi.fn(async () => ({})),
}));

vi.mock('../../src/core/security-utils', () => ({
    safeExecSync: vi.fn(),
    sanitizeShellArg: vi.fn((x: any) => x),
    RateLimiter: class {
        isAllowed() { return true; }
        reset() {}
        getCount() { return 0; }
    },
    sanitizeIdentifier: vi.fn((x: any) => x),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    isAlphanumericSafe: vi.fn(() => true),
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
});
