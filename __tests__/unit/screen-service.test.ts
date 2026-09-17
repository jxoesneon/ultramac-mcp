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
import { getNutjs, isNutjsAvailable } from '../../src/server/nutjs-integration';
import childProcess from 'child_process';
import { captureScreenshot, getScreenDimensions } from '../../src/services/screen-service';

// The service calls require('child_process').execSync lazily inside the function;
// spy on the real builtin module so the require resolves to the mocked method.
const execSyncSpy = vi.spyOn(childProcess, 'execSync');

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

describe('Screen Service — getScreenDimensions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isNutjsAvailable as any).mockReturnValue(false);
        execSyncSpy.mockReturnValue('      Resolution: 2560 x 1440\n' as any);
    });

    it('returns dimensions from nutjs when available', async () => {
        (isNutjsAvailable as any).mockReturnValue(true);
        (getNutjs as any).mockReturnValue({
            screen: {
                width: vi.fn(async () => 2560),
                height: vi.fn(async () => 1440),
            },
        });
        const result = await getScreenDimensions();
        expect(result).toBe('Screen dimensions: 2560x1440 pixels');
        expect(execSyncSpy).not.toHaveBeenCalled();
    });

    it('falls back to system_profiler when the nutjs screen call throws', async () => {
        (isNutjsAvailable as any).mockReturnValue(true);
        (getNutjs as any).mockReturnValue({
            screen: {
                width: vi.fn(async () => { throw new Error('nutjs broke'); }),
                height: vi.fn(async () => 0),
            },
        });
        const result = await getScreenDimensions();
        expect(execSyncSpy).toHaveBeenCalled();
        expect(result).toBe('Screen dimensions: 2560x 1440 pixels');
    });

    it('falls back to system_profiler when nutjs is unavailable', async () => {
        const result = await getScreenDimensions();
        expect(execSyncSpy).toHaveBeenCalledWith(
            'system_profiler SPDisplaysDataType | grep Resolution'
        );
        expect(result).toBe('Screen dimensions: 2560x 1440 pixels');
    });

    it('returns unavailable when both nutjs and system_profiler fail', async () => {
        execSyncSpy.mockImplementation(() => { throw new Error('no profiler'); });
        const result = await getScreenDimensions();
        expect(result).toBe('Screen dimensions unavailable (nutjs not fully loaded)');
    });

    it('returns unavailable when profiler output has no resolution match', async () => {
        execSyncSpy.mockReturnValue('Graphics/Displays:\n' as any);
        const result = await getScreenDimensions();
        expect(result).toBe('Screen dimensions unavailable (nutjs not fully loaded)');
    });
});

describe('Screen Service — captureScreenshot modes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('captures the full screen with -D1', async () => {
        const result = await captureScreenshot('full', {});
        expect(result).toEqual({ content: [{ type: 'image' }] });
        expect(safeExecSync).toHaveBeenCalledWith(
            'screencapture',
            expect.arrayContaining(['-x', '-D1'])
        );
    });

    it('region mode throws when coordinates are missing', async () => {
        await expect(
            captureScreenshot('region', { x: 0, y: 0 })
        ).rejects.toThrow('Region mode requires x, y, w, h');
        expect(safeExecSync).not.toHaveBeenCalled();
    });

    it('region mode passes -R geometry to screencapture', async () => {
        const result = await captureScreenshot('region', { x: 10, y: 20, w: 300, h: 200 });
        expect(result).toEqual({ content: [{ type: 'image' }] });
        expect(safeExecSync).toHaveBeenCalledWith(
            'screencapture',
            expect.arrayContaining(['-R10,20,300,200'])
        );
    });

    it('window mode uses a provided windowId directly', async () => {
        const result = await captureScreenshot('window', { windowId: 7 });
        expect(result).toEqual({ content: [{ type: 'image' }] });
        expect(safeExecSync).toHaveBeenCalledWith(
            'screencapture',
            expect.arrayContaining(['-l7'])
        );
    });

    it('window mode throws when neither id nor name resolves', async () => {
        await expect(captureScreenshot('window', {})).rejects.toThrow(
            'Could not determine target window ID'
        );
    });

    it('throws when the screenshot file was not created', async () => {
        // safeExecSync no-ops so screencapture never writes the file, and a
        // pinned unique timestamp guarantees no stale file matches the path.
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(9_999_999_999_999);
        (safeExecSync as any).mockImplementationOnce(() => {});
        try {
            await expect(captureScreenshot('full', {})).rejects.toThrow(
                'Screenshot file was not created at'
            );
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('throws for an unknown mode since no capture command runs', async () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(9_999_999_999_998);
        try {
            await expect(captureScreenshot('bogus-mode', {})).rejects.toThrow(
                'Screenshot file was not created at'
            );
            expect(safeExecSync).not.toHaveBeenCalled();
        } finally {
            nowSpy.mockRestore();
        }
    });
});
