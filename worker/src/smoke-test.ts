// ==============================================================================
// Sculra Container-Level Browser Smoke Test (worker/src/smoke-test.ts)
// ==============================================================================
// Deterministic container smoke test proving Playwright package resolution,
// Chromium availability, OS dependency availability, headless launch, navigation,
// DOM interaction, screenshot rendering, and clean resource destruction.

import * as http from 'node:http';
import { chromium, Browser, Page } from 'playwright';

export interface SmokeTestResult {
  success: boolean;
  durationMs: number;
  chromiumVersion?: string;
  screenshotBytes?: number;
  error?: string;
}

export async function runBrowserSmokeTest(): Promise<SmokeTestResult> {
  const startTime = Date.now();
  let server: http.Server | null = null;
  let browser: Browser | null = null;

  try {
    // 1. Start local deterministic fixture server
    const fixtureHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sculra Worker Smoke Target</title>
</head>
<body>
  <h1 id="smoke-title">Sculra Autonomous QA Worker Smoke Test</h1>
  <button id="smoke-btn" onclick="document.getElementById('smoke-result').innerText = 'VERIFIED_OK'">Run Verification</button>
  <div id="smoke-result">PENDING</div>
</body>
</html>`;

    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
    });

    const port = await new Promise<number>((resolve, reject) => {
      server!.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        if (typeof addr === 'object' && addr !== null) {
          resolve(addr.port);
        } else {
          reject(new Error('Failed to obtain server address'));
        }
      });
      server!.on('error', reject);
    });

    console.log(`[Smoke Test]: Local fixture server running on http://127.0.0.1:${port}`);

    // 2. Launch Playwright Chromium
    console.log('[Smoke Test]: Launching Playwright Chromium headless...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const chromiumVersion = browser.version();
    console.log(`[Smoke Test]: Chromium launched successfully (version: ${chromiumVersion})`);

    // 3. Open page and navigate to deterministic test target
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page: Page = await context.newPage();

    console.log(`[Smoke Test]: Navigating to fixture...`);
    const response = await page.goto(`http://127.0.0.1:${port}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    if (!response || response.status() !== 200) {
      throw new Error(`Navigation failed with status ${response?.status()}`);
    }

    // 4. Perform minimal operation
    const titleText = await page.textContent('#smoke-title');
    if (!titleText || !titleText.includes('Sculra Autonomous QA Worker Smoke Test')) {
      throw new Error(`Unexpected page title content: "${titleText}"`);
    }

    await page.click('#smoke-btn');
    const resultText = await page.textContent('#smoke-result');
    if (resultText?.trim() !== 'VERIFIED_OK') {
      throw new Error(`Click interaction verification failed: "${resultText}"`);
    }

    // 5. Test screenshot rendering pipeline
    const screenshot = await page.screenshot({ type: 'png' });
    if (!screenshot || screenshot.length === 0) {
      throw new Error('Screenshot capture produced zero bytes');
    }
    console.log(`[Smoke Test]: Screenshot rendering verified (${screenshot.length} bytes)`);

    // 6. Close page and browser
    await context.close();
    await browser.close();
    browser = null;

    console.log('[Smoke Test]: Browser closed cleanly.');

    return {
      success: true,
      durationMs: Date.now() - startTime,
      chromiumVersion,
      screenshotBytes: screenshot.length,
    };
  } catch (err: any) {
    console.error('[Smoke Test Error]:', err.message);
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: err.message,
    };
  } finally {
    if (browser) {
      try {
        await (browser as Browser).close();
      } catch {}
    }
    if (server) {
      try {
        server.close();
      } catch {}
    }
  }
}

// CLI entrypoint
if (require.main === module) {
  console.log('[Smoke Test]: Initiating worker container browser smoke test...');
  runBrowserSmokeTest()
    .then((result) => {
      if (result.success) {
        console.log(`[Smoke Test]: PASSED in ${result.durationMs}ms. Chromium: ${result.chromiumVersion}`);
        process.exit(0);
      } else {
        console.error(`[Smoke Test]: FAILED: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[Smoke Test]: Fatal execution error:', err);
      process.exit(1);
    });
}
