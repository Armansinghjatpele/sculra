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
            <a href="/broken-link" data-testid="nav-broken">Broken Link (404)</a>
            <a href="https://external-example.com/docs" data-testid="nav-external" target="_blank">External Docs</a>
          </nav>

          <header>
            <h1>Sculra Deterministic Test Target</h1>
            <p>Target application for autonomous crawler and QA verification.</p>
          </header>

          <main>
            <section>
              <h2>Explore Platform Features</h2>
              <button id="explore-btn" data-testid="explore-btn" aria-label="Explore System">Explore Features</button>
              <button id="cta-broken-btn" class="btn-primary" data-testid="cta-broken-btn">Get Started Now</button>
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
            .delete-btn { background: #991b1b; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
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

          <!-- Dangerous / Destructive Button (Must be skipped by safety policy) -->
          <div style="margin-top: 2rem;">
            <h2>Destructive Account Management</h2>
            <button id="delete-account-btn" data-testid="delete-btn" class="delete-btn">Delete Account</button>
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
            input[type="text"], input[type="email"], input[type="password"], select { width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; }
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
              <label for="password">Account Password</label>
              <input type="password" id="password" name="password" placeholder="Enter password (sensitive)" />
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
            fetch('/analytics/collect').catch(function() {});
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
    } else if (pathname === '/responsive-scroll') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Intentional Horizontal Scroll</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; margin: 0; }
            .scroll-container { overflow-x: auto; width: 100%; max-width: 340px; border: 1px solid #334155; padding: 1rem; }
            .wide-table { width: 800px; border-collapse: collapse; }
            .wide-table td { border: 1px solid #475569; padding: 0.5rem; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Intentional Horizontal Data Table</h1>
          <div class="scroll-container overflow-x-auto" data-carousel="true" data-testid="intentional-scroll">
            <table class="wide-table">
              <tr><td>Column 1 (Data)</td><td>Column 2 (Metrics)</td><td>Column 3 (Status)</td><td>Column 4 (Extended QA Telemetry)</td></tr>
            </table>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/broken-overflow') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Broken Mobile Overflow Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 1rem; }
            .fixed-wide-banner { width: 850px; background: #dc2626; color: white; padding: 2rem; border-radius: 8px; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Broken Mobile Overflow Demo</h1>
          <div id="wide-overflow-banner" class="fixed-wide-banner">
            <h2>This Element Extends 850px Wide Unconditionally</h2>
            <p>Causes horizontal viewport scroll on mobile & tablet viewports without responsive wrapping.</p>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/clipped-button') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Clipped Button Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            .clipped-wrapper { width: 80px; height: 30px; overflow: hidden; border: 2px dashed #eab308; }
            .wide-action-btn { width: 220px; height: 48px; background: #3b82f6; color: white; border: none; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Clipped Interactive Control</h1>
          <div id="clipped-box" class="clipped-wrapper">
            <button id="severely-clipped-btn" class="wide-action-btn">Submit Order Now (Long Text)</button>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/overlapping-controls') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Overlapping Interactive Controls Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            .overlap-zone { position: relative; height: 200px; margin-top: 1rem; }
            .btn-a { position: absolute; top: 20px; left: 30px; width: 160px; height: 50px; background: #2563eb; color: white; }
            .btn-b { position: absolute; top: 25px; left: 40px; width: 160px; height: 50px; background: #dc2626; color: white; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Unrelated Elements Overlap Demo</h1>
          <div class="overlap-zone">
            <button id="overlap-primary-btn" class="btn-a">Confirm Order</button>
            <button id="overlap-cancel-btn" class="btn-b">Cancel Transaction</button>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/text-overflow') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Text Overflow Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            .clipped-text-btn { width: 90px; white-space: nowrap; overflow: hidden; background: #4f46e5; color: white; padding: 0.5rem; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <h1>Unclipped Text Truncation</h1>
          <button id="unhandled-text-overflow-btn" class="clipped-text-btn">Supercalifragilistic Autonomous QA Pipeline</button>
        </body>
        </html>
      `);
    } else if (pathname === '/layout-shift') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Layout Shift Demo</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            #shifted-header { margin-top: 0px; transition: none; }
          </style>
        </head>
        <body>
          <p><a href="/">← Back to Home</a></p>
          <button id="shift-trigger-btn" onclick="document.getElementById('shifted-header').style.marginTop = '180px';">Trigger Massive Layout Shift</button>
          <h1 id="shifted-header">Headline Affected By Sudden Layout Shift</h1>
        </body>
        </html>
      `);
    } else if (pathname === '/baseline-target') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Visual Baseline Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            .hero-card { background: #1e293b; padding: 2rem; border-radius: 8px; border: 1px solid #3b82f6; }
          </style>
        </head>
        <body>
          <h1>Visual Baseline Stable Page</h1>
          <div class="hero-card">
            <h2>Deterministic QA System v1.0</h2>
            <p>Stable visual state for screenshot regression comparison.</p>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/baseline-modified') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Visual Baseline Target</title>
          <style>
            body { font-family: sans-serif; background: #7f1d1d; color: #fef2f2; padding: 2rem; }
            .hero-card { background: #991b1b; padding: 2rem; border-radius: 8px; border: 4px solid #ef4444; }
          </style>
        </head>
        <body>
          <h1>Visual Baseline Stable Page (Modified!)</h1>
          <div class="hero-card">
            <h2>Deterministic QA System v2.0 Broken Theme</h2>
            <p>Significant visual color and layout difference detected!</p>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
    } else if (pathname === '/api/projects' || pathname === '/api/projects/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { id: 'proj-1', name: 'Project Alpha', status: 'active' },
        { id: 'proj-2', name: 'Project Beta', status: 'active' },
      ]));
    } else if (pathname.startsWith('/api/projects/')) {
      const id = pathname.replace('/api/projects/', '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: id || 'proj-1', name: `Project ${id || 'Alpha'}`, status: 'active' }));
    } else if (pathname === '/api/admin/users') {
      const cookieHeader = req.headers.cookie || '';
      const authHeader = req.headers.authorization || '';
      const isAdmin = /sculra_auth=[^;]*admin/i.test(cookieHeader) || authHeader.includes('admin');
      const isMember = /sculra_auth=[^;]*member/i.test(cookieHeader) || authHeader.includes('member');

      if (isAdmin) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([
          { id: 'usr-1', email: 'admin@example.com', role: 'ADMIN' },
          { id: 'usr-2', email: 'member@example.com', role: 'MEMBER' },
        ]));
      } else if (isMember) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Administrator privileges required' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Authentication required' }));
      }
    } else if (pathname === '/api/member/profile') {
      const cookieHeader = req.headers.cookie || '';
      const isAuthenticated = /sculra_auth=[^;]*/i.test(cookieHeader);
      if (isAuthenticated) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'usr-2', email: 'member@example.com', role: 'MEMBER' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Authentication required' }));
      }
    } else if (pathname === '/api/me') {
      const cookieHeader = req.headers.cookie || '';
      const isAdmin = /sculra_auth=[^;]*admin/i.test(cookieHeader);
      const isMember = /sculra_auth=[^;]*member/i.test(cookieHeader);

      if (isAdmin || isMember) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user: 'test-identity', role: isAdmin ? 'ADMIN' : 'MEMBER' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Authentication required' }));
      }
    } else if (pathname === '/api/fixture/500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Intentional Internal Server Error 500' }));
    } else if (pathname === '/api/fixture/invalid-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status": "broken", invalid_json_syntax: true,');
    } else if (pathname === '/api/fixture/schema-error') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'should-be-number', count: 'string-instead-of-int' }));
    } else if (pathname === '/api/fixture/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'slow-ok' }));
      }, 500);
      return;
    } else if (pathname === '/api/fixture/leak-panel') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sensitiveAdminData: 'leaked-secret-payload', roleRequired: 'ADMIN' }));
    } else if (pathname === '/api/openapi.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Sculra Fixture API',
          version: '1.0.0',
          description: 'Deterministic test target API specification',
        },
        paths: {
          '/api/health': {
            get: {
              operationId: 'getHealth',
              summary: 'Health check endpoint',
              responses: {
                '200': {
                  description: 'Health status OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['status', 'version'],
                        properties: {
                          status: { type: 'string' },
                          version: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/projects': {
            get: {
              operationId: 'listProjects',
              summary: 'List active projects',
              responses: {
                '200': {
                  description: 'Array of projects',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['id', 'name'],
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/admin/users': {
            get: {
              operationId: 'listAdminUsers',
              summary: 'Admin user management',
              responses: {
                '200': {
                  description: 'List of users (admin only)',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                      },
                    },
                  },
                },
                '403': { description: 'Forbidden' },
              },
            },
          },
          '/api/fixture/schema-error': {
            get: {
              operationId: 'getSchemaError',
              summary: 'Contract test endpoint',
              responses: {
                '200': {
                  description: 'Schema error probe',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['id', 'count'],
                        properties: {
                          id: { type: 'integer' },
                          count: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }));
    } else if (pathname === '/api/feedback' || pathname === '/api/safe-submit') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Fixture submission successful' }));
    } else if (pathname === '/api/failing-endpoint') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Intentional Internal Server Error 500' }));
    } else if (pathname === '/analytics/collect') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Analytics not found' }));
    } else if (pathname === '/login') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          const params = new URLSearchParams(body);
          const username = (params.get('username') || params.get('email') || '').trim().toLowerCase();
          const password = params.get('password') || '';

          if ((username === 'admin@example.com' || username === 'admin') && password === 'admin123') {
            res.writeHead(302, {
              Location: '/dashboard',
              'Set-Cookie': 'sculra_auth=admin-token; Path=/; HttpOnly; SameSite=Lax',
            });
            res.end();
          } else if ((username === 'member@example.com' || username === 'member') && password === 'member123') {
            res.writeHead(302, {
              Location: '/dashboard',
              'Set-Cookie': 'sculra_auth=member-token; Path=/; HttpOnly; SameSite=Lax',
            });
            res.end();
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8"><title>Sign in — Sculra Target</title></head>
              <body style="font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem;">
                <h1>Sign in to your account</h1>
                <p id="error-msg" style="color: #ef4444; font-weight: bold;">Invalid credentials</p>
                <form id="login-form" action="/login" method="POST">
                  <label for="username">Username or Email</label><br/>
                  <input type="text" id="username" name="username" value="${username}" required /><br/><br/>
                  <label for="password">Password</label><br/>
                  <input type="password" id="password" name="password" required /><br/><br/>
                  <button type="submit" id="login-submit">Sign in</button>
                </form>
              </body>
              </html>
            `);
          }
        });
        return;
      }

      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Sign in — Sculra Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            form { background: #1e293b; padding: 2rem; border-radius: 8px; max-width: 400px; }
            input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; margin-bottom: 1rem; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; }
            button { background: #0284c7; color: white; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <nav><a href="/" style="color: #38bdf8;">← Back to Home</a></nav>
          <h1>Sign in to your account</h1>
          <form id="login-form" action="/login" method="POST">
            <label for="username">Username or Email</label>
            <input type="text" id="username" name="username" placeholder="user@example.com" required />
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="••••••••" required />
            <button type="submit" id="login-submit" data-testid="login-submit">Sign in</button>
          </form>
        </body>
        </html>
      `);
    } else if (pathname === '/dashboard') {
      const cookieHeader = req.headers.cookie || '';
      const isAdmin = /sculra_auth=[^;]*admin/i.test(cookieHeader);
      const isMember = /sculra_auth=[^;]*member/i.test(cookieHeader);

      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Workspace Dashboard — Sculra Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            nav { background: #1e293b; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; gap: 1rem; align-items: center; }
            nav a { color: #38bdf8; text-decoration: none; font-weight: bold; }
            .badge { background: #0369a1; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <nav>
            <a href="/" data-testid="nav-home">Home</a>
            <a href="/dashboard" data-testid="nav-dashboard">Dashboard</a>
            <a href="/projects" data-testid="nav-projects">Projects</a>
            ${isAdmin ? '<a href="/admin/users" data-testid="nav-admin">Admin Users</a>' : ''}
            <div data-testid="avatar" class="badge">${isAdmin ? 'Role: ADMIN' : isMember ? 'Role: MEMBER' : 'Public'}</div>
            <button data-testid="logout-btn" onclick="document.cookie='sculra_auth=; Max-Age=0'; location.href='/login';">Log out</button>
          </nav>
          <h1>Workspace Dashboard</h1>
          <p>Welcome to your authenticated workspace session.</p>
          <div data-testid="dashboard-metrics" style="background: #1e293b; padding: 1.5rem; border-radius: 8px;">
            <h3>Active Workspace Metrics</h3>
            <p>Role authorization tier: <strong>${isAdmin ? 'ADMINISTRATOR' : isMember ? 'MEMBER' : 'ANONYMOUS'}</strong></p>
          </div>
        </body>
        </html>
      `);
    } else if (pathname === '/projects') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Projects List — Sculra Target</title>
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
            nav a { color: #38bdf8; text-decoration: none; margin-right: 1rem; }
            button { background: #0284c7; color: white; padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <nav><a href="/dashboard">← Dashboard</a></nav>
          <h1>Active Workspace Projects</h1>
          <button id="create-project-btn" data-testid="create-project-btn">Create New Project</button>
        </body>
        </html>
      `);
    } else if (pathname === '/admin/users') {
      const cookieHeader = req.headers.cookie || '';
      const isAdmin = /sculra_auth=[^;]*admin/i.test(cookieHeader);
      const isMember = /sculra_auth=[^;]*member/i.test(cookieHeader);

      if (isAdmin) {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Admin Users Management — Sculra Target</title>
            <style>
              body { font-family: sans-serif; background: #0b0f19; color: #e2e8f0; padding: 2rem; }
              nav a { color: #38bdf8; text-decoration: none; margin-right: 1rem; }
              table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
              th, td { border: 1px solid #334155; padding: 0.75rem; text-align: left; }
              th { background: #1e293b; }
              button { background: #0284c7; color: white; padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; }
            </style>
          </head>
          <body>
            <nav><a href="/dashboard">← Dashboard</a></nav>
            <h1>Admin Users & Organization Management</h1>
            <p>Administrative console for role permissions and member management.</p>
            <button id="invite-btn" data-testid="invite-btn">Invite New Member</button>
            <table>
              <thead><tr><th>User ID</th><th>Email</th><th>Role</th></tr></thead>
              <tbody>
                <tr><td>usr-1</td><td>admin@example.com</td><td>ADMIN</td></tr>
                <tr><td>usr-2</td><td>member@example.com</td><td>MEMBER</td></tr>
              </tbody>
            </table>
          </body>
          </html>
        `);
      } else if (isMember) {
        res.writeHead(403);
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><title>403 Forbidden</title></head>
          <body style="font-family: sans-serif; background: #0b0f19; color: #ef4444; padding: 2rem;">
            <h1>403 Forbidden</h1>
            <p>Access denied. Administrator privileges required to view user management console.</p>
          </body>
          </html>
        `);
      } else {
        res.writeHead(302, { Location: '/login' });
        res.end();
      }
    } else if (pathname === '/admin/leak-panel') {
      // Intentionally broken endpoint that leaks protected admin controls even to MEMBER role
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Leaked Admin Panel — Sculra Target</title>
        </head>
        <body style="font-family: sans-serif; background: #7f1d1d; color: #fef2f2; padding: 2rem;">
          <h1>Critical Admin Settings (Unprotected Vulnerability)</h1>
          <p>This endpoint intentionally omits role checks to test security boundary evaluation.</p>
        </body>
        </html>
      `);
    } else if (pathname === '/api/security/headers-bad') {
      res.setHeader('Set-Cookie', 'auth_token=raw12345; Path=/');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', warning: 'no security headers' }));
    } else if (pathname === '/api/security/headers-good') {
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Set-Cookie', 'session=secure_val; Path=/; HttpOnly; Secure; SameSite=Lax');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', secured: true }));
    } else if (pathname === '/api/security/cors-wildcard-creds') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cors: 'misconfigured_wildcard_creds' }));
    } else if (pathname === '/api/security/cors-reflected') {
      const origin = req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cors: 'reflected_origin' }));
    } else if (pathname === '/api/security/open-redirect') {
      const target =
        parsedUrl.searchParams.get('redirect') ||
        parsedUrl.searchParams.get('redirect_to') ||
        parsedUrl.searchParams.get('next') ||
        parsedUrl.searchParams.get('url') ||
        parsedUrl.searchParams.get('target') ||
        'https://evil.com/phish';
      res.writeHead(302, { Location: target });
      res.end();
    } else if (pathname === '/api/security/exposed-token') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'success',
          data: {
            aws_access_key: 'AKIAIOSFODNN7EXAMPLE',
            stripe_secret: ['sk', 'live', '51AbcDefGhIjKlMnOpQrStUvWxYz123456'].join('_'),
            github_pat: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
            jwt_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          },
        })
      );
    } else if (pathname === '/admin/sensitive-panel') {
      const cookie = req.headers.cookie || '';
      const isPrivAdmin = cookie.includes('sculra_role=ADMIN');
      const isPrivMember = cookie.includes('sculra_role=MEMBER');
      if (isPrivAdmin) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ secret_admin_data: 'classified_access_granted' }));
      } else if (isPrivMember) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Admin access required' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
    } else if (pathname === '/perf/slow-page') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Slow Performance Test Page</title></head>
          <body>
            <h1>Slow Page</h1>
            <p>Simulating delayed TTFB / Navigation timing.</p>
          </body>
          </html>
        `);
      }, 150);
    } else if (pathname === '/perf/page-with-resources') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page with Resources</title>
          <style>body { font-family: sans-serif; }</style>
        </head>
        <body>
          <h1>Page with Resources</h1>
          <button id="perf-action-btn" onclick="fetch('/api/perf/slow-endpoint').then(r=>r.json())">Click for API</button>
          <script src="/api/perf/large-resource"></script>
          <script>
            window.__perfTestReady = true;
          </script>
        </body>
        </html>
      `);
    } else if (pathname === '/api/perf/slow-endpoint') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', delayed: true }));
      }, 200);
    } else if (pathname === '/api/perf/large-resource') {
      const buffer = Buffer.from('/* Large JS */\nvar dummy = "' + 'a'.repeat(600 * 1024) + '";\n');
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Content-Length': buffer.length.toString(),
      });
      res.end(buffer);
    } else if (pathname === '/api/perf/unreliable-endpoint') {
      const isFail = Math.random() > 0.5;
      if (isFail) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service Temporarily Unavailable' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      }
    } else if (pathname === '/a11y/accessible') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Accessible Demo Page</title>
          <style>
            *, *::before, *::after { box-sizing: border-box; }
            body { font-family: sans-serif; background: #ffffff; color: #111827; margin: 0; padding: 1rem; }
            header { background: #f3f4f6; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
            nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem; }
            nav a { color: #1d4ed8; text-decoration: underline; font-weight: bold; min-height: 44px; display: inline-flex; align-items: center; }
            button { background: #1d4ed8; color: #ffffff; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; min-width: 48px; min-height: 48px; font-size: 1rem; }
            button:focus-visible, input:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
            .form-group { margin-bottom: 1.25rem; }
            label { display: block; font-weight: bold; margin-bottom: 0.25rem; color: #111827; }
            input[type="text"] { width: 100%; max-width: 100%; padding: 0.5rem; border: 1px solid #374151; border-radius: 4px; font-size: 1rem; color: #111827; background: #ffffff; }
            .error-message { color: #b91c1c; font-size: 0.875rem; margin-top: 0.25rem; }
            footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #374151; }
          </style>
        </head>
        <body>
          <header role="banner">
            <h1>Sculra Accessible Application</h1>
            <nav aria-label="Main Navigation">
              <a href="/" data-testid="nav-home">Home</a>
              <a href="/a11y/accessible" data-testid="nav-a11y" aria-current="page">Accessibility Demo</a>
            </nav>
          </header>

          <main id="main-content">
            <section aria-labelledby="form-section-title">
              <h2 id="form-section-title">User Feedback</h2>
              <form id="accessible-form" novalidate>
                <div class="form-group">
                  <label for="user-name">Full Name <span aria-hidden="true">*</span></label>
                  <input type="text" id="user-name" name="name" required aria-required="true" aria-describedby="name-desc" />
                  <div id="name-desc" style="font-size: 0.8rem; color: #4b5563;">Enter your full legal name</div>
                </div>

                <div class="form-group">
                  <label for="user-email">Email Address</label>
                  <input type="text" id="user-email" name="email" aria-invalid="true" aria-errormessage="email-error" />
                  <div id="email-error" class="error-message" role="alert">Please enter a valid email address.</div>
                </div>

                <button type="submit" id="submit-btn" aria-label="Submit Feedback Form">Submit</button>
              </form>
            </section>

            <section aria-labelledby="images-section-title" style="margin-top: 2rem;">
              <h2 id="images-section-title">Accessible Images</h2>
              <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='%231d4ed8' width='100' height='100'/></svg>" alt="Sculra Corporate Logo" width="100" height="100" />
            </section>

            <section aria-labelledby="dialog-section-title" style="margin-top: 2rem;">
              <h2 id="dialog-section-title">Accessible Modal Dialog</h2>
              <button id="open-modal-btn" aria-haspopup="dialog" onclick="document.getElementById('demo-dialog').style.display='block'">Open Confirmation Dialog</button>
              
              <div id="demo-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-heading" style="display: none; background: #ffffff; border: 2px solid #111827; padding: 2rem; position: fixed; top: 20%; left: 30%; z-index: 1000;">
                <h3 id="dialog-heading">Confirm Account Upgrade</h3>
                <p>Are you sure you want to upgrade your subscription?</p>
                <button id="confirm-btn" aria-label="Confirm Subscription Upgrade">Confirm</button>
                <button id="close-dialog-btn" aria-label="Close Dialog" onclick="document.getElementById('demo-dialog').style.display='none'">Close</button>
              </div>
            </section>
          </main>

          <footer role="contentinfo">
            <p>&copy; 2026 Sculra Autonomous QA. All rights reserved.</p>
          </footer>
        </body>
        </html>
      `);
    } else if (pathname === '/a11y/defects') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Accessibility Defects Page</title>
          <style>
            body { font-family: sans-serif; background: #ffffff; color: #111827; margin: 0; padding: 2rem; }
            .low-contrast-text { color: #bbbbbb; background: #ffffff; font-size: 14px; }
            .no-focus-outline:focus { outline: none !important; box-shadow: none !important; border-color: transparent !important; }
            .tiny-target { width: 14px; height: 14px; padding: 0; border: none; background: #ef4444; }
          </style>
        </head>
        <body>
          <!-- Intentionally missing <main> and <header> landmarks -->
          <div>
            <h1>Inaccessible Test Target</h1>
            
            <!-- Skipped Heading Level (H1 -> H4) -->
            <h4>Skipped Level Heading (H4 directly under H1)</h4>
            
            <!-- Low Contrast Element -->
            <p id="low-contrast-para" class="low-contrast-text">This text has insufficient contrast against the background.</p>

            <!-- Nameless button with no text or aria-label -->
            <button id="nameless-icon-btn" class="no-focus-outline">
              <svg width="16" height="16"><circle cx="8" cy="8" r="8" fill="blue"/></svg>
            </button>

            <!-- Form input without associated label -->
            <div style="margin-top: 1rem;">
              <input type="text" id="unlabeled-input" name="unlabeled" placeholder="No label here" />
            </div>

            <!-- Image missing alt attribute -->
            <div style="margin-top: 1rem;">
              <img id="missing-alt-img" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50'><rect fill='%23ef4444' width='50' height='50'/></svg>" />
              <img id="placeholder-alt-img" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50'><rect fill='%2310b981' width='50' height='50'/></svg>" alt="image.png" />
            </div>

            <!-- Broken ARIA: invalid role, broken aria-labelledby, aria-hidden on focusable -->
            <div role="fake-widget-role" id="invalid-role-element">Invalid role container</div>
            <button id="broken-labelled-btn" aria-labelledby="non-existent-label-id">Button with broken label reference</button>
            <button id="hidden-focusable-btn" aria-hidden="true">Hidden but focusable button</button>

            <!-- Tiny touch target for mobile (< 24px) -->
            <div style="margin-top: 1rem;">
              <button id="tiny-mobile-btn" class="tiny-target"></button>
            </div>

            <!-- Dialog missing accessible name -->
            <div id="unnamed-dialog" role="dialog" aria-modal="true" style="display: block; margin-top: 1rem; border: 1px solid black; padding: 1rem;">
              <p>Dialog with no title/aria-label</p>
            </div>
          </div>
        </body>
        </html>
      `);
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

export const createTestServer = createFixtureServer;
