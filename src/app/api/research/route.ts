import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, query } = await request.json()
    if (!title?.trim() || !query?.trim()) {
      return NextResponse.json({ error: 'Title and research question are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get patient context for relevance
    const [summaryRes, patientRes] = await Promise.all([
      admin.from('summary').select('content').eq('id', 1).single(),
      admin.from('patient_info').select('data').eq('id', 1).single(),
    ])
    const summary = summaryRes.data?.content || ''
    const patientInfo = patientRes.data?.data ? JSON.stringify(patientRes.data.data, null, 2) : ''

    // Create the research topic
    const { data: topic, error: insertError } = await admin
      .from('research_topics')
      .insert({
        title,
        query,
        status: 'researching',
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const client = new Anthropic({ apiKey })

    // Use web search to research the topic
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        },
      ],
      system: `You are a medical research assistant helping a family understand medical conditions and treatment options. You have web search capabilities to find current medical literature and information.

PATIENT CONTEXT (use this to make the research relevant):
${summary ? 'Summary: ' + summary.slice(0, 500) : 'No patient summary available.'}
${patientInfo ? 'Patient Info: ' + patientInfo.slice(0, 300) : ''}

IMPORTANT RULES:
- Search the web for current, authoritative medical information
- Cite specific sources with URLs
- Use reputable sources: medical journals, major hospital websites (Mayo Clinic, Cleveland Clinic, etc.), NIH, cancer.org, etc.
- Organize the review clearly with headers and sections
- Include statistics and outcomes data where available
- Note when information is from the patient's records vs. general research
- Add a disclaimer that this is for informational purposes and not medical advice
- Format in markdown

STRUCTURE YOUR RESPONSE AS:
## Overview
Brief explanation of the condition/procedure

## Key Findings from Current Research
Main findings organized by subtopic

## Treatment Options & Approaches
Available options with pros/cons where applicable

## Outcomes & Statistics
Success rates, recovery times, complications data

## Questions to Ask Your Doctor
Specific questions the family should consider asking

## Sources
List all sources with URLs`,
      messages: [
        {
          role: 'user',
          content: `Please conduct a thorough literature review on the following topic:\n\n**${title}**\n\n${query}`,
        },
      ],
    })

    // Extract text and sources
    let content = ''
    const sources: string[] = []
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text
      }
    }

    // Update the research topic
    await admin
      .from('research_topics')
      .update({
        content,
        sources: sources.join('\n'),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', topic.id)

    return NextResponse.json({ success: true, topic_id: topic.id })
  } catch (error) {
    console.error('Research error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
