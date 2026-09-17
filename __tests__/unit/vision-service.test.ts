import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const mocks = vi.hoisted(() => ({
    pipeline: vi.fn(),
    detector: vi.fn(),
    safeExecSync: vi.fn(),
    toBuffer: vi.fn()
}));

vi.mock('@xenova/transformers', () => ({
    pipeline: mocks.pipeline,
    RawImage: class RawImage {
        data: any;
        width: number;
        height: number;
        channels: number;
        constructor(data: any, width: number, height: number, channels: number) {
            this.data = data;
            this.width = width;
            this.height = height;
            this.channels = channels;
        }
    }
}));

vi.mock('sharp', () => ({
    default: vi.fn(() => ({
        ensureAlpha: () => ({
            raw: () => ({
                toBuffer: mocks.toBuffer
            })
        })
    }))
}));

vi.mock('../../src/core/security-utils', () => ({
    safeExecSync: mocks.safeExecSync,
    sanitizeShellArg: vi.fn((x: string) => x),
    sanitizeIdentifier: vi.fn((x: string) => x),
    isAlphanumericSafe: vi.fn(() => true),
    encrypt: vi.fn((x: string) => x),
    decrypt: vi.fn((x: string) => x),
    RateLimiter: class {
        isAllowed() { return true; }
        reset() {}
        getCount() { return 0; }
    }
}));

vi.mock('../../src/core/audit-logger', () => ({
    auditLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const GOOD_MATCH = { score: 0.9, box: { xmin: 10, ymin: 20, xmax: 50, ymax: 60 } };

describe('Vision Service - findIcon', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        // Default happy-path implementations; tests override as needed.
        mocks.pipeline.mockResolvedValue(mocks.detector);
        mocks.detector.mockResolvedValue([GOOD_MATCH]);
        mocks.safeExecSync.mockImplementation(() => 'ok');
        mocks.toBuffer.mockResolvedValue({
            data: Buffer.from([0, 0, 0, 0]),
            info: { width: 1, height: 1, channels: 4 }
        });
    });

    it('loads the model once and caches it across calls', async () => {
        const { findIcon } = await import('../../src/services/vision-service');
        const { auditLogger } = await import('../../src/core/audit-logger');

        await findIcon('first');
        await findIcon('second');

        expect(mocks.pipeline).toHaveBeenCalledTimes(1);
        expect(mocks.pipeline).toHaveBeenCalledWith(
            'zero-shot-object-detection',
            'Xenova/owlvit-base-patch32'
        );
        expect(mocks.detector).toHaveBeenCalledTimes(2);
        expect(auditLogger.info).toHaveBeenCalledWith(
            'Loading Object Detection Model (Xenova/owlvit-base-patch32)...'
        );
    });

    it('throws when the AI model fails to load', async () => {
        mocks.pipeline.mockRejectedValue(new Error('no network'));
        const { findIcon } = await import('../../src/services/vision-service');
        const { auditLogger } = await import('../../src/core/audit-logger');

        await expect(findIcon('icon')).rejects.toThrow('Error loading AI model: no network');
        expect(auditLogger.error).toHaveBeenCalledWith(
            'Failed to load AI model',
            expect.objectContaining({ error: expect.any(Error) })
        );
    });

    it('throws when the screenshot capture fails', async () => {
        mocks.safeExecSync.mockImplementation(() => {
            throw new Error('capture denied');
        });
        const { findIcon } = await import('../../src/services/vision-service');

        await expect(findIcon('icon')).rejects.toThrow(
            'Failed to capture screenshot for icon search.'
        );
    });

    it('captures the full screen when no spatial focus is set', async () => {
        const { findIcon } = await import('../../src/services/vision-service');

        await findIcon('icon');

        expect(mocks.safeExecSync).toHaveBeenCalledWith('screencapture', [
            '-x',
            expect.stringContaining('icon_search_')
        ]);
    });

    it('returns not-found when the detector returns an empty array', async () => {
        mocks.detector.mockResolvedValue([]);
        const { findIcon } = await import('../../src/services/vision-service');

        const result = await findIcon('dock icon');

        expect(result.found).toBe(false);
        expect(result.message).toBe('Icon "dock icon" not found.');
    });

    it('returns not-found when the detector returns a falsy output', async () => {
        mocks.detector.mockResolvedValue(null);
        const { findIcon } = await import('../../src/services/vision-service');

        const result = await findIcon('dock icon');

        expect(result.found).toBe(false);
        expect(result.message).toBe('Icon "dock icon" not found.');
    });

    it('returns a low-confidence message when the best match scores below 0.1', async () => {
        mocks.detector.mockResolvedValue([
            { score: 0.05, box: { xmin: 0, ymin: 0, xmax: 10, ymax: 10 } },
            { score: 0.02, box: { xmin: 5, ymin: 5, xmax: 15, ymax: 15 } }
        ]);
        const { findIcon } = await import('../../src/services/vision-service');

        const result = await findIcon('blurry icon');

        expect(result.found).toBe(false);
        expect(result.message).toContain('low confidence');
        expect(result.message).toContain('5%');
    });

    it('returns centered coordinates for a confident match', async () => {
        const { findIcon } = await import('../../src/services/vision-service');

        const result = await findIcon('finder icon');

        expect(result).toEqual({
            found: true,
            description: 'finder icon',
            confidence: 0.9,
            x: 30, // xmin 10 + w 40 / 2
            y: 40, // ymin 20 + h 40 / 2
            w: 40,
            h: 40,
            region: { x: 10, y: 20, w: 40, h: 40 }
        });
    });

    it('respects the spatial focus region and applies its offset', async () => {
        const { setSpatialFocus } = await import('../../src/services/spatial-context');
        const { findIcon } = await import('../../src/services/vision-service');
        setSpatialFocus({ x: 5, y: 10, w: 100, h: 200 });

        const result = await findIcon('menu icon');

        expect(mocks.safeExecSync).toHaveBeenCalledWith('screencapture', [
            '-x',
            '-R 5,10,100,200',
            expect.stringContaining('icon_search_')
        ]);
        expect(result.found).toBe(true);
        expect(result.x).toBe(35); // 10 + 5 offset + 20 half-width
        expect(result.y).toBe(50); // 20 + 10 offset + 20 half-height
        expect(result.region).toEqual({ x: 15, y: 30, w: 40, h: 40 });
    });

    it('picks the highest-scoring match among several detections', async () => {
        mocks.detector.mockResolvedValue([
            { score: 0.2, box: { xmin: 0, ymin: 0, xmax: 10, ymax: 10 } },
            { score: 0.95, box: { xmin: 100, ymin: 100, xmax: 120, ymax: 120 } },
            { score: 0.5, box: { xmin: 50, ymin: 50, xmax: 60, ymax: 60 } }
        ]);
        const { findIcon } = await import('../../src/services/vision-service');

        const result = await findIcon('icon');

        expect(result.found).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.x).toBe(110);
        expect(result.y).toBe(110);
    });

    it('wraps detector errors as AI Inference failures', async () => {
        mocks.detector.mockRejectedValue(new Error('inference boom'));
        const { findIcon } = await import('../../src/services/vision-service');
        const { auditLogger } = await import('../../src/core/audit-logger');

        await expect(findIcon('icon')).rejects.toThrow('AI Inference failed: inference boom');
        expect(auditLogger.error).toHaveBeenCalledWith(
            'AI Inference failed',
            expect.objectContaining({ description: 'icon' })
        );
    });

    it('wraps image-decoding errors as AI Inference failures', async () => {
        mocks.toBuffer.mockRejectedValue(new Error('decode failed'));
        const { findIcon } = await import('../../src/services/vision-service');

        await expect(findIcon('icon')).rejects.toThrow('AI Inference failed: decode failed');
    });

    it('removes the screenshot file after processing', async () => {
        mocks.safeExecSync.mockImplementation((_cmd: string, args: string[]) => {
            fs.writeFileSync(args[args.length - 1]!, 'fake png');
            return 'ok';
        });
        const { findIcon } = await import('../../src/services/vision-service');

        await findIcon('icon');

        const screenshotPath = ((mocks.safeExecSync.mock.calls[0]![1] as string[])).at(-1) as string;
        expect(screenshotPath).toContain('icon_search_');
        expect(path.dirname(screenshotPath)).toBe(os.tmpdir());
        expect(fs.existsSync(screenshotPath)).toBe(false);
    });

    it('still removes the screenshot file when inference fails', async () => {
        mocks.safeExecSync.mockImplementation((_cmd: string, args: string[]) => {
            fs.writeFileSync(args[args.length - 1]!, 'fake png');
            return 'ok';
        });
        mocks.detector.mockRejectedValue(new Error('boom'));
        const { findIcon } = await import('../../src/services/vision-service');

        await expect(findIcon('icon')).rejects.toThrow('AI Inference failed: boom');

        const screenshotPath = ((mocks.safeExecSync.mock.calls[0]![1] as string[])).at(-1) as string;
        expect(fs.existsSync(screenshotPath)).toBe(false);
    });
});
