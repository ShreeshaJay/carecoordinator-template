'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, FileText, Upload, RefreshCw, Edit3, CheckSquare, GitPullRequestArrow, User, Clock } from 'lucide-react'

interface Entry {
  id: string
  content: string
  category: string
  entry_type: string
  image_urls: string[]
  created_at: string
  profiles: { display_name: string } | null
}

interface ActivityItem {
  id: string
  action: string
  category: string
  details: string
  created_at: string
  profiles: { display_name: string } | null
}

import { CATEGORY_COLORS } from '@/lib/config'

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  Entry: FileText,
  Report: Upload,
  Summary: RefreshCw,
  Patient: User,
  Referral: GitPullRequestArrow,
  'Action Item': CheckSquare,
  Timeline: Clock,
  Auth: User,
}

type TabType = 'activity' | 'entries'

export default function LogPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<TabType>('activity')
  const [entries, setEntries] = useState<Entry[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [entriesRes, activitiesRes] = await Promise.all([
      supabase
        .from('entries')
        .select('*, profiles:user_id(display_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('activity_log')
        .select('*, profiles:user_id(display_name)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (entriesRes.data) setEntries(entriesRes.data as Entry[])
    if (activitiesRes.data) setActivities(activitiesRes.data as ActivityItem[])
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <div className="text-gray-500">Loading log...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Activity Log</h1>
      <p className="text-sm text-gray-500 mb-4">
        Track all changes and submissions across the app.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('activity')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'activity' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Activity ({activities.length})
        </button>
        <button
          onClick={() => setTab('entries')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'entries' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Raw Entries ({entries.length})
        </button>
      </div>

      {/* Activity Log Tab */}
      {tab === 'activity' && (
        activities.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <p className="text-gray-400">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.category] || FileText
              return (
                <div key={activity.id} className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{activity.action}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                      <span>{format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}</span>
                      <span>by {activity.profiles?.display_name || 'Unknown'}</span>
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{activity.category}</span>
                    </div>
                    {activity.details && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{activity.details}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Raw Entries Tab */}
      {tab === 'entries' && (
        entries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <p className="text-gray-400">No entries yet. Go to Add Info to submit your first entry.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isExpanded = expanded.has(entry.id)
              const preview = entry.content.slice(0, 200)
              const isLong = entry.content.length > 200

              return (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => isLong && toggleExpand(entry.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">
                        {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.General}`}>
                        {entry.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        by {entry.profiles?.display_name || 'Unknown'}
                      </span>
                      {entry.entry_type === 'image' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          has images
                        </span>
                      )}
                      {entry.entry_type === 'report' && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          report
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {isExpanded ? entry.content : preview}
                      {isLong && !isExpanded && '...'}
                    </p>

                    {isLong && (
                      <button className="flex items-center gap-1 text-xs text-blue-500 mt-2 hover:text-blue-700">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}

                    {entry.image_urls && entry.image_urls.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {entry.image_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt=""
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:ring-2 hover:ring-blue-300"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
