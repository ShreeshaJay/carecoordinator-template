'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { Plus, Trash2, X } from 'lucide-react'
import { CATEGORY_COLORS, ALL_CATEGORIES } from '@/lib/config'

interface TimelineEvent {
  id: string
  event_date: string
  category: string
  description: string
  created_at: string
}

export default function TimelinePage() {
  const supabase = createClient()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newEvent, setNewEvent] = useState({ event_date: '', category: 'General', description: '' })

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('timeline_events')
      .select('*')
      .order('event_date', { ascending: false })
    if (data) setEvents(data)
    setLoading(false)
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!newEvent.event_date || !newEvent.description) return
    const { data, error } = await supabase
      .from('timeline_events')
      .insert({
        event_date: newEvent.event_date,
        category: newEvent.category,
        description: newEvent.description,
      })
      .select()
      .single()
    if (data) {
      setEvents((prev) => [data, ...prev].sort((a, b) => b.event_date.localeCompare(a.event_date)))
      setNewEvent({ event_date: '', category: 'General', description: '' })
      setShowAdd(false)
    }
  }

  async function deleteEvent(id: string) {
    await supabase.from('timeline_events').delete().eq('id', id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  if (loading) {
    return <div className="text-gray-500">Loading timeline...</div>
  }

  // Group events by month
  const grouped = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const month = format(new Date(event.event_date + 'T00:00:00'), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(event)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          {showAdd ? 'Cancel' : 'Add Event'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addEvent} className="bg-white rounded-xl p-4 shadow-sm mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="date"
              value={newEvent.event_date}
              onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
            <select
              value={newEvent.category}
              onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {ALL_CATEGORIES.filter(c => c !== 'WhatsApp Chat' && c !== 'Referral').map(cat => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="What happened?"
            value={newEvent.description}
            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Add to Timeline
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <p className="text-gray-400">No timeline events yet.</p>
          <p className="text-sm text-gray-300 mt-1">Events are automatically created when you submit new information.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{month}</h3>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-4">
                  {monthEvents.map((event) => {
                    const eventDate = new Date(event.event_date + 'T00:00:00')
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const isFuture = eventDate >= today
                    const isToday = eventDate.toDateString() === today.toDateString()

                    return (
                    <div key={event.id} className="flex gap-4 group relative">
                      {/* Dot */}
                      <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm mt-1 shrink-0 z-10 ${
                        isToday ? 'bg-amber-500 ring-2 ring-amber-200' :
                        isFuture ? 'bg-emerald-500' : 'bg-blue-500'
                      }`} />

                      {/* Content */}
                      <div className={`rounded-xl p-4 shadow-sm flex-1 ${
                        isFuture ? 'bg-emerald-50 border border-emerald-200' :
                        isToday ? 'bg-amber-50 border border-amber-200' : 'bg-white'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-700">
                                {format(eventDate, 'MMM d, yyyy')}
                              </span>
                              {isFuture && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                  Upcoming
                                </span>
                              )}
                              {isToday && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                                  Today
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[event.category] || CATEGORY_COLORS.General}`}>
                                {event.category}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800">{event.description}</p>
                          </div>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
