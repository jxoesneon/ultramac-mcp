/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface Region {
    x: number;
    y: number;
    w: number;
    h: number;
}

let activeRegion: Region | null = null;

/**
 * Get the current spatial focus region
 */
export function getSpatialFocus(): Region | null {
    return activeRegion;
}

/**
 * Set the current spatial focus region
 */
export function setSpatialFocus(region: Region | null): void {
    activeRegion = region;
}
