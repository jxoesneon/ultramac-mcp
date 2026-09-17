import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

vi.mock('../../src/core/audit-logger', () => ({
    auditLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// The module under test loads @nut-tree-fork/nut-js via a native `require`,
// which shares the real CommonJS module cache. Grabbing the same exports
// object here lets us mutate the "surface" to drive initNutjs() branches.
const require_ = createRequire(import.meta.url);
const realNutjs = require_('@nut-tree-fork/nut-js') as Record<string, any>;

const SURFACE_KEYS = ['mouse', 'keyboard', 'screen'] as const;
let savedDescriptors: Record<string, PropertyDescriptor | undefined> = {};

function snapshotSurface() {
    savedDescriptors = {};
    for (const key of SURFACE_KEYS) {
        savedDescriptors[key] = Object.getOwnPropertyDescriptor(realNutjs, key);
    }
}

function restoreSurface() {
    for (const key of SURFACE_KEYS) {
        delete realNutjs[key];
        const descriptor = savedDescriptors[key];
        if (descriptor) {
            Object.defineProperty(realNutjs, key, descriptor);
        }
    }
}

describe('nutjs-integration', () => {
    beforeEach(() => {
        vi.resetModules();
        snapshotSurface();
    });

    afterEach(() => {
        restoreSurface();
    });

    it('reports unavailable before initialization', async () => {
        const mod = await import('../../src/server/nutjs-integration');
        expect(mod.isNutjsAvailable()).toBe(false);
    });

    it('initNutjs returns true and unlocks the API when the surface is present', async () => {
        const mod = await import('../../src/server/nutjs-integration');
        const { auditLogger } = await import('../../src/core/audit-logger');

        expect(mod.initNutjs()).toBe(true);
        expect(mod.isNutjsAvailable()).toBe(true);
        expect(mod.getNutjs()).toBe(realNutjs);
        expect(() => mod.requireNutjs()).not.toThrow();
        expect(auditLogger.info).toHaveBeenCalledWith('nutjs loaded successfully');
    });

    it('initNutjs returns false when nutjs lacks the expected automation surface', async () => {
        const mod = await import('../../src/server/nutjs-integration');
        const { auditLogger } = await import('../../src/core/audit-logger');

        delete realNutjs.mouse;

        expect(mod.initNutjs()).toBe(false);
        expect(mod.isNutjsAvailable()).toBe(false);
        expect(auditLogger.warn).toHaveBeenCalledWith(
            'nutjs loaded but did not expose expected automation surface'
        );
    });

    it('initNutjs catches errors thrown while inspecting the surface', async () => {
        const mod = await import('../../src/server/nutjs-integration');
        const { auditLogger } = await import('../../src/core/audit-logger');

        Object.defineProperty(realNutjs, 'mouse', {
            configurable: true,
            get() {
                throw new Error('native binding missing');
            }
        });

        expect(mod.initNutjs()).toBe(false);
        expect(mod.isNutjsAvailable()).toBe(false);
        expect(auditLogger.warn).toHaveBeenCalledWith('nutjs not fully available', {
            error: 'native binding missing'
        });
    });

    it('getNutjs throws when nutjs is not available', async () => {
        const mod = await import('../../src/server/nutjs-integration');

        expect(() => mod.getNutjs()).toThrow(
            'nutjs functionality not available. Please ensure all dependencies are properly installed.'
        );
    });

    it('requireNutjs throws when nutjs is not available', async () => {
        const mod = await import('../../src/server/nutjs-integration');

        expect(() => mod.requireNutjs()).toThrow(
            'nutjs functionality not available. Please ensure all dependencies are properly installed.'
        );
    });

    it('getNutjs throws again after a failed initialization', async () => {
        const mod = await import('../../src/server/nutjs-integration');

        delete realNutjs.screen;
        expect(mod.initNutjs()).toBe(false);
        expect(() => mod.getNutjs()).toThrow('nutjs functionality not available');
        expect(() => mod.requireNutjs()).toThrow('nutjs functionality not available');
    });
});
