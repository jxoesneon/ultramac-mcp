import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/applescript-service', () => ({
    runJXA: vi.fn(() => '{"found":false}'),
    runAS: vi.fn(),
}));

import { runJXA } from '../../src/services/applescript-service';
import { findElement, getUITree } from '../../src/services/ui-service';

const lastScript = (): string => {
    const calls = (runJXA as any).mock.calls;
    return calls[calls.length - 1][0] as string;
};

describe('UI Service — findElement targeting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (runJXA as any).mockReturnValue('{"found":false}');
    });

    it('falls back to the frontmost process when no target is given (back-compat)', async () => {
        await findElement('OK');
        expect(lastScript()).toContain('frontmost');
    });

    it('targets a process by pid via unixId', async () => {
        await findElement('OK', undefined, { pid: 501 });
        const script = lastScript();
        expect(script).toContain('unixId');
        expect(script).toContain('501');
    });

    it('embeds process name and role as quoted JS literals', async () => {
        await findElement('Dark', 'AXButton', { process: 'martensite' });
        const script = lastScript();
        expect(script).toContain('"martensite"');
        expect(script).toContain('"AXButton"');
        expect(script).not.toContain('${');
    });

    it('embeds window selector safely', async () => {
        await findElement('OK', undefined, { process: 'mart', window: 'Industrial' });
        const script = lastScript();
        expect(script).toContain('"Industrial"');
    });

    it('parses a found-element result including position', async () => {
        (runJXA as any).mockReturnValue(
            '{"found":true,"position":[10,20],"size":[30,10],"name":"Dark","role":"AXButton"}'
        );
        const result = await findElement('Dark', 'AXButton');
        expect(result.found).toBe(true);
        expect(result.position).toEqual([10, 20]);
        expect(result.size).toEqual([30, 10]);
    });

    it('escapes criteria containing double quotes via JSON.stringify', async () => {
        await findElement('Say "Hi"');
        const script = lastScript();
        // criteria is lowercased then JSON.stringify'd → script holds "say \"hi\""
        expect(script).toContain('say \\"hi\\"');
        // the raw unescaped form must not appear
        expect(script).not.toContain('say "hi"');
    });

    it('returns {found:false, error} when the target process is not found', async () => {
        (runJXA as any).mockReturnValue(
            '{"error":"target_not_found","detail":"No process matched target"}'
        );
        const result = await findElement('OK', undefined, { pid: 999 });
        expect(result.found).toBe(false);
        expect(result.error).toBe('No process matched target');
    });
});

describe('UI Service — getUITree targeting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (runJXA as any).mockReturnValue('{"role":"AXWindow","name":"w","description":"","position":[0,0],"size":[1,1]}');
    });

    it('uses the frontmost process when no target is given (back-compat)', async () => {
        const tree = await getUITree();
        expect(lastScript()).toContain('frontmost');
        expect(tree.role).toBe('AXWindow');
    });

    it('targets a process by name substring', async () => {
        await getUITree(3, { process: 'martensite' });
        const script = lastScript();
        expect(script).toContain('"martensite"');
        expect(script).toContain('bundleIdentifier');
    });

    it('throws an Error with the detail when the target is not found', async () => {
        (runJXA as any).mockReturnValue(
            '{"error":"target_not_found","detail":"No process matched target {\\"pid\\":999}"}'
        );
        await expect(getUITree(2, { pid: 999 })).rejects.toThrow('No process matched target');
    });
});
