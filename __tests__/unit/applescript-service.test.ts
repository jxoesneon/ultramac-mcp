import { describe, it, expect, vi, beforeEach } from 'vitest';
import childProcess from 'node:child_process';
import { runAS, runJXA, runJXASync, DEFAULT_JXA_TIMEOUT_MS } from '../../src/services/applescript-service';

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
        const fakeChild = () => ({ stdin: { end: vi.fn() } });

        const mockExecFile = (impl: (cb: any) => void) =>
            vi.spyOn(childProcess, 'execFile').mockImplementation(((_f: any, _a: any, _o: any, cb: any) => {
                impl(cb);
                return fakeChild();
            }) as any);

        it('passes the script to osascript via stdin and trims output', async () => {
            const spy = mockExecFile((cb) => cb(null, '  result  ', ''));
            const result = await runJXA('Application("Finder").name()');
            expect(spy).toHaveBeenCalledTimes(1);
            const [file, args, opts] = spy.mock.calls[0] as any[];
            expect(file).toBe('osascript');
            expect(args).toEqual(['-l', 'JavaScript']);
            expect(opts.encoding).toBe('utf8');
            expect(opts.timeout).toBe(DEFAULT_JXA_TIMEOUT_MS);
            expect(opts.killSignal).toBe('SIGKILL');
            expect(opts.maxBuffer).toBe(16 * 1024 * 1024);
            expect(result).toBe('result');
        });

        it('honours a custom timeoutMs', async () => {
            const spy = mockExecFile((cb) => cb(null, 'ok', ''));
            await runJXA('1', { timeoutMs: 5000 });
            expect((spy.mock.calls[0] as any[])[2].timeout).toBe(5000);
        });

        it('writes the script to child stdin', async () => {
            const child = fakeChild();
            vi.spyOn(childProcess, 'execFile').mockImplementation(((_f: any, _a: any, _o: any, cb: any) => {
                cb(null, 'ok', '');
                return child;
            }) as any);
            await runJXA('my script');
            expect(child.stdin.end).toHaveBeenCalledWith('my script');
        });

        it('maps a killed (timeout) error to a timed-out message', async () => {
            mockExecFile((cb) => cb(Object.assign(new Error('killed'), { killed: true, signal: 'SIGKILL' }), '', ''));
            await expect(runJXA('loop forever', { timeoutMs: 3000 })).rejects.toThrow(
                'JXA script timed out after 3000ms'
            );
        });

        it('propagates non-timeout osascript errors', async () => {
            mockExecFile((cb) => cb(new Error('jxa failed'), '', ''));
            await expect(runJXA('throw 1')).rejects.toThrow('jxa failed');
        });
    });

    describe('runJXASync', () => {
        it('passes the script to osascript via stdin and trims output', () => {
            const spy = vi.spyOn(childProcess, 'execFileSync').mockReturnValue('  result  ' as any);
            const result = runJXASync('Application("Finder").name()');
            expect(spy).toHaveBeenCalledTimes(1);
            const opts = (spy.mock.calls[0] as any[])[2] as any;
            expect(opts.input).toBe('Application("Finder").name()');
            expect(opts.encoding).toBe('utf8');
            expect(opts.timeout).toBe(DEFAULT_JXA_TIMEOUT_MS);
            expect(opts.killSignal).toBe('SIGKILL');
            expect(result).toBe('result');
        });

        it('maps a killed (timeout) error to a timed-out message', () => {
            vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => {
                throw Object.assign(new Error('killed'), { killed: true, signal: 'SIGKILL' });
            });
            expect(() => runJXASync('x', { timeoutMs: 2000 })).toThrow('JXA script timed out after 2000ms');
        });
    });
});
