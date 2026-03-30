import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { processEntry, extractReferrals } from '@/lib/claude'
import { applyPatientInfoUpdates } from '@/lib/patient-utils'
import { logActivity } from '@/lib/activity-log'
import Anthropic from '@anthropic-ai/sdk'

async function extractDocxText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

async function extractPdfWithClaude(base64: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(`ANTHROPIC_API_KEY not available. ENV keys present: ${Object.keys(process.env).filter(k => k.includes('ANTHROPIC') || k.includes('SUPABASE')).join(', ')}`)
  }
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf' as const,
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extract all text content from this document. Preserve the structure — headers, sections, dates, names, values, and any tabular data. Return the extracted text as plain text, organized clearly.',
          },
        ],
      },
    ],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const description = formData.get('description') as string || ''
    const category = formData.get('category') as string || 'General'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Upload file to Supabase Storage
    const ext = file.name.split('.').pop()
    const storagePath = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from('uploads')
      .upload(storagePath, buffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = admin.storage.from('uploads').getPublicUrl(storagePath)

    // Save report record
    await admin.from('reports').insert({
      filename: file.name,
      file_url: publicUrl,
      description,
      uploaded_by: user.id,
    })

    // Extract text from document
    let extractedText = ''
    const lowerName = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf')
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')
    const isDoc = file.type === 'application/msword' || lowerName.endsWith('.doc')

    if (isPdf) {
      try {
        // Use Claude's native PDF reading — handles scanned docs, complex layouts, etc.
        const base64 = buffer.toString('base64')
        extractedText = await extractPdfWithClaude(base64)
      } catch (e) {
        console.error('PDF extraction error:', e)
        return NextResponse.json({
          success: true,
          ai_processed: false,
          message: 'Report uploaded but PDF text extraction failed: ' + (e instanceof Error ? e.message : 'Unknown error'),
        })
      }
    } else if (isDocx) {
      try {
        extractedText = await extractDocxText(buffer)
      } catch (e) {
        console.error('DOCX parse error:', e)
        return NextResponse.json({
          success: true,
          ai_processed: false,
          message: 'Report uploaded but Word document text extraction failed. You can manually add the key details via the Add Info page.',
        })
      }
    } else if (isDoc) {
      return NextResponse.json({
        success: true,
        ai_processed: false,
        message: 'Report uploaded. Old .doc format is not supported for auto-parsing — please save as .docx and re-upload, or paste the key details into Add Info.',
      })
    }

    if (!extractedText.trim()) {
      return NextResponse.json({
        success: true,
        ai_processed: false,
        message: 'Report uploaded successfully. This file type is not auto-parsed — you can add key details via Add Info.',
      })
    }

    // Save as an entry for audit trail
    const entryContent = `[Uploaded report: ${file.name}]${description ? '\nDescription: ' + description : ''}\n\nExtracted text:\n${extractedText}`

    const { data: entry, error: entryError } = await admin
      .from('entries')
      .insert({
        user_id: user.id,
        content: entryContent,
        category,
        entry_type: 'report',
        image_urls: [publicUrl],
      })
      .select()
      .single()

    if (entryError) throw entryError

    // Get current summary, action items, and patient info
    const { data: summaryRow } = await admin
      .from('summary')
      .select('content')
      .eq('id', 1)
      .single()

    const { data: actionItems } = await admin
      .from('action_items')
      .select('id, assignee, description, due_date, status')
      .eq('status', 'open')

    const { data: patientRow } = await admin
      .from('patient_info')
      .select('data')
      .eq('id', 1)
      .single()

    // Process with Claude
    const result = await processEntry(
      summaryRow?.content || '',
      actionItems || [],
      entryContent,
      patientRow?.data as Record<string, unknown> | undefined,
      category
    )

    // Debug: log what Claude returned
    console.log('Claude result keys:', Object.keys(result))
    console.log('new_referrals:', JSON.stringify(result.new_referrals))
    console.log('new_action_items:', JSON.stringify(result.new_action_items))
    console.log('patient_info_updates:', JSON.stringify(result.patient_info_updates))

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
          related_report_url: publicUrl,
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

    // Extract referrals with a dedicated, focused Claude call
    // Always run for "Referral" category, also run for other categories in case referrals are mentioned
    const isReferralDoc = category === 'Referral'
    console.log(`Extracting referrals (category: ${category}, isReferralDoc: ${isReferralDoc})...`)
    const referrals = await extractReferrals(extractedText, isReferralDoc)
    console.log(`Dedicated referral extraction found ${referrals.length} referrals`)

    if (referrals.length > 0) {
      const { data: existingRefs } = await admin.from('referrals').select('doctor_name')
      const existingNames = new Set((existingRefs || []).map((r: { doctor_name: string }) => r.doctor_name.toLowerCase()))
      const newRefs = referrals.filter(r => r.doctor_name && !existingNames.has(r.doctor_name.toLowerCase()))
      console.log(`After dedup: ${newRefs.length} new referrals to insert`)
      if (newRefs.length > 0) {
        const { error: refError } = await admin.from('referrals').insert(
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
        if (refError) console.error('Referral insert error:', refError)
        else console.log(`Inserted ${newRefs.length} referrals successfully`)
      }
    }

    // Log activity
    const { error: logError } = await admin.from('activity_log').insert({
      user_id: user.id,
      action: `Uploaded and processed report: ${file.name}`,
      category: 'Report',
      details: description || file.name,
    })
    if (logError) console.error('Activity log insert error:', logError)

    return NextResponse.json({
      success: true,
      ai_processed: true,
      message: 'Report uploaded and processed. Summary, timeline, action items, patient info, and referrals have been updated.',
    })
  } catch (error) {
    console.error('Process report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
