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

    const { message } = await request.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get user's display name
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    const displayName = profile?.display_name || user.email?.split('@')[0] || 'User'

    // Save user message
    await admin.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: message,
      user_display_name: displayName,
    })

    // Gather context: summary, patient info, recent entries, referrals
    const [summaryRes, patientRes, entriesRes, referralsRes, chatHistoryRes] = await Promise.all([
      admin.from('summary').select('content').eq('id', 1).single(),
      admin.from('patient_info').select('data').eq('id', 1).single(),
      admin.from('entries').select('content, category, created_at').order('created_at', { ascending: false }).limit(10),
      admin.from('referrals').select('*').order('created_at', { ascending: false }),
      admin.from('chat_messages').select('role, content, user_display_name, created_at').order('created_at', { ascending: true }).limit(50),
    ])

    const summary = summaryRes.data?.content || ''
    const patientInfo = patientRes.data?.data ? JSON.stringify(patientRes.data.data, null, 2) : 'No patient info yet.'
    const recentEntries = (entriesRes.data || []).map((e: { created_at: string; category: string; content: string }) => `[${e.created_at}] [${e.category}] ${e.content.slice(0, 300)}`).join('\n---\n')
    const referralsText = (referralsRes.data || []).map((r: { doctor_name: string; specialty: string; hospital: string; response_status: string; next_steps: string }) =>
      `Dr. ${r.doctor_name} (${r.specialty}) at ${r.hospital} — Status: ${r.response_status}${r.next_steps ? ', Next: ' + r.next_steps : ''}`
    ).join('\n')

    // Build chat history for Claude (exclude the message we just saved — it's in the new user message)
    const history = (chatHistoryRes.data || []).slice(0, -1)
    const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (const msg of history) {
      const role = msg.role as 'user' | 'assistant'
      const content = role === 'user' ? `[${msg.user_display_name}]: ${msg.content}` : msg.content
      if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
        chatMessages[chatMessages.length - 1].content += '\n' + content
      } else {
        chatMessages.push({ role, content })
      }
    }

    // Add the new user message
    const newUserMsg = `[${displayName}]: ${message}`
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user') {
      chatMessages[chatMessages.length - 1].content += '\n' + newUserMsg
    } else {
      chatMessages.push({ role: 'user', content: newUserMsg })
    }

    if (chatMessages.length === 0 || chatMessages[0].role !== 'user') {
      chatMessages.unshift({ role: 'user', content: newUserMsg })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        },
      ],
      system: `You are a helpful medical care coordination assistant for a family managing a patient's diagnosis and treatment. You have access to two sources of information:

1. **Patient-specific information** from uploaded documents and entries (provided below)
2. **Web search** for general medical knowledge, research, statistics, and literature

IMPORTANT RULES:
- You are NOT a doctor. Never provide specific medical diagnoses or treatment recommendations for this patient.
- You CAN share general medical information, statistics, explain procedures, discuss treatment options generally, and reference medical literature.
- You CAN suggest specific questions the family should ask their doctors.
- You CAN help organize information and coordinate logistics.

CRITICAL — SOURCE DEMARCATION:
When answering, ALWAYS clearly separate information sources using these headers:

**📋 From Your Records:**
(Information from the uploaded documents, entries, and patient data below)

**🔬 From Medical Literature / General Knowledge:**
(Information from web searches or Claude's general medical knowledge)

If your answer only draws from one source, still use the appropriate header. This helps the family distinguish between their specific situation and general medical information.

When citing web sources, include the URLs so the family can read further.

PATIENT-SPECIFIC CONTEXT:

CURRENT SUMMARY:
${summary}

PATIENT INFO:
${patientInfo}

ACTIVE REFERRALS:
${referralsText || 'No referrals tracked yet.'}

RECENT ENTRIES (latest 10):
${recentEntries || 'No entries yet.'}

This is a shared family chat — multiple family members may be asking questions. Their names appear in brackets before their messages.`,
      messages: chatMessages,
    })

    // Extract text from response, handling both text and tool_use content blocks
    let assistantContent = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        assistantContent += block.text
      }
    }

    // Save assistant response
    await admin.from('chat_messages').insert({
      user_id: null,
      role: 'assistant',
      content: assistantContent,
      user_display_name: 'Claude',
    })

    return NextResponse.json({ success: true, response: assistantContent })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
