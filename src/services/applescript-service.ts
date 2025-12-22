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
  const { execSync } = require('child_process');
  // Wrap script in an osascript call with JXA language flag
  const osaCommand = `osascript -l JavaScript <<'EOF'
${script}
EOF`;
  return execSync(osaCommand, { encoding: 'utf8' }).trim();
}
