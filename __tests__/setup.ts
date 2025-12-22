import { vi, beforeAll, afterEach } from 'vitest';

// Mock external dependencies that interact with the OS
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('run-applescript', () => ({
  runAppleScript: vi.fn(),
}));

vi.mock('node-mac-permissions', () => ({
  askForAccessibilityPermissions: vi.fn(),
  askForScreenCapturePermissions: vi.fn(),
  getAuthStatus: vi.fn(() => 'authorized'),
}));

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(),
  }
}));

vi.mock('sharp', () => {
  const sharpMock = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-buffer')),
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
  }));
  return { default: sharpMock };
});

// Mock environment variables
process.env.ULTRAMAC_MCP_HISTORY_SECRET = 'test-secret-32-chars-long-12345678';
process.env.NODE_ENV = 'test';

afterEach(() => {
  vi.clearAllMocks();
});
