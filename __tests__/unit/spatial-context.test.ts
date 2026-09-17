import { describe, it, expect, beforeEach } from 'vitest';
import { getSpatialFocus, setSpatialFocus, type Region } from '../../src/services/spatial-context';

describe('spatial-context', () => {
    beforeEach(() => {
        setSpatialFocus(null);
    });

    it('defaults to null', () => {
        expect(getSpatialFocus()).toBeNull();
    });

    it('returns the region stored by setSpatialFocus', () => {
        const region: Region = { x: 10, y: 20, w: 300, h: 200 };
        setSpatialFocus(region);
        expect(getSpatialFocus()).toEqual({ x: 10, y: 20, w: 300, h: 200 });
        expect(getSpatialFocus()).toBe(region);
    });

    it('overwrites a previously set region', () => {
        setSpatialFocus({ x: 1, y: 2, w: 3, h: 4 });
        setSpatialFocus({ x: 50, y: 60, w: 70, h: 80 });
        expect(getSpatialFocus()).toEqual({ x: 50, y: 60, w: 70, h: 80 });
    });

    it('clears the region when set to null', () => {
        setSpatialFocus({ x: 1, y: 2, w: 3, h: 4 });
        expect(getSpatialFocus()).not.toBeNull();
        setSpatialFocus(null);
        expect(getSpatialFocus()).toBeNull();
    });
});
