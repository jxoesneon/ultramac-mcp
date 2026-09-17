import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPServer } from '../../src/server/mcp-server';

vi.mock('../../src/services/ui-service', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        findElement: vi.fn(),
    };
});

vi.mock('../../src/services/applescript-service', () => ({
    runJXA: vi.fn(() => '{"found":true,"matched":"Dark mode"}'),
    runAS: vi.fn(),
}));

vi.mock('child_process', () => ({
    execFileSync: vi.fn(() => 'line1\nline2\nline3'),
}));

import { registerVerifyTools } from '../../src/tools/verify-tools';
import { findElement } from '../../src/services/ui-service';
import { runJXA } from '../../src/services/applescript-service';
import { execFileSync } from 'child_process';

const lastScript = (): string => {
    const calls = (runJXA as any).mock.calls;
    return calls[calls.length - 1][0] as string;
};

const lastExecArgs = (): [string, string[]] => {
    const calls = (execFileSync as any).mock.calls;
    return calls[calls.length - 1] as [string, string[]];
};

describe('Verify Tools', () => {
    let mockServer: any;
    let registeredTools: Map<string, any>;

    beforeEach(() => {
        vi.clearAllMocks();
        (runJXA as any).mockReturnValue('{"found":true,"matched":"Dark mode"}');
        (execFileSync as any).mockReturnValue('line1\nline2\nline3');
        registeredTools = new Map();
        mockServer = {
            addTool: vi.fn((tool) => {
                registeredTools.set(tool.name, tool);
            })
        };
        registerVerifyTools(mockServer as unknown as MCPServer);
    });

    it('should register all three verify tools', () => {
        expect(registeredTools.has('element_contains_text')).toBe(true);
        expect(registeredTools.has('assert_element_exists')).toBe(true);
        expect(registeredTools.has('recent_process_logs')).toBe(true);
    });

    it('element_contains_text embeds criteria/text as quoted literals and reports a match', async () => {
        const tool = registeredTools.get('element_contains_text');
        const result = await tool.execute({ criteria: 'Settings', text: 'Dark "Mode"' });
        const script = lastScript();
        // Inputs are embedded via JSON.stringify: quoted, lowercased, escaped.
        expect(script).toContain('"settings"');
        expect(script).toContain('dark \\"mode\\"');
        expect(script).not.toContain('${');
        expect(result).toContain('PASS');
        expect(result).toContain('Dark mode');
    });

    it('element_contains_text embeds target fields as quoted literals', async () => {
        const tool = registeredTools.get('element_contains_text');
        await tool.execute({ criteria: 'a', text: 'b', process: 'martensite', pid: 42, window: 'Main' });
        const script = lastScript();
        expect(script).toContain('"martensite"');
        expect(script).toContain('42');
        expect(script).toContain('"Main"');
        expect(script).toContain('unixId');
        expect(script).toContain('frontmost');
    });

    it('element_contains_text returns FAIL with error when evaluation fails', async () => {
        (runJXA as any).mockReturnValue('{"error":"target_not_found","detail":"No process matched"}');
        const tool = registeredTools.get('element_contains_text');
        const result = await tool.execute({ criteria: 'X', text: 'y', process: 'ghost' });
        expect(result).toContain('FAIL');
        expect(result).toContain('could not be evaluated');
        expect(result).toContain('No process matched');
    });

    it('element_contains_text falls back to error code when detail is absent', async () => {
        (runJXA as any).mockReturnValue('{"error":"window_not_found"}');
        const tool = registeredTools.get('element_contains_text');
        const result = await tool.execute({ criteria: 'X', text: 'y', window: 'nope' });
        expect(result).toContain('window_not_found');
    });

    it('element_contains_text returns FAIL with searched count when text is absent', async () => {
        (runJXA as any).mockReturnValue('{"found":false,"searched":7}');
        const tool = registeredTools.get('element_contains_text');
        const result = await tool.execute({ criteria: 'Panel', text: 'missing' });
        expect(result).toContain('FAIL');
        expect(result).toContain('7');
    });

    it('assert_element_exists returns pass:true with element details when found', async () => {
        (findElement as any).mockResolvedValue({
            found: true,
            name: 'OK',
            role: 'AXButton',
            position: [10, 20],
            size: [30, 12],
        });
        const tool = registeredTools.get('assert_element_exists');
        const result = JSON.parse(await tool.execute({ criteria: 'OK' }));
        expect(result.pass).toBe(true);
        expect(result.element.name).toBe('OK');
        expect(result.element.role).toBe('AXButton');
        expect(result.element.position).toEqual([10, 20]);
        expect(result.element.size).toEqual([30, 12]);
        expect(findElement).toHaveBeenCalledWith('OK', undefined, undefined);
    });

    it('assert_element_exists returns pass:false and forwards target when not found', async () => {
        (findElement as any).mockResolvedValue({ found: false });
        const tool = registeredTools.get('assert_element_exists');
        const result = JSON.parse(await tool.execute({
            criteria: 'Save',
            role: 'AXButton',
            process: 'mart',
            pid: 42,
            window: 0,
        }));
        expect(result.pass).toBe(false);
        expect(result.error).toBeTruthy();
        expect(findElement).toHaveBeenCalledWith('Save', 'AXButton', { process: 'mart', pid: 42, window: 0 });
    });

    it('recent_process_logs builds a process == predicate for a named process', async () => {
        const tool = registeredTools.get('recent_process_logs');
        const result = await tool.execute({ process: 'Safari' });
        const [cmd, args] = lastExecArgs();
        expect(cmd).toBe('log');
        expect(args).toContain('--predicate');
        expect(args).toContain('process == "Safari"');
        expect(args).toContain('30s');
        expect(result).toBe('line1\nline2\nline3');
    });

    it('recent_process_logs uses processIdentifier for a numeric process', async () => {
        const tool = registeredTools.get('recent_process_logs');
        await tool.execute({ process: '1234' });
        const [, args] = lastExecArgs();
        expect(args).toContain('processIdentifier == 1234');
    });

    it('recent_process_logs clamps seconds/limit and returns the last N lines', async () => {
        const tool = registeredTools.get('recent_process_logs');
        const result = await tool.execute({ process: 'x', seconds: 99999, limit: 2 });
        const [, args] = lastExecArgs();
        expect(args).toContain('300s');
        expect(result).toBe('line2\nline3');
    });

    it('recent_process_logs reports when no log lines are found', async () => {
        (execFileSync as any).mockReturnValue('\n\n');
        const tool = registeredTools.get('recent_process_logs');
        const result = await tool.execute({ process: 'Safari', seconds: 10 });
        expect(result).toContain('No log lines found');
        expect(result).toContain('Safari');
    });

    it('recent_process_logs returns an error string when log show fails', async () => {
        (execFileSync as any).mockImplementation(() => {
            throw new Error('timed out');
        });
        const tool = registeredTools.get('recent_process_logs');
        const result = await tool.execute({ process: 'x' });
        expect(result).toContain('Failed');
        expect(result).toContain('timed out');
    });
});
