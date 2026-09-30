import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { validateTestUrl } from '../../../../../shared/utils/security';

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized user access' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, url, type, branch } = body;

    let targetUrl = typeof url === 'string' ? url.trim() : '';
    let targetType = (type || 'website').toLowerCase();
    let targetBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : undefined;

    // If projectId is provided, load the project details from Supabase to verify ownership & access
    if (projectId) {
      const token = await getToken();
      if (!token) {
        return NextResponse.json({ error: 'Failed retrieving session token' }, { status: 401 });
      }
      const project = await getProject(token, projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project target not found or access denied in this workspace' }, { status: 404 });
      }
      targetUrl = project.url || project.repoUrl || '';
      targetType = (project.type || 'website').toLowerCase();
      if (project.branch) {
        targetBranch = targetBranch || project.branch;
      }
    }

    // 1. Unsupported source types (zip, desktop)
    if (targetType === 'zip' || targetType === 'desktop') {
      return NextResponse.json({
        status: 'NOT_SUPPORTED',
        connected: false,
        statusCode: null,
        responseTime: null,
        error: `Source type "${targetType}" is not supported for automated execution in this environment.`,
      });
    }

    // 2. GitHub repository connection check
    if (targetType === 'github') {
      if (!targetUrl) {
        return NextResponse.json({
          status: 'INVALID',
          connected: false,
          statusCode: null,
          responseTime: null,
          error: 'GitHub repository URL is required.',
        }, { status: 400 });
      }

      const gitHubRegex = /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git)$/;
      if (!gitHubRegex.test(targetUrl)) {
        return NextResponse.json({
          status: 'INVALID',
          connected: false,
          statusCode: null,
          responseTime: null,
          error: 'Invalid GitHub repository URL format (e.g. https://github.com/company/project).',
        }, { status: 400 });
      }

      // Parse owner and repo name
      const match = targetUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);
      if (!match) {
        return NextResponse.json({
          status: 'INVALID',
          connected: false,
          statusCode: null,
          responseTime: null,
          error: 'Could not extract repository owner and name from URL.',
        }, { status: 400 });
      }

      const owner = match[1];
      const repo = match[2];
      const token = process.env.GITHUB_TOKEN;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Sculra-GitHub-Connection-Agent/1.0',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers,
          signal: controller.signal,
        });

        if (repoRes.status === 404) {
          clearTimeout(timeoutId);
          return NextResponse.json({
            status: 'NOT_CONNECTED',
            connected: false,
            statusCode: 404,
            responseTime: Date.now() - startTime,
            error: `Repository ${owner}/${repo} not found or private without configured credentials.`,
          });
        }

        if (repoRes.status === 401 || repoRes.status === 403) {
          clearTimeout(timeoutId);
          return NextResponse.json({
            status: 'UNAUTHORIZED',
            connected: false,
            statusCode: repoRes.status,
            responseTime: Date.now() - startTime,
            error: 'Repository access is unauthorized or requires credentials.',
          });
        }

        if (!repoRes.ok) {
          clearTimeout(timeoutId);
          return NextResponse.json({
            status: 'NOT_CONNECTED',
            connected: false,
            statusCode: repoRes.status,
            responseTime: Date.now() - startTime,
            error: `GitHub API error: ${repoRes.statusText}`,
          });
        }

        // If targetBranch is provided, verify branch exists
        if (targetBranch) {
          const branchRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(targetBranch)}`,
            { headers, signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (branchRes.status === 404) {
            return NextResponse.json({
              status: 'INVALID',
              connected: false,
              statusCode: 404,
              responseTime: Date.now() - startTime,
              error: `Branch "${targetBranch}" not found in repository ${owner}/${repo}.`,
            });
          }

          if (!branchRes.ok && branchRes.status !== 200) {
            return NextResponse.json({
              status: 'UNAUTHORIZED',
              connected: false,
              statusCode: branchRes.status,
              responseTime: Date.now() - startTime,
              error: `Could not verify branch "${targetBranch}": ${branchRes.statusText}`,
            });
          }
        } else {
          clearTimeout(timeoutId);
        }

        return NextResponse.json({
          status: 'CONNECTED',
          connected: true,
          statusCode: 200,
          responseTime: Date.now() - startTime,
          error: null,
          metadata: {
            owner,
            repo,
            branch: targetBranch || undefined,
          },
        });

      } catch (err: any) {
        return NextResponse.json({
          status: 'INSUFFICIENT_EVIDENCE',
          connected: false,
          statusCode: null,
          responseTime: Date.now() - startTime,
          error: err.name === 'AbortError'
            ? 'Connection to GitHub timed out after 6 seconds'
            : err.message || 'Network connection to GitHub failed',
        });
      }
    }

    // 3. Website & API target connection check
    if (!targetUrl) {
      return NextResponse.json({
        status: 'INVALID',
        connected: false,
        statusCode: null,
        responseTime: null,
        error: 'Target URL is required.',
      }, { status: 400 });
    }

    // Server-side URL & SSRF validation
    const urlValidation = validateTestUrl(targetUrl, {
      allowLocalhost: process.env.NODE_ENV === 'development',
    });

    if (!urlValidation.valid) {
      return NextResponse.json({
        status: 'INVALID',
        connected: false,
        statusCode: null,
        responseTime: null,
        error: urlValidation.error || 'Restricted host or invalid URL format.',
      }, { status: 400 });
    }

    let currentUrl = urlValidation.sanitizedUrl || targetUrl;
    let redirectCount = 0;
    const maxRedirects = 3;
    let finalResponse: Response | null = null;
    const startTime = Date.now();

    try {
      while (redirectCount <= maxRedirects) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Sculra-Connection-Agent/1.0',
            Accept: 'text/html,application/xhtml+xml,application/json,*/*',
          },
          signal: controller.signal,
          redirect: 'manual',
        });

        clearTimeout(timeoutId);

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get('location');
          if (!location) {
            finalResponse = res;
            break;
          }

          // Resolve redirect relative URL
          let resolvedRedirect: URL;
          try {
            resolvedRedirect = new URL(location, currentUrl);
          } catch {
            return NextResponse.json({
              status: 'INVALID',
              connected: false,
              statusCode: res.status,
              responseTime: Date.now() - startTime,
              error: `Invalid redirect location URL: ${location}`,
            }, { status: 400 });
          }

          // Enforce SSRF validation on the redirect target
          const redirectValidation = validateTestUrl(resolvedRedirect.toString(), {
            allowLocalhost: process.env.NODE_ENV === 'development',
          });

          if (!redirectValidation.valid) {
            return NextResponse.json({
              status: 'INVALID',
              connected: false,
              statusCode: res.status,
              responseTime: Date.now() - startTime,
              error: `Redirect to restricted destination host was blocked: ${redirectValidation.error}`,
            }, { status: 400 });
          }

          currentUrl = redirectValidation.sanitizedUrl || resolvedRedirect.toString();
          redirectCount++;
          if (redirectCount > maxRedirects) {
            return NextResponse.json({
              status: 'NOT_CONNECTED',
              connected: false,
              statusCode: res.status,
              responseTime: Date.now() - startTime,
              error: 'Exceeded maximum redirect limit (3 redirects).',
            });
          }
          continue;
        }

        finalResponse = res;
        break;
      }

      const responseTime = Date.now() - startTime;
      const isSuccess = finalResponse !== null && finalResponse.ok;

      return NextResponse.json({
        status: isSuccess ? 'CONNECTED' : 'NOT_CONNECTED',
        connected: isSuccess,
        statusCode: finalResponse ? finalResponse.status : null,
        responseTime,
        error: isSuccess ? null : `HTTP status code error: ${finalResponse?.status} ${finalResponse?.statusText || ''}`.trim(),
        normalizedUrl: currentUrl,
      });

    } catch (e: any) {
      const responseTime = Date.now() - startTime;
      return NextResponse.json({
        status: 'NOT_CONNECTED',
        connected: false,
        statusCode: null,
        responseTime,
        error: e.name === 'AbortError'
          ? 'Connection check timed out after 6 seconds'
          : e.message || 'DNS resolution or network connection failed',
      });
    }

  } catch (err: any) {
    console.error('[Connection Check Exception]:', err);
    return NextResponse.json({ error: 'Internal connection validator error' }, { status: 500 });
  }
}
