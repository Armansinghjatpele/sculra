import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { BrowserRunner } from '../src/runner';

describe('Playwright Real Browser Execution Integration Test', () => {
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    // 1. Create a local deterministic fixture HTTP server
    server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Sculra Local Test Target</title>
          </head>
          <body style="background-color: #0d1117; color: #c9d1d9; font-family: sans-serif; padding: 2rem;">
            <h1>Welcome to Sculra Demo Target</h1>
            <p>Deterministic local fixture for autonomous QA verification.</p>
            <script>
              console.error("Sculra detected runtime error");
              fetch('/api/missing-endpoint').catch(() => {});
            </script>
          </body>
          </html>
        `);
      } else if (req.url === '/server-error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error 500');
      } else if (req.url === '/api/missing-endpoint') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should launch real Playwright Chromium, navigate, extract title, capture screenshot, console errors, and network errors', async () => {
    const runner = new BrowserRunner('integration-test-run-1', 'integration-proj-1', {
      allowLocalhost: true,
      headless: true,
      navigationTimeoutMs: 10000,
    });

    const result = await runner.run(serverUrl);

    // 1. Assert status and page metadata
    expect(result.status).toBe('passed');
    expect(result.pageTitle).toBe('Sculra Local Test Target');
    expect(result.finalUrl).toBe(`${serverUrl}/`);
    expect(result.statusCode).toBe(200);
    expect(result.durationMs).toBeGreaterThan(0);

    // 2. Assert real screenshot capture (PNG magic bytes)
    expect(result.screenshots.length).toBeGreaterThanOrEqual(1);
    const screenshot = result.screenshots[0];
    expect(screenshot.title).toContain('Sculra Local Test Target');
    expect(screenshot.mimeType).toBe('image/png');
    expect(screenshot.buffer).toBeInstanceOf(Buffer);
    expect(screenshot.buffer.length).toBeGreaterThan(100);
    // PNG file header check (\x89PNG\r\n\x1a\n)
    expect(screenshot.buffer[0]).toBe(0x89);
    expect(screenshot.buffer[1]).toBe(0x50); // P
    expect(screenshot.buffer[2]).toBe(0x4e); // N
    expect(screenshot.buffer[3]).toBe(0x47); // G

    // 3. Assert console error capture
    expect(result.consoleErrors.length).toBeGreaterThanOrEqual(1);
    const matchedConsole = result.consoleErrors.find((c) =>
      c.message.includes('Sculra detected runtime error')
    );
    expect(matchedConsole).toBeDefined();
    expect(matchedConsole?.url).toContain(serverUrl);

    // 4. Assert network error capture (404 on /api/missing-endpoint)
    expect(result.networkErrors.length).toBeGreaterThanOrEqual(1);
    const matchedNet = result.networkErrors.find((n) =>
      n.url.includes('/api/missing-endpoint')
    );
    expect(matchedNet).toBeDefined();
    expect(matchedNet?.status).toBe(404);
  }, 20000);

  it('should mark execution as failed when target returns HTTP 500 server error', async () => {
    const runner = new BrowserRunner('integration-test-run-2', 'integration-proj-1', {
      allowLocalhost: true,
      headless: true,
      navigationTimeoutMs: 10000,
    });

    const result = await runner.run(`${serverUrl}/server-error`);

    expect(result.status).toBe('failed');
    expect(result.statusCode).toBe(500);
    expect(result.failureReason).toContain('HTTP 500');
  }, 20000);
});
