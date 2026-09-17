import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// safeExecSync actually creates the screenshot file so fs.existsSync passes
vi.mock('../../src/core/security-utils', async () => {
    const realFs = await import('fs');
    return {
        safeExecSync: vi.fn((_cmd: string, args: string[]) => {
            const target = args[args.length - 1];
            if (target && target.endsWith('.png')) {
                realFs.writeFileSync(target, 'fake-png-bytes');
            }
        }),
        sanitizeShellArg: vi.fn((x: any) => x),
    };
});

vi.mock('fastmcp', () => ({
    imageContent: vi.fn(async () => ({ content: [{ type: 'image' }] })),
}));

import { safeExecSync } from '../../src/core/security-utils';
import { captureScreenshot } from '../../src/services/screen-service';

describe('Screen Service — captureScreenshot window mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('matches window title case-insensitively', async () => {
        const result = await captureScreenshot('window', { windowName: 'industrial' });
        expect(result).toEqual({ content: [{ type: 'image' }] });
        expect(safeExecSync).toHaveBeenCalledWith(
            'screencapture',
            expect.arrayContaining(['-l1'])
        );
    });

    it('matches by owner app name', async () => {
        const result = await captureScreenshot('window', { windowName: 'MARTENSITE' });
        expect(result).toEqual({ content: [{ type: 'image' }] });
    });

    it('matches by owner bundleId', async () => {
        const result = await captureScreenshot('window', { windowName: 'com.apple.finder' });
        expect(result).toEqual({ content: [{ type: 'image' }] });
        expect(safeExecSync).toHaveBeenCalledWith(
            'screencapture',
            expect.arrayContaining(['-l2'])
        );
    });

    it('throws the not-found error when nothing matches', async () => {
        await expect(
            captureScreenshot('window', { windowName: 'nonexistent' })
        ).rejects.toThrow('No window matching "nonexistent" found');
    });
});
