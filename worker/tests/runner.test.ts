import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRunner } from '../src/runner';

const { mockPage, mockContext, mockBrowser } = vi.hoisted(() => {
  const mockPage = {
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    on: vi.fn(),
    goto: vi.fn(),
    title: vi.fn().mockResolvedValue('Sculra Landing Page'),
    url: vi.fn().mockReturnValue('https://sculra.com'),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-png-data')),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { mockPage, mockContext, mockBrowser };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

describe('BrowserRunner Deterministic Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully execute navigation, extract page metadata, and capture screenshot', async () => {
    mockPage.goto.mockResolvedValue({
      status: vi.fn().mockReturnValue(200),
    });

    const runner = new BrowserRunner('test-run-1', 'proj-1', {
      allowLocalhost: false,
      enableDiscovery: false,
    });

    const result = await runner.run('https://sculra.com');

    expect(result.status).toBe('passed');
    expect(result.pageTitle).toBe('Sculra Landing Page');
    expect(result.finalUrl).toBe('https://sculra.com');
    expect(result.statusCode).toBe(200);
    expect(result.screenshots.length).toBe(1);
    expect(result.screenshots[0].title).toContain('Sculra Landing Page');
    expect(mockPage.screenshot).toHaveBeenCalled();
  });

  it('should fail execution and record failure reason on HTTP 500 server response', async () => {
    mockPage.goto.mockResolvedValue({
      status: vi.fn().mockReturnValue(500),
    });

    const runner = new BrowserRunner('test-run-2', 'proj-1', {
      allowLocalhost: false,
      enableDiscovery: false,
    });

    const result = await runner.run('https://sculra.com/error');

    expect(result.status).toBe('failed');
    expect(result.statusCode).toBe(500);
    expect(result.failureReason).toContain('HTTP 500');
  });

  it('should fail fast on SSRF violations before launching browser', async () => {
    const { chromium } = await import('playwright');

    const runner = new BrowserRunner('test-run-3', 'proj-1', {
      allowLocalhost: false,
      enableDiscovery: false,
    });

    const result = await runner.run('http://169.254.169.254/metadata');

    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Security Violation');
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it('should handle cancellation tokens cleanly', async () => {
    const runner = new BrowserRunner('test-run-4', 'proj-1', {
      enableDiscovery: false,
    });

    const result = await runner.run('https://sculra.com', {
      isCancelled: true,
    });

    expect(result.status).toBe('cancelled');
  });

  it('should capture console errors and network failures via attached listeners', async () => {
    let consoleHandler: any;
    let requestFailedHandler: any;
    let responseHandler: any;

    mockPage.on.mockImplementation((event: string, handler: any) => {
      if (event === 'console') consoleHandler = handler;
      if (event === 'requestfailed') requestFailedHandler = handler;
      if (event === 'response') responseHandler = handler;
    });

    mockPage.goto.mockImplementation(async () => {
      if (consoleHandler) {
        consoleHandler({
          type: () => 'error',
          text: () => 'Uncaught TypeError: Failed to fetch /api/data',
          location: () => ({ url: 'https://sculra.com/app.js', lineNumber: 42 }),
        });
      }

      if (requestFailedHandler) {
        requestFailedHandler({
          url: () => 'https://sculra.com/api/telemetry',
          method: () => 'POST',
          resourceType: () => 'fetch',
          failure: () => ({ errorText: 'net::ERR_CONNECTION_REFUSED' }),
        });
      }

      if (responseHandler) {
        responseHandler({
          url: () => 'https://sculra.com/api/auth',
          status: () => 401,
          statusText: () => 'Unauthorized',
          request: () => ({ method: () => 'POST', resourceType: () => 'xhr' }),
        });
      }

      return { status: () => 200 };
    });

    const runner = new BrowserRunner('test-run-5', 'proj-1', {
      enableDiscovery: false,
    });
    const result = await runner.run('https://sculra.com');

    expect(result.status).toBe('failed'); // Uncaught TypeError triggers failed status
    expect(result.consoleErrors.length).toBe(1);
    expect(result.consoleErrors[0].message).toContain('Uncaught TypeError');
    expect(result.networkErrors.length).toBe(2);
  });
});
