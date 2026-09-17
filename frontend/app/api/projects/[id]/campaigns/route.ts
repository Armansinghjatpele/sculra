import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProjectCampaigns, getProject } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized user access. Please sign in.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Failed retrieving session authentication token.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const campaigns = await getProjectCampaigns(token, id);
    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    console.error('[API Projects/[id]/campaigns GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching project campaigns.' },
      { status: 500 }
    );
  }
}
