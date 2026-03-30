import Anthropic from '@anthropic-ai/sdk'
import { PROCESS_ENTRY_PROMPT, REFRESH_SUMMARY_PROMPT, OCR_PROMPT, WHATSAPP_SUMMARIZE_PROMPT } from './prompts'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Check your environment variables in Vercel dashboard.')
  }
  return new Anthropic({ apiKey })
}

export interface PatientInfoUpdates {
  name?: string | null
  dob?: string | null
  health_card?: string | null
  medications?: string | null
  allergies?: string | null
  insurance_notes?: string | null
  new_doctors?: Array<{
    name: string
    specialty: string
    hospital: string
    contact: string
  }>
  diagnosis_updates?: Array<{
    organ: string
    details: string
  }>
}

export interface ReferralData {
  doctor_name: string
  specialty: string
  hospital: string
  phone?: string | null
  fax?: string | null
  email?: string | null
  date_referred?: string | null
  date_faxed?: string | null
  date_called?: string | null
  response_status?: string
  appointment_date?: string | null
  next_steps?: string
  notes?: string
}

export interface ProcessEntryResult {
  updated_summary: string
  new_timeline_events: Array<{
    event_date: string
    category: string
    description: string
  }>
  new_action_items: Array<{
    assignee: string
    description: string
    due_date: string | null
  }>
  completed_action_item_ids: string[]
  patient_info_updates?: PatientInfoUpdates
  new_referrals?: ReferralData[]
}

export interface RefreshResult {
  summary: string
  patient_info: {
    name?: string | null
    dob?: string | null
    health_card?: string | null
    medications?: string | null
    allergies?: string | null
    insurance_notes?: string | null
    doctors?: Array<{
      name: string
      specialty: string
      hospital: string
      contact: string
    }>
    diagnoses?: Array<{
      organ: string
      details: string
    }>
  }
  referrals?: ReferralData[]
}

export async function processEntry(
  currentSummary: string,
  currentActionItems: Array<{ id: string; assignee: string; description: string; due_date: string | null; status: string }>,
  newEntry: string,
  currentPatientInfo?: Record<string, unknown>,
  category?: string
): Promise<ProcessEntryResult> {
  const anthropic = getClient()

  const categoryHint = category === 'WhatsApp Chat'
    ? '\n\nIMPORTANT: The user has tagged this as a WhatsApp Chat. This is a copy-pasted group chat conversation between family members. It WILL contain typos, abbreviations, emojis, informal language, back-and-forth discussion, and off-topic chatter. Your job is to carefully read through the entire conversation and extract ONLY the medically relevant facts, decisions, updates, and action items. Ignore greetings, reactions, and casual conversation.\n'
    : category === 'Referral'
    ? '\n\nIMPORTANT: The user has tagged this as Referral information. Pay special attention to extracting specialist doctor referrals into the new_referrals field.\n'
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `${PROCESS_ENTRY_PROMPT}${categoryHint}

---

CURRENT SUMMARY:
${currentSummary || 'No summary yet.'}

CURRENT ACTION ITEMS:
${currentActionItems.length > 0
  ? currentActionItems.map(a => `- [${a.id}] ${a.assignee}: ${a.description} (due: ${a.due_date || 'unset'}, status: ${a.status})`).join('\n')
  : 'No action items yet.'}

CURRENT PATIENT PROFILE:
${currentPatientInfo ? JSON.stringify(currentPatientInfo, null, 2) : 'No patient info yet.'}

NEW INFORMATION (Category: ${category || 'General'}):
${newEntry}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON')
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch (parseError) {
    // Try to fix common JSON issues: trailing commas, truncation
    let fixed = jsonMatch[0]
    // Remove trailing commas before ] or }
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')
    // If JSON is truncated (no closing braces), try to close it
    const openBraces = (fixed.match(/\{/g) || []).length
    const closeBraces = (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/\]/g) || []).length
    // Close any unclosed strings (look for odd number of unescaped quotes)
    if (openBrackets > closeBrackets || openBraces > closeBraces) {
      // Truncated response — close open arrays and objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']'
      for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}'
    }
    try {
      return JSON.parse(fixed)
    } catch {
      console.error('Failed to parse Claude JSON even after fix attempt. Raw:', text.slice(0, 500))
      throw new Error('Claude returned malformed JSON. The response may have been too long. Try submitting shorter content.')
    }
  }
}

export async function summarizeWhatsApp(chatText: string): Promise<string> {
  const anthropic = getClient()
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${WHATSAPP_SUMMARIZE_PROMPT}\n\n---\n\nWHATSAPP CONVERSATION:\n${chatText}`,
      },
    ],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function refreshSummary(allEntries: Array<{ content: string; category: string; created_at: string }>): Promise<RefreshResult> {
  const anthropic = getClient()
  const entriesText = allEntries
    .map(e => `[${e.created_at}] [${e.category}]\n${e.content}`)
    .join('\n\n---\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `${REFRESH_SUMMARY_PROMPT}\n\n---\n\nALL ENTRIES:\n${entriesText}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // Fallback: treat the whole response as summary text
    return { summary: text, patient_info: {} }
  }

  return JSON.parse(jsonMatch[0])
}

export async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  const anthropic = getClient()
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: OCR_PROMPT,
          },
        ],
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function extractTextFromDocument(base64: string, mediaType: string): Promise<string> {
  const anthropic = getClient()
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType as 'application/pdf',
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

export async function extractReferrals(text: string, isReferralDoc: boolean = false): Promise<ReferralData[]> {
  const anthropic = getClient()
  const contextHint = isReferralDoc
    ? 'This document has been explicitly tagged as a REFERRAL document by the user. It DEFINITELY contains referral information — extract every doctor/specialist mentioned as a referral.\n\n'
    : ''
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${contextHint}Extract ALL specialist doctor referrals from the following text. A referral is any mention of a specialist doctor that the patient is being referred to, has been referred to, or whose appointment is being arranged. Any doctor mentioned by name in a referral context should be extracted.

For each referral, extract as much of the following as available:
- doctor_name: The specialist's name
- specialty: Their medical specialty (e.g., Urologic Oncologist, Gynecologic Oncologist, Surgeon)
- hospital: Hospital or clinic name
- phone: Phone number
- fax: Fax number
- email: Email address
- date_referred: Date the referral was made (YYYY-MM-DD format)
- date_faxed: Date the referral fax was sent (YYYY-MM-DD format)
- date_called: Date someone called about the referral (YYYY-MM-DD format)
- response_status: One of: Pending, Fax Sent, Called, Waiting for Response, Appointment Booked, Declined, Completed
- appointment_date: Scheduled appointment date if any (YYYY-MM-DD format)
- next_steps: What needs to happen next
- notes: Any additional context

RULES:
- ONLY extract referrals explicitly mentioned in the text
- If no referrals are found, return an empty array
- Use null for any fields not mentioned in the text
- Be thorough — even partial information about a doctor referral should be included

Respond with ONLY a JSON array:
[
  {
    "doctor_name": "...",
    "specialty": "...",
    "hospital": "...",
    "phone": "...",
    "fax": "...",
    "email": "...",
    "date_referred": "YYYY-MM-DD or null",
    "date_faxed": "YYYY-MM-DD or null",
    "date_called": "YYYY-MM-DD or null",
    "response_status": "...",
    "appointment_date": "YYYY-MM-DD or null",
    "next_steps": "...",
    "notes": "..."
  }
]

TEXT:
${text}`,
      },
    ],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const arrayMatch = responseText.match(/\[[\s\S]*\]/)
  if (!arrayMatch) return []

  try {
    return JSON.parse(arrayMatch[0])
  } catch {
    console.error('Failed to parse referrals JSON:', responseText)
    return []
  }
}
