// ==============================================================================
// Sculra Production Signal Detail API Route (GET)
// (frontend/app/api/projects/[id]/signals/[signalId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    const { id, signalId } = await params;
    await requireProjectPermission(req, id, PERMISSIONS.SIGNALS_READ);

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database service unavailable.' },
        { status: 503 }
      );
    }

    const { data: signal, error: sigError } = await supabase
      .from('production_signals')
      .select('*')
      .eq('id', signalId)
      .eq('project_id', id)
      .maybeSingle();

    if (sigError || !signal) {
      return NextResponse.json(
        { success: false, error: 'Production signal not found.' },
        { status: 404 }
      );
    }

    // Get correlations
    const { data: correlations } = await supabase
      .from('signal_correlations')
      .select('*')
      .eq('signal_id', signalId)
      .order('evaluated_at', { ascending: false });

    // Get QA memory records
    const { data: memoryRecords } = await supabase
      .from('qa_feedback_memory')
      .select('*')
      .eq('signal_id', signalId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      signal,
      correlations: correlations || [],
      memoryRecords: memoryRecords || [],
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching signal details.', code: err.code },
      { status }
    );
  }
}
