/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execSync } from "child_process";
import { getNutjs, isNutjsAvailable } from "../server/nutjs-integration";
import { auditLogger } from "../core/audit-logger";

/**
 * Display scale helpers.
 *
 * `screencapture` PNGs are in device pixels (2x on Retina), while nut-js
 * input coordinates (mouse clicks, keyboard focus, Region bounds) are in
 * logical screen points. Any tool that maps between a captured image and
 * interactive coordinates must convert with this ratio or it lands 2x off
 * on Retina displays.
 */

let logicalScreenWidth: number | null = null;
let detectedRatio = 1;

/** Logical (point) width of the main display, or null if undetectable. */
async function getLogicalScreenWidth(): Promise<number | null> {
  if (logicalScreenWidth !== null) return logicalScreenWidth;
  if (isNutjsAvailable()) {
    try {
      const { screen } = getNutjs();
      const w = await screen.width();
      if (w > 0) {
        logicalScreenWidth = w;
        return logicalScreenWidth;
      }
    } catch (e) {
      auditLogger.warn("display-scale: nut-js screen.width() failed", { error: e });
    }
  }
  try {
    const out = execSync("system_profiler SPDisplaysDataType").toString();
    const match = out.match(/UI Looks like:\s*(\d+)\s*x\s*(\d+)/);
    if (match?.[1]) {
      logicalScreenWidth = parseInt(match[1], 10);
      return logicalScreenWidth;
    }
  } catch (e) {
    auditLogger.warn("display-scale: system_profiler fallback failed", { error: e });
  }
  return null;
}

/**
 * Update and return the pixel-per-point ratio using the pixel width of a
 * full-screen capture. Region captures should pass nothing and reuse the
 * last detected ratio via {@link getPixelRatio}.
 */
export async function detectPixelRatio(fullScreenPngWidth: number): Promise<number> {
  const logical = await getLogicalScreenWidth();
  if (logical && fullScreenPngWidth > logical) {
    detectedRatio = fullScreenPngWidth / logical;
  }
  return detectedRatio;
}

/**
 * Last detected pixel-per-point ratio (defaults to 1 when no full-screen
 * capture has been measured yet — correct for non-Retina displays).
 */
export function getPixelRatio(): number {
  return detectedRatio;
}
