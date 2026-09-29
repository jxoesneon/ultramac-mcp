/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import childProcess from "node:child_process";
import { runAppleScript } from "run-applescript";

/**
 * Run an AppleScript and return its output
 */
export async function runAS(script: string): Promise<string> {
  return await runAppleScript(script);
}

/** Default wall-clock budget for a single JXA run. */
export const DEFAULT_JXA_TIMEOUT_MS = 15_000;

function jxaTimeoutError(timeoutMs: number): Error {
  return new Error(`JXA script timed out after ${timeoutMs}ms`);
}

function isTimeoutError(err: any): boolean {
  return err?.killed === true || err?.signal === "SIGKILL";
}

/**
 * Run a JXA (JavaScript for Automation) script and return its output.
 * Async: the child runs off the event loop and is SIGKILLed after
 * `timeoutMs` so a wedged System Events can never block the server.
 */
export function runJXA(script: string, opts?: { timeoutMs?: number }): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_JXA_TIMEOUT_MS;
  return new Promise<string>((resolve, reject) => {
    // Pass the script via stdin (no shell, no heredoc) so script content can
    // never break out into shell — osascript reads the program from stdin
    // when no file operand is given.
    const child = childProcess.execFile(
      "osascript",
      ["-l", "JavaScript"],
      {
        encoding: "utf8",
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 16 * 1024 * 1024,
      },
      (err, stdout) => {
        if (err) {
          reject(isTimeoutError(err) ? jxaTimeoutError(timeoutMs) : err);
          return;
        }
        resolve(String(stdout).trim());
      }
    );
    child.stdin?.end(script);
  });
}

/**
 * Synchronous JXA run — only for callers that must stay sync
 * (getActiveWindowInfo). Same timeout + SIGKILL semantics as runJXA.
 */
export function runJXASync(script: string, opts?: { timeoutMs?: number }): string {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_JXA_TIMEOUT_MS;
  try {
    return childProcess.execFileSync("osascript", ["-l", "JavaScript"], {
      input: script,
      encoding: "utf8",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (err: any) {
    throw isTimeoutError(err) ? jxaTimeoutError(timeoutMs) : err;
  }
}
