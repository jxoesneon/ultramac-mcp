import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withLogging } from '../../src/core/with-logging';

// Prevent the real ActionLogger import from touching the filesystem
vi.mock('../../src/core/action-logger', () => ({
    ActionLogger: class {},
    actionLogger: { log: vi.fn() }
}));

const makeLogger = () => ({ log: vi.fn() });

describe('withLogging', () => {
    let logger: { log: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();
        logger = makeLogger();
    });

    it('logs a successful invocation and returns the result', async () => {
        const fn = vi.fn(async (args: any) => 'ok');
        const wrapped = withLogging(logger as any, 'myTool', fn);

        const result = await wrapped({ x: 1 });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledWith({ x: 1 });
        expect(logger.log).toHaveBeenCalledTimes(1);
        const [tool, args, res, duration, success] = logger.log.mock.calls[0] as any[];
        expect(tool).toBe('myTool');
        expect(args).toEqual({ x: 1 });
        expect(res).toBe('ok');
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
        expect(success).toBe(true);
    });

    it('measures duration via Date.now', async () => {
        const spy = vi.spyOn(Date, 'now')
            .mockReturnValueOnce(1000)
            .mockReturnValueOnce(1250);
        const wrapped = withLogging(logger as any, 'timed', async (_args: any) => 'r');

        await wrapped({});

        expect(logger.log).toHaveBeenCalledWith('timed', {}, 'r', 250, true);
        spy.mockRestore();
    });

    it('logs failures with the error message and rethrows', async () => {
        const err = new Error('boom');
        const fn = vi.fn(async (_args: any) => { throw err; });
        const wrapped = withLogging(logger as any, 'failTool', fn);

        await expect(wrapped({ a: 2 })).rejects.toThrow('boom');
        expect(logger.log).toHaveBeenCalledWith(
            'failTool',
            { a: 2 },
            'boom',
            expect.any(Number),
            false
        );
    });

    it('logs String(e) when a non-Error is thrown', async () => {
        const fn = vi.fn(async (_args: any) => { throw 'string failure'; });
        const wrapped = withLogging(logger as any, 'strTool', fn);

        await expect(wrapped({})).rejects.toBe('string failure');
        expect(logger.log).toHaveBeenCalledWith(
            'strTool',
            {},
            'string failure',
            expect.any(Number),
            false
        );
    });

    it('logs duration on the failure path too', async () => {
        const spy = vi.spyOn(Date, 'now')
            .mockReturnValueOnce(500)
            .mockReturnValueOnce(900);
        const fn = vi.fn(async (_args: any) => { throw new Error('slow fail'); });
        const wrapped = withLogging(logger as any, 'slowTool', fn);

        await expect(wrapped({})).rejects.toThrow('slow fail');
        expect(logger.log).toHaveBeenCalledWith('slowTool', {}, 'slow fail', 400, false);
        spy.mockRestore();
    });

    it('passes all args through to fn but logs only the first', async () => {
        const fn = vi.fn(async (a: number, b: number) => a + b);
        const wrapped = withLogging(logger as any, 'sum', fn);

        const result = await wrapped(3, 4);

        expect(result).toBe(7);
        expect(fn).toHaveBeenCalledWith(3, 4);
        expect(logger.log).toHaveBeenCalledWith('sum', 3, 7, expect.any(Number), true);
    });

    it('handles functions invoked with no args', async () => {
        const fn = vi.fn(async () => 'done');
        const wrapped = withLogging(logger as any, 'noArgs', fn);

        const result = await wrapped();

        expect(result).toBe('done');
        expect(logger.log).toHaveBeenCalledWith('noArgs', undefined, 'done', expect.any(Number), true);
    });
});
