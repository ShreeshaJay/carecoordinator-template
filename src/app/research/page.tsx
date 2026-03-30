'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import { Plus, Trash2, Loader2, BookOpen, ChevronDown, ChevronUp, X, Search } from 'lucide-react'

interface ResearchTopic {
  id: string
  title: string
  query: string
  content: string
  status: string
  sources: string
  created_at: string
  updated_at: string
}

const SUGGESTED_TOPICS = [
  { title: 'Understanding Your Diagnosis', query: 'Provide a comprehensive overview of the diagnosis, including staging, prognosis factors, and what the medical terminology means in plain language.' },
  { title: 'Treatment Options Comparison', query: 'Compare the main treatment options available for this condition. Include success rates, recovery times, side effects, and when each approach is typically recommended.' },
  { title: 'Questions to Ask Your Surgeon', query: 'What are the most important questions a patient and family should ask the surgeon before proceeding with surgery? Include questions about experience, outcomes, risks, and recovery.' },
  { title: 'Post-Surgery Recovery & Follow-Up', query: 'What does the typical recovery timeline look like after surgery? Include follow-up appointments, warning signs, lifestyle adjustments, and long-term monitoring.' },
]

export default function ResearchPage() {
  const supabase = createClient()
  const [topics, setTopics] = useState<ResearchTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newQuery, setNewQuery] = useState('')
  const [researching, setResearching] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadTopics()
  }, [])

  async function loadTopics() {
    const { data } = await supabase
      .from('research_topics')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTopics(data)
    setLoading(false)
  }

  async function startResearch(title: string, query: string) {
    if (!title.trim() || !query.trim()) return
    setResearching(true)

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, query }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error)
      }

      setNewTitle('')
      setNewQuery('')
      setShowAdd(false)
      await loadTopics()
      // Expand the newest topic
      const { data: latest } = await supabase
        .from('research_topics')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (latest) setExpandedId(latest.id)
    } catch (err) {
      alert('Research failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setResearching(false)
    }
  }

  async function deleteTopic(id: string) {
    if (!window.confirm('Delete this research topic? This cannot be undone.')) return
    await supabase.from('research_topics').delete().eq('id', id)
    setTopics((prev) => prev.filter((t) => t.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function useSuggestion(suggestion: typeof SUGGESTED_TOPICS[0]) {
    setNewTitle(suggestion.title)
    setNewQuery(suggestion.query)
    setShowAdd(true)
  }

  if (loading) return <div className="text-gray-500">Loading research...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered literature reviews on medical topics relevant to your situation
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          disabled={researching}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          {showAdd ? 'Cancel' : 'New Research'}
        </button>
      </div>

      {/* New research form */}
      {showAdd && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 space-y-4">
          <h3 className="font-semibold text-gray-800">New Research Topic</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Kidney Tumor Treatment Options"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Research Question</label>
            <textarea
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="Describe what you want to research in detail..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
            />
          </div>

          <button
            onClick={() => startResearch(newTitle, newQuery)}
            disabled={researching || !newTitle.trim() || !newQuery.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {researching ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Researching (this may take a minute)...
              </>
            ) : (
              <>
                <Search size={16} /> Start Research
              </>
            )}
          </button>

          {/* Suggested topics */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Suggested topics:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TOPICS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => useSuggestion(s)}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>Disclaimer:</strong> These research summaries are for informational purposes only and should not replace professional medical advice. Always discuss treatment options with your healthcare team.
      </div>

      {/* Topics list */}
      {topics.length === 0 && !showAdd ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 text-lg">No research topics yet</p>
          <p className="text-gray-300 text-sm mt-2">
            Create a research topic to get an AI-powered literature review
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Start Your First Research
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => {
            const isExpanded = expandedId === topic.id
            return (
              <div key={topic.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={20} className={topic.status === 'completed' ? 'text-green-500' : 'text-gray-400'} />
                    <div>
                      <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                      <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                        <span>{format(new Date(topic.created_at), 'MMM d, yyyy')}</span>
                        {topic.status === 'researching' && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Loader2 size={12} className="animate-spin" /> Researching...
                          </span>
                        )}
                        {topic.status === 'completed' && (
                          <span className="text-green-600">Completed</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTopic(topic.id) }}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </div>

                {/* Content */}
                {isExpanded && topic.content && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="prose prose-sm max-w-none mt-4">
                      <ReactMarkdown>{topic.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
