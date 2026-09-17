import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/applescript-service', () => ({
    runJXA: vi.fn(() => '{"found":false}'),
    runAS: vi.fn(),
}));

import { runJXA } from '../../src/services/applescript-service';
import {
    buildTargetPreamble,
    findElement,
    getActiveWindowInfo,
    getUITree,
    scanAppMenus,
    triggerMenuCommand,
} from '../../src/services/ui-service';

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

    it('falls back to the raw error code when no detail is provided', async () => {
        (runJXA as any).mockReturnValue('{"error":"target_not_found"}');
        const result = await findElement('OK');
        expect(result.found).toBe(false);
        expect(result.error).toBe('target_not_found');
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

    it('throws the detail when the window selector does not match', async () => {
        (runJXA as any).mockReturnValue(
            '{"error":"window_not_found","detail":"No window matched selector \\"nope\\""}'
        );
        await expect(getUITree(2, { window: 'nope' })).rejects.toThrow(
            'No window matched selector'
        );
    });

    it('throws the raw error code when no detail is provided', async () => {
        (runJXA as any).mockReturnValue('{"error":"window_not_found"}');
        await expect(getUITree(2)).rejects.toThrow('window_not_found');
    });
});

describe('UI Service — buildTargetPreamble', () => {
    it('embeds pid, process and window as JSON literals', () => {
        const preamble = buildTargetPreamble({ process: 'Safari', pid: 42, window: 'Main' });
        expect(preamble).toContain('var __targetPid = 42;');
        expect(preamble).toContain('var __targetProc = "Safari";');
        expect(preamble).toContain('var __targetWin = "Main";');
    });

    it('emits null literals when no target is given', () => {
        const preamble = buildTargetPreamble();
        expect(preamble).toContain('var __targetPid = null;');
        expect(preamble).toContain('var __targetProc = null;');
        expect(preamble).toContain('var __targetWin = null;');
    });

    it('embeds a numeric window index', () => {
        const preamble = buildTargetPreamble({ window: 2 });
        expect(preamble).toContain('var __targetWin = 2;');
    });
});

describe('UI Service — getActiveWindowInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns parsed title and bundleId from JXA output', () => {
        (runJXA as any).mockReturnValue('{"title":"Editor","bundleId":"com.example.app"}');
        const info = getActiveWindowInfo();
        expect(info).toEqual({ title: 'Editor', bundleId: 'com.example.app' });
        expect(lastScript()).toContain('frontmost');
    });

    it('returns null when runJXA throws', () => {
        (runJXA as any).mockImplementation(() => { throw new Error('JXA failed'); });
        expect(getActiveWindowInfo()).toBeNull();
    });

    it('returns null when the JXA output is not valid JSON', () => {
        (runJXA as any).mockReturnValue('not json');
        expect(getActiveWindowInfo()).toBeNull();
    });
});

describe('UI Service — scanAppMenus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (runJXA as any).mockReturnValue(
            '{"Copy":{"path":"Edit > Copy","shortcut":"C"},"Quit":{"path":"File > Quit","shortcut":"Q"}}'
        );
    });

    it('parses the menu map returned by JXA', async () => {
        const menus = await scanAppMenus();
        expect(menus.Copy).toEqual({ path: 'Edit > Copy', shortcut: 'C' });
        expect(menus.Quit.path).toBe('File > Quit');
    });

    it('defaults to the frontmost process when no appName is given', async () => {
        await scanAppMenus();
        const script = lastScript();
        expect(script).toContain('frontmost');
        expect(script).toContain('processes[""]');
    });

    it('embeds the app name via JSON.stringify for process lookup', async () => {
        await scanAppMenus('Safari');
        expect(lastScript()).toContain('processes["Safari"]');
    });

    it('escapes quotes inside the app name', async () => {
        await scanAppMenus('Weird "App"');
        const script = lastScript();
        expect(script).toContain('Weird \\"App\\"');
        expect(script).not.toContain('Weird "App"');
    });
});

describe('UI Service — triggerMenuCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true and builds quoted path parts for the target app', async () => {
        const result = await triggerMenuCommand('File > New Tab', 'Safari');
        expect(result).toBe(true);
        const script = lastScript();
        expect(script).toContain('pathParts = ["File", "New Tab"]');
        expect(script).toContain('processes["Safari"]');
        expect(runJXA).toHaveBeenCalledTimes(1);
    });

    it('defaults to the frontmost app when no appName is given', async () => {
        const result = await triggerMenuCommand('File > Quit');
        expect(result).toBe(true);
        const script = lastScript();
        expect(script).toContain('frontmost');
        expect(script).toContain('processes[""]');
    });

    it('escapes double quotes inside menu path parts', async () => {
        await triggerMenuCommand('Edit > Say "Hi"');
        const script = lastScript();
        expect(script).toContain('Say \\"Hi\\"');
        expect(script).not.toContain('Say "Hi"');
    });

    it('trims whitespace around path parts', async () => {
        await triggerMenuCommand('  File  >   Export  ');
        expect(lastScript()).toContain('pathParts = ["File", "Export"]');
    });
});
