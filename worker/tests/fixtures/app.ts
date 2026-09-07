// ==============================================================================
// Sculra Deterministic Local Test Target Fixture Application (worker/tests/fixtures/app.ts)
// ==============================================================================
// Node.js HTTP server hosting deterministic test pages for Playwright crawler & user journey verification.

import http from 'http';
import { AddressInfo } from 'net';

export interface FixtureServer {
  server: http.Server;
  url: string;
  close: () => Promise<void>;
}

export async function createFixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = parsedUrl.pathname;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (pathname === '/') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Sculra Test Target Home</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 2rem; }
            nav { background: #1e293b; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; gap: 1rem; }
            nav a { color: #38bdf8; text-decoration: none; font-weight: bold; }
            button { background: #0284c7; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <nav aria-label="Main Navigation">
            <a href="/" data-testid="nav-home">Home</a>
            <a href="/features" data-testid="nav-features">Features</a>
            <a href="/second" data-testid="nav-second">Second Page</a>
            <a href="/form" data-testid="nav-form">Registration Form</a>
            <a href="/error" data-testid="nav-error">Error Page</a>
            <a href="/responsive" data-testid="nav-responsive">Responsive Layout</a>
          </nav>

          <header>
            <h1>Sculra Deterministic Test Target</h1>
            <p>Target application for autonomous crawler and QA verification.</p>
          </header>

          <main>
            <section>
              <h2>Explore Platform Features</h2>
              <button id="explore-btn" data-testid="explore-btn" aria-label="Explore System">Explore Features</button>
            </section>

            <section style="margin-top: 2rem;">
              <form id="search-form" action="/search" method="GET">
                <label for="search-input">Search Documentation</label>
                <input type="search" id="search-input" name="q" placeholder="Type keyword..." />
                <button type="submit" id="search-submit">Search</button>
              </form>
            </section>
          </main>
        </body>
        </html>
      `);
    } else if (pathname === '/features') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Platform Features & Controls</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            nav a { color: #38bdf8; text-decoration: none; margin-right: 1rem; }
            details { background: #1e293b; padding: 1rem; border-radius: 6px; margin: 1rem 0; }
            summary { font-weight: bold; cursor: pointer; color: #38bdf8; }
            .tab-btn { background: #334155; color: white; padding: 0.5rem 1rem; border: none; cursor: pointer; margin-right: 0.5rem; }
            .tab-content { display: none; padding: 1rem; background: #1e293b; border-radius: 6px; margin-top: 0.5rem; }
            .tab-content.active { display: block; }
            .broken-btn { background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <nav><a href="/">← Back to Home</a></nav>
          <h1>Platform Features & Interactive Controls</h1>

          <!-- Accordion / Expandable Control -->
          <details id="faq-accordion" data-testid="faq-details">
            <summary>What is the Sculra QA Engine?</summary>
            <p id="faq-answer">Sculra provides autonomous, deterministic quality assurance engineering.</p>
          </details>

          <!-- Stateful Tab Controls -->
          <div style="margin-top: 2rem;">
            <h2>Feature Navigation Tabs</h2>
            <button class="tab-btn" id="tab-btn-1" onclick="document.getElementById('tab-1').classList.add('active'); document.getElementById('tab-2').classList.remove('active');">Crawler</button>
            <button class="tab-btn" id="tab-btn-2" onclick="document.getElementById('tab-2').classList.add('active'); document.getElementById('tab-1').classList.remove('active');">Visual QA</button>

            <div id="tab-1" class="tab-content active">
              <h3>Autonomous Discovery Crawler</h3>
              <p>Crawls safe same-origin pages and constructs resilient application maps.</p>
            </div>
            <div id="tab-2" class="tab-content">
              <h3>Visual Regression Engine</h3>
              <p>Performs multi-viewport layout validation.</p>
            </div>
          </div>

          <!-- Intentionally Broken Interaction (No-Op action that creates no state mutation) -->
          <div style="margin-top: 2rem;">
            <h2>Deterministic Broken Control</h2>
            <p>This button is clickable but intentionally triggers zero state change:</p>
            <button id="broken-btn" data-testid="broken-btn" class="broken-btn">Broken No-Op Action</button>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/second') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Secondary Page: Interactive Controls</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            a { color: #38bdf8; }
            button { background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <p><a href="/" data-testid="back-home">← Back to Home</a></p>
          <h1>Secondary Page: Interactive Controls</h1>
          <p>Interactive counter control:</p>
          <button id="counter-btn" aria-label="Increment Counter" onclick="this.innerText = 'Count: 1'">Count: 0</button>
        </body>
        </html>
      `);
    } else if (pathname === '/form') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Registration & Feedback Form</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            form { background: #1e293b; padding: 2rem; border-radius: 8px; max-width: 480px; }
            .group { margin-bottom: 1rem; }
            label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; }
            input[type="text"], input[type="email"], select { width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; }
            button { background: #3b82f6; color: white; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; }
            #submit-result { display: none; margin-top: 1rem; padding: 1rem; background: #065f46; border-radius: 6px; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Registration & Feedback Form</h1>
          
          <!-- Explicit Fixture Safe Submit Form -->
          <form id="feedback-form" data-sculra-safe-submit="true" action="/api/feedback" method="POST" onsubmit="event.preventDefault(); document.getElementById('submit-result').style.display = 'block';">
            <div class="group">
              <label for="fullname">Full Name</label>
              <input type="text" id="fullname" name="fullname" placeholder="Jane Doe" required />
            </div>

            <div class="group">
              <label for="email">Email Address</label>
              <input type="email" id="email" name="email" placeholder="jane@example.com" required />
            </div>

            <div class="group">
              <label for="inquiry_type">Inquiry Category</label>
              <select id="inquiry_type" name="inquiry_type">
                <option value="support">Technical Support</option>
                <option value="sales">Sales Inquiry</option>
                <option value="feedback">Product Feedback</option>
              </select>
            </div>

            <div class="group">
              <label>
                <input type="checkbox" id="newsletter" name="newsletter" value="yes" />
                Subscribe to monthly QA engineering newsletter
              </label>
            </div>

            <div class="group">
              <label>Priority:</label>
              <label><input type="radio" name="priority" value="normal" checked /> Normal</label>
              <label><input type="radio" name="priority" value="urgent" /> Urgent</label>
            </div>

            <button type="submit" id="submit-feedback" data-testid="submit-btn">Submit Feedback</button>
            <div id="submit-result">Fixture submission successful</div>
          </form>
        </body>
        </html>
      `);
    } else if (pathname === '/error') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Intentional Error Page</title>
        </head>
        <body>
          <h1>Intentional Error Target</h1>
          <p>This page intentionally throws runtime exceptions for telemetry testing.</p>
          <script>
            console.error("Sculra Intentional Runtime Error in Fixture");
            fetch('/api/failing-endpoint').catch(function() {});
          </script>
        </body>
        </html>
      `);
    } else if (pathname === '/responsive') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Responsive Content Page</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            .desktop-content { display: block; padding: 2rem; background: #1e3a8a; border-radius: 8px; }
            .mobile-content { display: none; padding: 1rem; background: #701a75; border-radius: 8px; }
            @media (max-width: 600px) {
              .desktop-content { display: none; }
              .mobile-content { display: block; }
            }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Responsive Layout Demonstration</h1>
          <div class="desktop-content" data-testid="desktop-view">
            <h2>Desktop Multi-Column Hero</h2>
            <p>Wide viewport detected (>= 601px).</p>
          </div>
          <div class="mobile-content" data-testid="mobile-view">
            <h2>Mobile Compact Drawer</h2>
            <p>Narrow viewport detected (<= 600px).</p>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/api/feedback' || pathname === '/api/safe-submit') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Fixture submission successful' }));
    } else if (pathname === '/api/failing-endpoint') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Intentional Internal Server Error 500' }));
    } else if (pathname === '/server-error') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Fatal 500 Internal Server Error');
    } else {
      res.writeHead(404);
      res.end('404 Not Found');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        url,
        close: async () => {
          return new Promise<void>((resClose) => {
            server.close(() => resClose());
          });
        },
      });
    });
  });
}
