'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Save, Plus, Trash2, Edit3, X } from 'lucide-react'
import { logClientActivity } from '@/lib/log-client'

interface Doctor {
  name: string
  specialty: string
  hospital: string
  contact: string
}

interface PatientData {
  name: string
  dob: string
  health_card: string
  diagnoses: Array<{ organ: string; details: string }>
  medications: string
  allergies: string
  doctors: Doctor[]
  insurance_notes: string
}

export default function PatientPage() {
  const supabase = createClient()
  const [data, setData] = useState<PatientData | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: row } = await supabase
      .from('patient_info')
      .select('data')
      .eq('id', 1)
      .single()
    if (row) setData(row.data as PatientData)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('patient_info')
      .update({ data, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', 1)
    setSaving(false)
    if (error) {
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Saved successfully')
      setEditing(false)
      logClientActivity('Updated patient info', 'Patient')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  function updateField(field: keyof PatientData, value: string) {
    if (!data) return
    setData({ ...data, [field]: value })
  }

  function updateDiagnosis(index: number, details: string) {
    if (!data) return
    const newDiagnoses = [...data.diagnoses]
    newDiagnoses[index] = { ...newDiagnoses[index], details }
    setData({ ...data, diagnoses: newDiagnoses })
  }

  function updateDoctor(index: number, field: keyof Doctor, value: string) {
    if (!data) return
    const newDoctors = [...data.doctors]
    newDoctors[index] = { ...newDoctors[index], [field]: value }
    setData({ ...data, doctors: newDoctors })
  }

  function addDoctor() {
    if (!data) return
    setData({ ...data, doctors: [...data.doctors, { name: '', specialty: '', hospital: '', contact: '' }] })
  }

  function removeDoctor(index: number) {
    if (!data) return
    setData({ ...data, doctors: data.doctors.filter((_, i) => i !== index) })
  }

  if (!data) {
    return <div className="text-gray-500">Loading patient information...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Patient Summary</h1>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); loadData() }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Edit3 size={16} /> Edit
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" value={data.name} editing={editing} onChange={(v) => updateField('name', v)} />
            <Field label="Date of Birth" value={data.dob} editing={editing} onChange={(v) => updateField('dob', v)} />
            <Field label="Health Card #" value={data.health_card} editing={editing} onChange={(v) => updateField('health_card', v)} />
          </div>
        </section>

        {/* Diagnoses */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Diagnoses</h2>
          <div className="space-y-4">
            {data.diagnoses.map((d, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-600 mb-1">{d.organ}</label>
                {editing ? (
                  <textarea
                    value={d.details}
                    onChange={(e) => updateDiagnosis(i, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{d.details || <span className="text-gray-400 italic">Not yet entered</span>}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Medications & Allergies */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Medications & Allergies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextareaField label="Current Medications" value={data.medications} editing={editing} onChange={(v) => updateField('medications', v)} />
            <TextareaField label="Known Allergies" value={data.allergies} editing={editing} onChange={(v) => updateField('allergies', v)} />
          </div>
        </section>

        {/* Doctors */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Doctors & Specialists</h2>
            {editing && (
              <button onClick={addDoctor} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                <Plus size={16} /> Add Doctor
              </button>
            )}
          </div>
          {data.doctors.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No doctors added yet.</p>
          ) : (
            <div className="space-y-4">
              {data.doctors.map((doc, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-4 relative">
                  {editing && (
                    <button
                      onClick={() => removeDoctor(i)}
                      className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Name" value={doc.name} editing={editing} onChange={(v) => updateDoctor(i, 'name', v)} />
                    <Field label="Specialty" value={doc.specialty} editing={editing} onChange={(v) => updateDoctor(i, 'specialty', v)} />
                    <Field label="Hospital" value={doc.hospital} editing={editing} onChange={(v) => updateDoctor(i, 'hospital', v)} />
                    <Field label="Contact" value={doc.contact} editing={editing} onChange={(v) => updateDoctor(i, 'contact', v)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Insurance */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Insurance & Coverage Notes</h2>
          <TextareaField label="" value={data.insurance_notes} editing={editing} onChange={(v) => updateField('insurance_notes', v)} />
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, editing, onChange }: { label: string; value: string; editing: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>}
      {editing ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      ) : (
        <p className="text-sm text-gray-800">{value || <span className="text-gray-400 italic">—</span>}</p>
      )}
    </div>
  )
}

function TextareaField({ label, value, editing, onChange }: { label: string; value: string; editing: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>}
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      ) : (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || <span className="text-gray-400 italic">—</span>}</p>
      )}
    </div>
  )
}
