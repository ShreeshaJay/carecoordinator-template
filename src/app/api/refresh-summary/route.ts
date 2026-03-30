import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { refreshSummary } from '@/lib/claude'
import { replacePatientInfo } from '@/lib/patient-utils'
import { logActivity } from '@/lib/activity-log'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Get all entries
    const { data: entries } = await admin
      .from('entries')
      .select('content, category, created_at')
      .order('created_at', { ascending: true })

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: 'No entries to summarize' }, { status: 400 })
    }

    const result = await refreshSummary(entries)

    // Update summary
    await admin
      .from('summary')
      .update({ content: result.summary, updated_at: new Date().toISOString() })
      .eq('id', 1)

    // Update patient info from all entries
    if (result.patient_info) {
      await replacePatientInfo(admin, result.patient_info, user.id)
    }

    // Rebuild referrals (clear existing auto-created ones and re-insert)
    if (result.referrals?.length) {
      // Get existing referrals to avoid destroying manually-edited ones
      const { data: existingRefs } = await admin.from('referrals').select('doctor_name')
      const existingNames = new Set((existingRefs || []).map((r: { doctor_name: string }) => r.doctor_name.toLowerCase()))
      const newRefs = result.referrals.filter(r => r.doctor_name && !existingNames.has(r.doctor_name.toLowerCase()))
      if (newRefs.length > 0) {
        await admin.from('referrals').insert(
          newRefs.map(r => ({
            doctor_name: r.doctor_name,
            specialty: r.specialty || '',
            hospital: r.hospital || '',
            phone: r.phone || '',
            fax: r.fax || '',
            email: r.email || '',
            date_referred: r.date_referred || null,
            date_faxed: r.date_faxed || null,
            date_called: r.date_called || null,
            response_status: r.response_status || 'Pending',
            appointment_date: r.appointment_date || null,
            next_steps: r.next_steps || '',
            notes: r.notes || '',
            created_by: user.id,
          }))
        )
      }
    }

    await logActivity(admin, user.id, 'Refreshed summary from all entries', 'Summary', `Processed ${entries.length} entries`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Refresh summary error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
