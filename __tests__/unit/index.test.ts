import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared hoisted spies — vi.mock factories are hoisted above imports,
// so everything they reference must live in vi.hoisted().
const h = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockAddTool: vi.fn(),
  serverInstances: [] as any[],
  initNutjs: vi.fn(),
  auditInfo: vi.fn(),
  auditEnd: vi.fn(),
  logError: vi.fn(),
  persistHistory: vi.fn(),
  registerMouseTools: vi.fn(),
  registerKeyboardTools: vi.fn(),
  registerScreenTools: vi.fn(),
  registerAutomationTools: vi.fn(),
  registerAdminTools: vi.fn(),
  registerElementTools: vi.fn(),
  registerVerifyTools: vi.fn(),
  sentryInit: vi.fn(),
  sentryWithScope: vi.fn(),
  sentryCaptureException: vi.fn(),
  getAuthStatus: vi.fn(() => 'authorized'),
  askForAccessibilityAccess: vi.fn(),
  askForScreenCaptureAccess: vi.fn(),
}));

vi.mock('../../src/server/mcp-server', () => ({
  MCPServer: class {
    start = h.mockStart;
    addTool = h.mockAddTool;
    constructor(
      public name?: string,
      public version?: string,
      public categories?: string[]
    ) {
      h.serverInstances.push(this);
    }
  },
}));

vi.mock('../../src/server/nutjs-integration', () => ({
  initNutjs: h.initNutjs,
}));

vi.mock('../../src/core/audit-logger', () => ({
  auditLogger: { info: h.auditInfo, end: h.auditEnd },
  logError: h.logError,
}));

vi.mock('../../src/core/action-logger', () => ({
  actionLogger: { persistHistory: h.persistHistory },
}));

vi.mock('../../src/tools/mouse-tools', () => ({
  registerMouseTools: h.registerMouseTools,
}));
vi.mock('../../src/tools/keyboard-tools', () => ({
  registerKeyboardTools: h.registerKeyboardTools,
}));
vi.mock('../../src/tools/screen-tools', () => ({
  registerScreenTools: h.registerScreenTools,
}));
vi.mock('../../src/tools/automation-tools', () => ({
  registerAutomationTools: h.registerAutomationTools,
}));
vi.mock('../../src/tools/admin-tools', () => ({
  registerAdminTools: h.registerAdminTools,
}));
vi.mock('../../src/tools/element-tools', () => ({
  registerElementTools: h.registerElementTools,
}));
vi.mock('../../src/tools/verify-tools', () => ({
  registerVerifyTools: h.registerVerifyTools,
}));

vi.mock('@sentry/node', () => ({
  init: h.sentryInit,
  withScope: h.sentryWithScope,
  captureException: h.sentryCaptureException,
}));

vi.mock('node-mac-permissions', () => ({
  getAuthStatus: h.getAuthStatus,
  askForAccessibilityAccess: h.askForAccessibilityAccess,
  askForScreenCaptureAccess: h.askForScreenCaptureAccess,
}));

const ALL_REGISTER_FNS = [
  'registerMouseTools',
  'registerKeyboardTools',
  'registerScreenTools',
  'registerAutomationTools',
  'registerAdminTools',
  'registerElementTools',
  'registerVerifyTools',
] as const;

describe('index.ts bootstrap', () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };
  const origConsole = { log: console.log, error: console.error, warn: console.warn };
  let onSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  const flushBootstrap = async () => {
    // bootstrap() is async; let its microtask queue settle
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setImmediate(r));
    }
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    h.serverInstances.length = 0;
    h.mockStart.mockResolvedValue(undefined);
    h.persistHistory.mockResolvedValue(undefined);
    h.getAuthStatus.mockReturnValue('authorized');
    process.env = { ...originalEnv };
    delete process.env.SENTRY_DSN;

    // bootstrap installs process handlers + may call process.exit — intercept
    onSpy = vi.spyOn(process, 'on').mockImplementation((() => process) as any);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    // redirectConsole() reroutes console.* to stderr — swallow it
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as any);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    console.log = origConsole.log;
    console.error = origConsole.error;
    console.warn = origConsole.warn;
    onSpy.mockRestore();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('initializes nutjs, registers all tool modules and starts the server', async () => {
    process.argv = [...process.argv, '--stdio'];
    await import('../../index.ts');
    await flushBootstrap();

    expect(h.initNutjs).toHaveBeenCalledTimes(1);
    expect(h.serverInstances.length).toBe(1);

    const server = h.serverInstances[0];
    for (const name of ALL_REGISTER_FNS) {
      expect(h[name]).toHaveBeenCalledTimes(1);
      expect(h[name]).toHaveBeenCalledWith(server);
    }

    expect(h.mockStart).toHaveBeenCalledTimes(1);
    expect(h.auditInfo).toHaveBeenCalledWith('Enterprise Server started');
  });

  it('registers shutdown handlers for SIGINT, SIGTERM and uncaughtException', async () => {
    await import('../../index.ts');
    await flushBootstrap();

    const registered = onSpy.mock.calls.map((c: any) => c[0]);
    expect(registered).toContain('SIGINT');
    expect(registered).toContain('SIGTERM');
    expect(registered).toContain('uncaughtException');
  });

  it('persists history and exits cleanly on SIGINT', async () => {
    await import('../../index.ts');
    await flushBootstrap();

    const sigint = onSpy.mock.calls.find((c: any) => c[0] === 'SIGINT')![1] as () => void;
    sigint();
    await flushBootstrap();

    expect(h.persistHistory).toHaveBeenCalled();
    expect(h.auditInfo).toHaveBeenCalledWith('Server shutdown', { signal: 'SIGINT' });
    expect(h.auditEnd).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with code 1 when shutdown cleanup fails', async () => {
    await import('../../index.ts');
    await flushBootstrap();

    h.persistHistory.mockRejectedValueOnce(new Error('persist fail'));
    const sigterm = onSpy.mock.calls.find((c: any) => c[0] === 'SIGTERM')![1] as () => void;
    sigterm();
    await flushBootstrap();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs uncaught exceptions and shuts down', async () => {
    await import('../../index.ts');
    await flushBootstrap();

    const onUncaught = onSpy.mock.calls.find((c: any) => c[0] === 'uncaughtException')![1] as (e: Error) => void;
    onUncaught(new Error('fatal bug'));
    await flushBootstrap();

    expect(h.logError).toHaveBeenCalledWith('uncaught_exception', expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('initializes Sentry when SENTRY_DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://key@sentry.example/1';
    await import('../../index.ts');
    await flushBootstrap();

    expect(h.sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@sentry.example/1' })
    );
  });

  it('defaults Sentry environment to development when NODE_ENV is unset', async () => {
    process.env.SENTRY_DSN = 'https://key@sentry.example/1';
    delete process.env.NODE_ENV;
    await import('../../index.ts');
    await flushBootstrap();

    expect(h.sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' })
    );
  });

  it('passes --category list to the MCPServer constructor', async () => {
    process.argv = [...process.argv, '--category=mouse, vision'];
    await import('../../index.ts');
    await flushBootstrap();

    expect(h.serverInstances[0].categories).toEqual(['mouse', 'vision']);
  });

  it('requests macOS permissions when not authorized', async () => {
    // checkPermissions() uses plain require(), which bypasses the ESM mock
    // and hits the real module — patch the real exports via createRequire.
    const { createRequire } = await import('node:module');
    const realPerms = createRequire(import.meta.url)('node-mac-permissions');
    const statusSpy = vi
      .spyOn(realPerms, 'getAuthStatus')
      .mockReturnValue('denied');
    const accessSpy = vi
      .spyOn(realPerms, 'askForAccessibilityAccess')
      .mockImplementation(() => {});
    const screenSpy = vi
      .spyOn(realPerms, 'askForScreenCaptureAccess')
      .mockImplementation(() => {});

    await import('../../index.ts');
    await flushBootstrap();

    expect(accessSpy).toHaveBeenCalled();
    expect(screenSpy).toHaveBeenCalled();
    statusSpy.mockRestore();
    accessSpy.mockRestore();
    screenSpy.mockRestore();
  });

  it('continues bootstrap when the permissions module fails', async () => {
    const { createRequire } = await import('node:module');
    const realPerms = createRequire(import.meta.url)('node-mac-permissions');
    const statusSpy = vi
      .spyOn(realPerms, 'getAuthStatus')
      .mockImplementation(() => {
        throw new Error('permissions unavailable');
      });

    await import('../../index.ts');
    await flushBootstrap();

    expect(h.mockStart).toHaveBeenCalled();
    statusSpy.mockRestore();
  });

  it('exits with code 1 when bootstrap fails', async () => {
    h.mockStart.mockRejectedValueOnce(new Error('start fail'));
    await import('../../index.ts');
    await flushBootstrap();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
