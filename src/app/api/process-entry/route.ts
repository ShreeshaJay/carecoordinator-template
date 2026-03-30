import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { processEntry, extractTextFromImage, extractReferrals } from '@/lib/claude'
import { applyPatientInfoUpdates } from '@/lib/patient-utils'
import { logActivity } from '@/lib/activity-log'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content, category, entry_type, image_urls, images } = body

    // If there are images, extract text via Claude Vision OCR
    let fullContent = content || ''
    if (images && images.length > 0) {
      for (const img of images) {
        try {
          const extractedText = await extractTextFromImage(img.base64, img.mimeType)
          if (extractedText) {
            fullContent += '\n\n[Extracted from image]:\n' + extractedText
          }
        } catch (e) {
          console.error('OCR error:', e)
        }
      }
    }

    if (!fullContent.trim()) {
      return NextResponse.json({ error: 'No content to process' }, { status: 400 })
    }

    // Use admin client for DB operations to avoid RLS issues in API routes
    const admin = createAdminClient()

    // Save the raw entry
    const { data: entry, error: entryError } = await admin
      .from('entries')
      .insert({
        user_id: user.id,
        content: fullContent,
        category: category || 'General',
        entry_type: entry_type || 'text',
        image_urls: image_urls || [],
      })
      .select()
      .single()

    if (entryError) throw entryError

    // Get current summary
    const { data: summaryRow } = await admin
      .from('summary')
      .select('content')
      .eq('id', 1)
      .single()

    // Get current open action items
    const { data: actionItems } = await admin
      .from('action_items')
      .select('id, assignee, description, due_date, status')
      .eq('status', 'open')

    // Get current patient info
    const { data: patientRow } = await admin
      .from('patient_info')
      .select('data')
      .eq('id', 1)
      .single()

    // Process with Claude
    const result = await processEntry(
      summaryRow?.content || '',
      actionItems || [],
      fullContent,
      patientRow?.data as Record<string, unknown> | undefined,
      category
    )

    // Update summary
    await admin
      .from('summary')
      .update({ content: result.updated_summary, updated_at: new Date().toISOString() })
      .eq('id', 1)

    // Insert new timeline events
    if (result.new_timeline_events?.length > 0) {
      await admin.from('timeline_events').insert(
        result.new_timeline_events.map((e) => ({
          event_date: e.event_date,
          category: e.category,
          description: e.description,
          related_entry_id: entry.id,
        }))
      )
    }

    // Insert new action items
    if (result.new_action_items?.length > 0) {
      await admin.from('action_items').insert(
        result.new_action_items.map((a) => ({
          assignee: a.assignee,
          description: a.description,
          due_date: a.due_date || null,
          created_by: user.id,
        }))
      )
    }

    // Mark completed action items
    if (result.completed_action_item_ids?.length > 0) {
      await admin
        .from('action_items')
        .update({ status: 'done' })
        .in('id', result.completed_action_item_ids)
    }

    // Apply patient info updates
    if (result.patient_info_updates) {
      await applyPatientInfoUpdates(admin, result.patient_info_updates, user.id)
    }

    // Extract referrals with a dedicated Claude call
    const referrals = await extractReferrals(fullContent)
    if (referrals.length > 0) {
      const { data: existingRefs } = await admin.from('referrals').select('doctor_name')
      const existingNames = new Set((existingRefs || []).map((r: { doctor_name: string }) => r.doctor_name.toLowerCase()))
      const newRefs = referrals.filter(r => r.doctor_name && !existingNames.has(r.doctor_name.toLowerCase()))
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

    // Log activity
    await logActivity(admin, user.id, 'Submitted new entry', 'Entry', `Category: ${category || 'General'}. Content preview: ${fullContent.slice(0, 100)}...`)

    return NextResponse.json({ success: true, entry_id: entry.id })
  } catch (error) {
    console.error('Process entry error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
