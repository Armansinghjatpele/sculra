import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized user access' }, { status: 401 });
    }

    const { projectId, url, type } = await req.json();

    let targetUrl = url;
    let targetType = type || 'website';

    // If projectId is provided, load the project details from Supabase database to verify ownership
    if (projectId) {
      const token = await getToken();
      if (!token) {
        return NextResponse.json({ error: 'Failed retrieving session token' }, { status: 401 });
      }
      const project = await getProject(token, projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project target not found or access denied' }, { status: 404 });
      }
      targetUrl = project.url || project.repoUrl;
      targetType = project.type;
    }

    if (targetType === 'github') {
      return NextResponse.json({
        status: 'connection_pending',
        statusCode: null,
        responseTime: null,
        error: 'Repository access is not connected yet.',
      });
    }

    // Otherwise, check website URL connection health
    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing target validation URL' }, { status: 400 });
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return NextResponse.json({
        status: 'connection_failed',
        statusCode: null,
        responseTime: null,
        error: 'Invalid target protocol: URL must start with http:// or https://',
      });
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s connection check timeout limit

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Sculra-Connection-Agent/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;

      return NextResponse.json({
        status: response.ok ? 'connected' : 'connection_failed',
        statusCode: response.status,
        responseTime,
        error: response.ok ? null : `HTTP status error code: ${response.status}`,
      });

    } catch (e: any) {
      const responseTime = Date.now() - start;
      return NextResponse.json({
        status: 'connection_failed',
        statusCode: null,
        responseTime,
        error: e.name === 'AbortError' ? 'Connection check timed out after 5 seconds' : e.message || 'DNS resolution failed',
      });
    }

  } catch (err: any) {
    console.error('[Connection Check Exception]:', err);
    return NextResponse.json({ error: 'Internal connection validator error' }, { status: 500 });
  }
}
