import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Export all tables in parallel
    const [
      summaryRes,
      entriesRes,
      timelineRes,
      actionItemsRes,
      reportsRes,
      patientRes,
      referralsRes,
      activityRes,
    ] = await Promise.all([
      admin.from('summary').select('*'),
      admin.from('entries').select('*').order('created_at', { ascending: true }),
      admin.from('timeline_events').select('*').order('event_date', { ascending: true }),
      admin.from('action_items').select('*').order('created_at', { ascending: true }),
      admin.from('reports').select('*').order('uploaded_at', { ascending: true }),
      admin.from('patient_info').select('*'),
      admin.from('referrals').select('*').order('created_at', { ascending: true }),
      admin.from('activity_log').select('*').order('created_at', { ascending: true }),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      summary: summaryRes.data?.[0] || null,
      patient_info: patientRes.data?.[0] || null,
      entries: entriesRes.data || [],
      timeline_events: timelineRes.data || [],
      action_items: actionItemsRes.data || [],
      reports: reportsRes.data || [],
      referrals: referralsRes.data || [],
      activity_log: activityRes.data || [],
    }

    const filename = `carecoordinator-backup-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}
