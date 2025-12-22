/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getNutjs, isNutjsAvailable } from '../server/nutjs-integration';
import { safeExecSync } from '../core/security-utils';

/**
 * Get screen dimensions and information
 */
export async function getScreenDimensions(): Promise<string> {
  const nutjsAvailable = isNutjsAvailable();
  if (nutjsAvailable) {
    try {
      const { screen } = getNutjs();
      const width = await screen.width();
      const height = await screen.height();
      return `Screen dimensions: ${width}x${height} pixels`;
    } catch (e) {
      // Fallback to system command
    }
  }

  // Fallback method using system_profiler
  try {
    const { execSync } = require("child_process");
    const output = execSync("system_profiler SPDisplaysDataType | grep Resolution")
      .toString();
    const match = output.match(/(\d+) x (\d+)/);
    if (match) {
      return `Screen dimensions: ${match[1]}x ${match[2]} pixels`;
    }
  } catch (e) {}

  return "Screen dimensions unavailable (nutjs not fully loaded)";
}

/**
 * Capture a screenshot
 */
export async function captureScreenshot(mode: string, options: any): Promise<any> {
    const { imageContent } = require('fastmcp');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const filePath = path.join(os.tmpdir(), `mcp_screenshot_${Date.now()}.png`);

    if (mode === "full") {
      safeExecSync('screencapture', ['-x', '-D1', filePath]);
    } else if (mode === "region") {
      const { x, y, w, h } = options;
      if (x === undefined || y === undefined || w === undefined || h === undefined) {
        throw new Error("Region mode requires x, y, w, h");
      }
      safeExecSync('screencapture', ['-x', `-R${x},${y},${w},${h}`, filePath]);
    } else if (mode === "window") {
      let targetId = options.windowId;
      if (!targetId && options.windowName) {
        const { openWindows } = require("get-windows");
        const allWindows = await openWindows();
        const targetWin = allWindows.find((w: any) => w.title && w.title.includes(options.windowName));
        if (!targetWin) throw new Error(`Window containing title "${options.windowName}" not found`);
        targetId = targetWin.id;
      }
      if (!targetId) throw new Error("Could not determine target window ID");
      safeExecSync('screencapture', ['-x', `-l${targetId}`, filePath]);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Screenshot file was not created at ${filePath}`);
    }

    return await imageContent({ path: filePath });
}
