'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import { RefreshCw, Loader2, Check, Square, Plus, Trash2, Eye, EyeOff, Stethoscope, ClipboardList, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { logClientActivity } from '@/lib/log-client'
import { config, getColorScheme } from '@/lib/config'

interface ActionItem {
  id: string
  assignee: string
  description: string
  due_date: string | null
  status: string
  created_at: string
}

export default function SummaryPage() {
  const supabase = createClient()
  const [summary, setSummary] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddAction, setShowAddAction] = useState(false)
  const [newAction, setNewAction] = useState({ assignee: '', description: '', due_date: '' })
  const [showHighlights, setShowHighlights] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [summaryRes, actionsRes] = await Promise.all([
      supabase.from('summary').select('content, updated_at').eq('id', 1).single(),
      supabase.from('action_items').select('*').order('created_at', { ascending: false }),
    ])
    if (summaryRes.data) {
      setSummary(summaryRes.data.content)
      setUpdatedAt(summaryRes.data.updated_at)
    }
    if (actionsRes.data) setActionItems(actionsRes.data)
    setLoading(false)
  }

  async function handleRefresh() {
    const confirmed = window.confirm(
      'This will rebuild the entire summary, patient info, and referrals from scratch using all entries. The current summary will be replaced.\n\nAre you sure you want to continue?'
    )
    if (!confirmed) return

    setRefreshing(true)
    try {
      const res = await fetch('/api/refresh-summary', { method: 'POST' })
      if (res.ok) {
        await loadData()
      }
    } catch (e) {
      console.error(e)
    }
    setRefreshing(false)
  }

  async function toggleAction(item: ActionItem) {
    const newStatus = item.status === 'open' ? 'done' : 'open'
    await supabase.from('action_items').update({ status: newStatus }).eq('id', item.id)
    setActionItems((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, status: newStatus } : a))
    )
    logClientActivity(`Marked action item as ${newStatus}: "${item.description}"`, 'Action Item')
  }

  async function addAction(e: React.FormEvent) {
    e.preventDefault()
    if (!newAction.assignee || !newAction.description) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('action_items')
      .insert({
        assignee: newAction.assignee,
        description: newAction.description,
        due_date: newAction.due_date || null,
        created_by: user?.id,
      })
      .select()
      .single()
    if (data) {
      setActionItems((prev) => [data, ...prev])
      setNewAction({ assignee: '', description: '', due_date: '' })
      setShowAddAction(false)
      logClientActivity(`Added action item: "${newAction.description}" assigned to ${newAction.assignee}`, 'Action Item')
    }
  }

  async function deleteAction(id: string) {
    await supabase.from('action_items').delete().eq('id', id)
    setActionItems((prev) => prev.filter((a) => a.id !== id))
  }

  if (loading) {
    return <div className="text-gray-500">Loading summary...</div>
  }

  const openItems = actionItems.filter((a) => a.status === 'open')
  const doneItems = actionItems.filter((a) => a.status === 'done')

  return (
    <div>
      {/* Summary Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Current Summary</h1>
          {updatedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {format(new Date(updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
          title="Rebuild summary from all entries"
        >
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {refreshing ? 'Rebuilding...' : 'Refresh'}
        </button>
      </div>

      {/* Highlight toggle */}
      {summary.includes('==NEW==') && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowHighlights(!showHighlights)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              showHighlights
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {showHighlights ? <Eye size={14} /> : <EyeOff size={14} />}
            {showHighlights ? 'New content highlighted' : 'Highlights hidden'}
          </button>
          <span className="text-xs text-gray-400">
            Green highlights show what changed in the latest update
          </span>
        </div>
      )}

      <StyledSummary markdown={summary} showHighlights={showHighlights} />

      {/* Action Items */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Action Items</h2>
        <button
          onClick={() => setShowAddAction(!showAddAction)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Add form */}
      {showAddAction && (
        <form onSubmit={addAction} className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-col md:flex-row gap-3">
          <input
            placeholder="Assignee (who)"
            value={newAction.assignee}
            onChange={(e) => setNewAction({ ...newAction, assignee: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1"
            required
          />
          <input
            placeholder="What needs to be done"
            value={newAction.description}
            onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-[2]"
            required
          />
          <input
            type="date"
            value={newAction.due_date}
            onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Add
          </button>
        </form>
      )}

      {/* Open items */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        {openItems.length === 0 ? (
          <p className="p-4 text-sm text-gray-400 italic">No open action items.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {openItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-4 group">
                <button onClick={() => toggleAction(item)} className="mt-0.5 text-gray-300 hover:text-blue-500">
                  <Square size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{item.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span className="font-medium text-gray-600">{item.assignee}</span>
                    {item.due_date && <span>Due: {format(new Date(item.due_date), 'MMM d')}</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteAction(item.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Done items */}
      {doneItems.length > 0 && (
        <details className="mb-8">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 mb-2">
            {doneItems.length} completed item{doneItems.length !== 1 ? 's' : ''}
          </summary>
          <div className="bg-white rounded-xl shadow-sm">
            <div className="divide-y divide-gray-100">
              {doneItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-4 opacity-60 group">
                  <button onClick={() => toggleAction(item)} className="mt-0.5 text-green-500">
                    <Check size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 line-through">{item.description}</p>
                    <span className="text-xs text-gray-400">{item.assignee}</span>
                  </div>
                  <button
                    onClick={() => deleteAction(item.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

const SECTION_CONFIG: Record<string, { icon: typeof Stethoscope; color: string; bg: string; border: string }> = {
  'Latest Medical Status': { icon: Stethoscope, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'Latest Administrative Status': { icon: ClipboardList, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Potential Concerns': { icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
}

function StyledSummary({ markdown, showHighlights }: { markdown: string; showHighlights: boolean }) {
  // Parse the markdown into organ sections
  const processed = showHighlights
    ? markdown
    : markdown.replace(/==NEW==/g, '').replace(/==\/NEW==/g, '')

  // Split by ## headers (organ sections)
  const organSections = processed.split(/^## /m).filter(Boolean)

  // If the structure doesn't match our expected format, fall back to plain rendering
  if (organSections.length < 2 || !processed.includes('### ')) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8 prose prose-sm max-w-none">
        <HighlightedMarkdown text={processed} showHighlights={showHighlights} />
      </div>
    )
  }

  return (
    <div className="space-y-6 mb-8">
      {organSections.map((section, idx) => {
        const lines = section.split('\n')
        const title = lines[0].trim()
        const rest = lines.slice(1).join('\n')

        // Match to config conditions by checking if title contains the condition name or category
        const matchedCondition = config.conditions.find(c =>
          title.toLowerCase().includes(c.name.toLowerCase()) ||
          title.toLowerCase().includes(c.category.toLowerCase())
        )
        const colorScheme = matchedCondition ? getColorScheme(matchedCondition.color) : getColorScheme('gray')
        const headerColor = colorScheme.header
        const headerIcon = matchedCondition?.emoji || '📋'

        // Split into sub-sections by ### headers
        const subSections = rest.split(/^### /m).filter(Boolean)

        return (
          <div key={idx} className="rounded-2xl overflow-hidden shadow-sm border border-gray-200">
            {/* Organ header */}
            <div className={`bg-gradient-to-r ${headerColor} px-6 py-4`}>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{headerIcon}</span> {title}
              </h2>
            </div>

            {/* Sub-sections */}
            <div className="bg-white divide-y divide-gray-100">
              {subSections.map((sub, subIdx) => {
                const subLines = sub.split('\n')
                const subTitle = subLines[0].trim()
                const subContent = subLines.slice(1).join('\n').trim()

                const config = SECTION_CONFIG[subTitle] || { icon: ClipboardList, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' }
                const Icon = config.icon

                return (
                  <div key={subIdx} className="p-5">
                    <div className={`flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg ${config.bg} w-fit`}>
                      <Icon size={16} className={config.color} />
                      <h3 className={`text-sm font-semibold ${config.color}`}>{subTitle}</h3>
                    </div>
                    <div className="prose prose-sm max-w-none pl-1">
                      <HighlightedMarkdown text={subContent} showHighlights={showHighlights} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HighlightedMarkdown({ text, showHighlights }: { text: string; showHighlights: boolean }) {
  if (!showHighlights || !text.includes('==NEW==')) {
    const clean = text.replace(/==NEW==/g, '').replace(/==\/NEW==/g, '')
    return <ReactMarkdown>{clean}</ReactMarkdown>
  }

  const withMarkers = text
    .replace(/==NEW==/g, '‹‹HIGHLIGHT_START››')
    .replace(/==\/NEW==/g, '‹‹HIGHLIGHT_END››')

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p>{highlightChildren(children)}</p>,
        li: ({ children }) => <li>{highlightChildren(children)}</li>,
        strong: ({ children }) => <strong>{highlightChildren(children)}</strong>,
        em: ({ children }) => <em>{highlightChildren(children)}</em>,
      }}
    >
      {withMarkers}
    </ReactMarkdown>
  )
}

function highlightChildren(children: React.ReactNode): React.ReactNode {
  if (!children) return children

  const childArray = Array.isArray(children) ? children : [children]

  return childArray.map((child, i) => {
    if (typeof child !== 'string') return <span key={i}>{child}</span>

    if (!child.includes('‹‹HIGHLIGHT_START››')) return <span key={i}>{child}</span>

    const parts = child.split(/(‹‹HIGHLIGHT_START››|‹‹HIGHLIGHT_END››)/)
    let inHighlight = false
    const result: React.ReactNode[] = []

    for (let j = 0; j < parts.length; j++) {
      const part = parts[j]
      if (part === '‹‹HIGHLIGHT_START››') {
        inHighlight = true
        continue
      }
      if (part === '‹‹HIGHLIGHT_END››') {
        inHighlight = false
        continue
      }
      if (part) {
        result.push(
          inHighlight ? (
            <span key={`${i}-${j}`} className="bg-emerald-100 text-emerald-900 px-0.5 rounded border-b-2 border-emerald-300">
              {part}
            </span>
          ) : (
            <span key={`${i}-${j}`}>{part}</span>
          )
        )
      }
    }

    return <span key={i}>{result}</span>
  })
}
