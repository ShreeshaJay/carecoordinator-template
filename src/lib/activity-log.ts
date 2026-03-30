import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityCategory =
  | 'Entry'
  | 'Report'
  | 'Patient'
  | 'Referral'
  | 'Summary'
  | 'Timeline'
  | 'Action Item'
  | 'Auth'

export async function logActivity(
  client: SupabaseClient,
  userId: string,
  action: string,
  category: ActivityCategory,
  details?: string
) {
  try {
    await client.from('activity_log').insert({
      user_id: userId,
      action,
      category,
      details: details || '',
    })
  } catch (e) {
    // Don't let logging failures break the main flow
    console.error('Activity log error:', e)
  }
}
