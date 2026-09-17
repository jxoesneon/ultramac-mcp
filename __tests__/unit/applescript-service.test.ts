import { describe, it, expect, vi, beforeEach } from 'vitest';
import childProcess from 'node:child_process';
import { runAS, runJXA } from '../../src/services/applescript-service';

const mockRunAppleScript = vi.hoisted(() => vi.fn());

vi.mock('run-applescript', () => ({
    runAppleScript: mockRunAppleScript,
    runAppleScriptSync: vi.fn()
}));

describe('AppleScript Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    describe('runAS', () => {
        it('delegates to run-applescript and returns its output', async () => {
            mockRunAppleScript.mockResolvedValue('ok');
            const result = await runAS('tell application "Finder" to activate');
            expect(mockRunAppleScript).toHaveBeenCalledTimes(1);
            expect(mockRunAppleScript).toHaveBeenCalledWith('tell application "Finder" to activate');
            expect(result).toBe('ok');
        });

        it('propagates errors from run-applescript', async () => {
            mockRunAppleScript.mockRejectedValue(new Error('osascript failed'));
            await expect(runAS('bad script')).rejects.toThrow('osascript failed');
        });
    });

    describe('runJXA', () => {
        it('passes the script to osascript via stdin and trims output', () => {
            const spy = vi.spyOn(childProcess, 'execFileSync').mockReturnValue('  result  ' as any);
            const result = runJXA('Application("Finder").name()');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('osascript', ['-l', 'JavaScript'], {
                input: 'Application("Finder").name()',
                encoding: 'utf8'
            });
            expect(result).toBe('result');
        });

        it('returns empty string when osascript outputs only whitespace', () => {
            vi.spyOn(childProcess, 'execFileSync').mockReturnValue('   \n' as any);
            expect(runJXA('""')).toBe('');
        });

        it('propagates osascript errors', () => {
            vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => {
                throw new Error('jxa failed');
            });
            expect(() => runJXA('throw 1')).toThrow('jxa failed');
        });
    });
});
