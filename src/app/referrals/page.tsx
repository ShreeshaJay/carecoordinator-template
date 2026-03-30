'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { Plus, Trash2, Edit3, Save, X, Phone, Mail, Star } from 'lucide-react'
import { logClientActivity } from '@/lib/log-client'

interface Referral {
  id: string
  doctor_name: string
  specialty: string
  hospital: string
  phone: string
  fax: string
  email: string
  date_referred: string | null
  date_faxed: string | null
  date_called: string | null
  response_status: string
  appointment_date: string | null
  next_steps: string
  notes: string
  starred: boolean
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS = [
  'Pending',
  'Fax Sent',
  'Called',
  'Waiting for Response',
  'Appointment Booked',
  'Declined',
  'Completed',
]

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-700',
  'Fax Sent': 'bg-yellow-100 text-yellow-700',
  Called: 'bg-blue-100 text-blue-700',
  'Waiting for Response': 'bg-orange-100 text-orange-700',
  'Appointment Booked': 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-700',
  Completed: 'bg-emerald-100 text-emerald-700',
}

const EMPTY_REFERRAL = {
  doctor_name: '',
  specialty: '',
  hospital: '',
  phone: '',
  fax: '',
  email: '',
  date_referred: '',
  date_faxed: '',
  date_called: '',
  response_status: 'Pending',
  appointment_date: '',
  next_steps: '',
  notes: '',
}

export default function ReferralsPage() {
  const supabase = createClient()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<typeof EMPTY_REFERRAL>(EMPTY_REFERRAL)
  const [showAdd, setShowAdd] = useState(false)
  const [newReferral, setNewReferral] = useState<typeof EMPTY_REFERRAL>(EMPTY_REFERRAL)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadReferrals()
  }, [])

  async function loadReferrals() {
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setReferrals(data)
    setLoading(false)
  }

  async function addReferral(e: React.FormEvent) {
    e.preventDefault()
    if (!newReferral.doctor_name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('referrals')
      .insert({
        ...newReferral,
        date_referred: newReferral.date_referred || null,
        date_faxed: newReferral.date_faxed || null,
        date_called: newReferral.date_called || null,
        appointment_date: newReferral.appointment_date || null,
        created_by: user?.id,
      })
      .select()
      .single()
    if (data) {
      setReferrals((prev) => [data, ...prev])
      setNewReferral(EMPTY_REFERRAL)
      setShowAdd(false)
      logClientActivity(`Added referral: Dr. ${newReferral.doctor_name} (${newReferral.specialty})`, 'Referral')
    }
    setSaving(false)
  }

  function startEdit(referral: Referral) {
    setEditingId(referral.id)
    setEditData({
      doctor_name: referral.doctor_name,
      specialty: referral.specialty,
      hospital: referral.hospital,
      phone: referral.phone || '',
      fax: referral.fax || '',
      email: referral.email || '',
      date_referred: referral.date_referred || '',
      date_faxed: referral.date_faxed || '',
      date_called: referral.date_called || '',
      response_status: referral.response_status,
      appointment_date: referral.appointment_date || '',
      next_steps: referral.next_steps || '',
      notes: referral.notes || '',
    })
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    await supabase
      .from('referrals')
      .update({
        ...editData,
        date_referred: editData.date_referred || null,
        date_faxed: editData.date_faxed || null,
        date_called: editData.date_called || null,
        appointment_date: editData.appointment_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId)
    setReferrals((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, ...editData, updated_at: new Date().toISOString() } : r))
    )
    setEditingId(null)
    setSaving(false)
    logClientActivity(`Updated referral: Dr. ${editData.doctor_name}`, 'Referral')
  }

  async function deleteReferral(id: string) {
    if (!window.confirm('Delete this referral? This cannot be undone.')) return
    const ref = referrals.find(r => r.id === id)
    await supabase.from('referrals').delete().eq('id', id)
    setReferrals((prev) => prev.filter((r) => r.id !== id))
    logClientActivity(`Deleted referral: Dr. ${ref?.doctor_name}`, 'Referral')
  }

  async function updateStatus(id: string, status: string) {
    const ref = referrals.find(r => r.id === id)
    await supabase.from('referrals').update({ response_status: status, updated_at: new Date().toISOString() }).eq('id', id)
    setReferrals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, response_status: status } : r))
    )
    logClientActivity(`Changed referral status for Dr. ${ref?.doctor_name} to "${status}"`, 'Referral')
  }

  async function toggleStar(id: string) {
    const ref = referrals.find(r => r.id === id)
    if (!ref) return
    const newStarred = !ref.starred
    await supabase.from('referrals').update({ starred: newStarred, updated_at: new Date().toISOString() }).eq('id', id)
    setReferrals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, starred: newStarred } : r))
    )
  }

  async function updateNotes(id: string, notes: string) {
    await supabase.from('referrals').update({ notes, updated_at: new Date().toISOString() }).eq('id', id)
    setReferrals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, notes } : r))
    )
  }

  if (loading) return <div className="text-gray-500">Loading referrals...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referrals Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track specialist referrals, follow-ups, and appointment status</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          {showAdd ? 'Cancel' : 'Add Referral'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addReferral} className="bg-white rounded-xl p-6 shadow-sm mb-6 space-y-4">
          <h3 className="font-semibold text-gray-800">New Referral</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Doctor name *" value={newReferral.doctor_name} onChange={(e) => setNewReferral({ ...newReferral, doctor_name: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            <input placeholder="Specialty" value={newReferral.specialty} onChange={(e) => setNewReferral({ ...newReferral, specialty: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Hospital / Clinic" value={newReferral.hospital} onChange={(e) => setNewReferral({ ...newReferral, hospital: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Phone" value={newReferral.phone} onChange={(e) => setNewReferral({ ...newReferral, phone: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Fax" value={newReferral.fax} onChange={(e) => setNewReferral({ ...newReferral, fax: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Email" value={newReferral.email} onChange={(e) => setNewReferral({ ...newReferral, email: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date Referred</label>
              <input type="date" value={newReferral.date_referred} onChange={(e) => setNewReferral({ ...newReferral, date_referred: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date Faxed</label>
              <input type="date" value={newReferral.date_faxed} onChange={(e) => setNewReferral({ ...newReferral, date_faxed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date Called</label>
              <input type="date" value={newReferral.date_called} onChange={(e) => setNewReferral({ ...newReferral, date_called: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={newReferral.response_status} onChange={(e) => setNewReferral({ ...newReferral, response_status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <input placeholder="Next steps" value={newReferral.next_steps} onChange={(e) => setNewReferral({ ...newReferral, next_steps: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <textarea placeholder="Additional notes" value={newReferral.notes} onChange={(e) => setNewReferral({ ...newReferral, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add Referral'}
          </button>
        </form>
      )}

      {/* Referrals list */}
      {referrals.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <p className="text-gray-400">No referrals tracked yet.</p>
          <p className="text-sm text-gray-300 mt-1">Add one manually or upload a referral document in the Reports page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...referrals].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)).map((ref) => {
            const isEditing = editingId === ref.id
            const data = isEditing ? editData : ref

            return (
              <div key={ref.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${ref.starred ? 'ring-2 ring-yellow-300' : ''}`}>
                {/* Header row */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!isEditing && (
                      <button onClick={() => toggleStar(ref.id)} className="shrink-0" title={ref.starred ? 'Unstar' : 'Star this referral'}>
                        <Star size={20} className={ref.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400'} />
                      </button>
                    )}
                    {isEditing ? (
                      <input value={editData.doctor_name} onChange={(e) => setEditData({ ...editData, doctor_name: e.target.value })} className="text-lg font-semibold text-gray-900 border-b border-blue-300 focus:outline-none" />
                    ) : (
                      <h3 className="text-lg font-semibold text-gray-900">{ref.doctor_name}</h3>
                    )}
                    {!isEditing && (
                      <select
                        value={ref.response_status}
                        onChange={(e) => updateStatus(ref.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[ref.response_status] || STATUS_COLORS.Pending}`}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"><X size={16} /></button>
                        <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"><Save size={14} /> Save</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(ref)} className="text-gray-400 hover:text-blue-500"><Edit3 size={16} /></button>
                        <button onClick={() => deleteReferral(ref.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className="block text-xs text-gray-500 mb-1">Specialty</label><input value={editData.specialty} onChange={(e) => setEditData({ ...editData, specialty: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Hospital</label><input value={editData.hospital} onChange={(e) => setEditData({ ...editData, hospital: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Status</label><select value={editData.response_status} onChange={(e) => setEditData({ ...editData, response_status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Fax</label><input value={editData.fax} onChange={(e) => setEditData({ ...editData, fax: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Email</label><input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div><label className="block text-xs text-gray-500 mb-1">Date Referred</label><input type="date" value={editData.date_referred} onChange={(e) => setEditData({ ...editData, date_referred: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Date Faxed</label><input type="date" value={editData.date_faxed} onChange={(e) => setEditData({ ...editData, date_faxed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Date Called</label><input type="date" value={editData.date_called} onChange={(e) => setEditData({ ...editData, date_called: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Appointment Date</label><input type="date" value={editData.appointment_date} onChange={(e) => setEditData({ ...editData, appointment_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                      </div>
                      <div><label className="block text-xs text-gray-500 mb-1">Next Steps</label><input value={editData.next_steps} onChange={(e) => setEditData({ ...editData, next_steps: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Info grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        {ref.specialty && <div><span className="text-gray-400">Specialty:</span> <span className="text-gray-800">{ref.specialty}</span></div>}
                        {ref.hospital && <div><span className="text-gray-400">Hospital:</span> <span className="text-gray-800">{ref.hospital}</span></div>}
                        {ref.phone && <div className="flex items-center gap-1"><Phone size={12} className="text-gray-400" /> <span className="text-gray-800">{ref.phone}</span></div>}
                        {ref.fax && <div><span className="text-gray-400">Fax:</span> <span className="text-gray-800">{ref.fax}</span></div>}
                        {ref.email && <div className="flex items-center gap-1"><Mail size={12} className="text-gray-400" /> <span className="text-gray-800">{ref.email}</span></div>}
                      </div>

                      {/* Dates */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        {ref.date_referred && <span>Referred: <strong className="text-gray-700">{format(new Date(ref.date_referred + 'T00:00:00'), 'MMM d, yyyy')}</strong></span>}
                        {ref.date_faxed && <span>Faxed: <strong className="text-gray-700">{format(new Date(ref.date_faxed + 'T00:00:00'), 'MMM d, yyyy')}</strong></span>}
                        {ref.date_called && <span>Called: <strong className="text-gray-700">{format(new Date(ref.date_called + 'T00:00:00'), 'MMM d, yyyy')}</strong></span>}
                        {ref.appointment_date && <span>Appointment: <strong className="text-green-700">{format(new Date(ref.appointment_date + 'T00:00:00'), 'MMM d, yyyy')}</strong></span>}
                      </div>

                      {/* Next steps */}
                      {ref.next_steps && (
                        <div className="text-sm"><span className="text-gray-400">Next steps:</span> <span className="text-gray-800">{ref.next_steps}</span></div>
                      )}

                      {/* Inline notes */}
                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <label className="block text-xs text-gray-400 mb-1">Notes / Conversation log</label>
                        <textarea
                          value={ref.notes || ''}
                          onChange={(e) => setReferrals(prev => prev.map(r => r.id === ref.id ? { ...r, notes: e.target.value } : r))}
                          onBlur={(e) => updateNotes(ref.id, e.target.value)}
                          placeholder="Add notes from phone calls, conversations, etc."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
