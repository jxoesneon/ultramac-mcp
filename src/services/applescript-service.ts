/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { runAppleScript } from "run-applescript";

/**
 * Run an AppleScript and return its output
 */
export async function runAS(script: string): Promise<string> {
  return await runAppleScript(script);
}

/**
 * Run a JXA (JavaScript for Automation) script and return its output
 */
export function runJXA(script: string): string {
  const { execFileSync } = require('child_process');
  // Pass the script via stdin (no shell, no heredoc) so script content can
  // never break out into shell — osascript reads the program from stdin
  // when no file operand is given.
  return execFileSync('osascript', ['-l', 'JavaScript'], {
    input: script,
    encoding: 'utf8',
  }).trim();
}
