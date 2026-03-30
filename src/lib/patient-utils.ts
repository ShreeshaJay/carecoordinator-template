import type { PatientInfoUpdates } from './claude'
import type { SupabaseClient } from '@supabase/supabase-js'

interface PatientData {
  name: string
  dob: string
  health_card: string
  diagnoses: Array<{ organ: string; details: string }>
  medications: string
  allergies: string
  doctors: Array<{ name: string; specialty: string; hospital: string; contact: string }>
  insurance_notes: string
}

export async function applyPatientInfoUpdates(
  admin: SupabaseClient,
  updates: PatientInfoUpdates,
  userId: string
) {
  if (!updates) return

  // Get current patient data
  const { data: row } = await admin
    .from('patient_info')
    .select('data')
    .eq('id', 1)
    .single()

  if (!row) return

  const data = row.data as PatientData

  // Update simple fields (only if the update has a non-null value)
  if (updates.name) data.name = updates.name
  if (updates.dob) data.dob = updates.dob
  if (updates.health_card) data.health_card = updates.health_card
  if (updates.insurance_notes) {
    data.insurance_notes = data.insurance_notes
      ? data.insurance_notes + '\n' + updates.insurance_notes
      : updates.insurance_notes
  }

  // Append medications (don't overwrite)
  if (updates.medications) {
    data.medications = data.medications
      ? data.medications + '\n' + updates.medications
      : updates.medications
  }

  // Append allergies (don't overwrite)
  if (updates.allergies) {
    data.allergies = data.allergies
      ? data.allergies + '\n' + updates.allergies
      : updates.allergies
  }

  // Add new doctors (avoid duplicates by name)
  if (updates.new_doctors && updates.new_doctors.length > 0) {
    const existingNames = new Set(data.doctors.map(d => d.name.toLowerCase()))
    for (const doc of updates.new_doctors) {
      if (doc.name && !existingNames.has(doc.name.toLowerCase())) {
        data.doctors.push(doc)
        existingNames.add(doc.name.toLowerCase())
      }
    }
  }

  // Update diagnoses (append new details to existing organ entries)
  if (updates.diagnosis_updates && updates.diagnosis_updates.length > 0) {
    for (const update of updates.diagnosis_updates) {
      const existing = data.diagnoses.find(
        d => d.organ.toLowerCase() === update.organ.toLowerCase()
      )
      if (existing) {
        if (existing.details) {
          existing.details = existing.details + '\n' + update.details
        } else {
          existing.details = update.details
        }
      } else {
        data.diagnoses.push({ organ: update.organ, details: update.details })
      }
    }
  }

  await admin
    .from('patient_info')
    .update({ data, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', 1)
}

// For full refresh — replaces patient info entirely from extracted data
export async function replacePatientInfo(
  admin: SupabaseClient,
  info: {
    name?: string | null
    dob?: string | null
    health_card?: string | null
    medications?: string | null
    allergies?: string | null
    insurance_notes?: string | null
    doctors?: Array<{ name: string; specialty: string; hospital: string; contact: string }>
    diagnoses?: Array<{ organ: string; details: string }>
  },
  userId: string
) {
  // Get current to preserve any manually-entered data
  const { data: row } = await admin
    .from('patient_info')
    .select('data')
    .eq('id', 1)
    .single()

  const current = (row?.data || {}) as PatientData

  const merged: PatientData = {
    name: info.name || current.name || '',
    dob: info.dob || current.dob || '',
    health_card: info.health_card || current.health_card || '',
    medications: info.medications || current.medications || '',
    allergies: info.allergies || current.allergies || '',
    insurance_notes: info.insurance_notes || current.insurance_notes || '',
    doctors: info.doctors && info.doctors.length > 0 ? info.doctors : current.doctors || [],
    diagnoses: info.diagnoses && info.diagnoses.length > 0 ? info.diagnoses : current.diagnoses || [],
  }

  await admin
    .from('patient_info')
    .update({ data: merged, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', 1)
}
