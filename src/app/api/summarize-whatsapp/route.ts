import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { summarizeWhatsApp } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text } = await request.json()
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const summary = await summarizeWhatsApp(text)
    return NextResponse.json({ summary })
  } catch (error) {
    console.error('WhatsApp summarize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to summarize' },
      { status: 500 }
    )
  }
}
