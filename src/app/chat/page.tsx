'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { Send, Loader2, Bot, User, Trash2, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  user_display_name: string
  created_at: string
}

export default function ChatPage() {
  const supabase = createClient()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [researchingMsgId, setResearchingMsgId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setMessages(data as ChatMessage[])
    setLoading(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return

    const userMessage = input.trim()
    setInput('')
    setSending(true)

    // Optimistically add user message
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user?.id).single()
    const displayName = profile?.display_name || 'You'

    const tempUserMsg: ChatMessage = {
      id: 'temp-user-' + Date.now(),
      role: 'user',
      content: userMessage,
      user_display_name: displayName,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: 'temp-assistant-' + Date.now(),
        role: 'assistant',
        content: result.response,
        user_display_name: 'Claude',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      // Add error message
      const errorMsg: ChatMessage = {
        id: 'temp-error-' + Date.now(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        user_display_name: 'Claude',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function researchFurther(msg: ChatMessage) {
    // Find the user question that preceded this assistant response
    const msgIndex = messages.findIndex(m => m.id === msg.id)
    let userQuestion = ''
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuestion = messages[i].content
        break
      }
    }

    const title = userQuestion.length > 60 ? userQuestion.slice(0, 60) + '...' : userQuestion || 'Research topic'
    const query = `Based on this chat conversation, do a deep-dive research:\n\nUser question: ${userQuestion}\n\nClaude's initial answer (expand on this with more detail and sources):\n${msg.content.slice(0, 500)}`

    setResearchingMsgId(msg.id)
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, query }),
      })
      if (!response.ok) throw new Error('Research request failed')
      router.push('/research')
    } catch {
      alert('Failed to create research topic. Please try from the Research tab.')
    } finally {
      setResearchingMsgId(null)
    }
  }

  async function deleteMessage(id: string) {
    if (!id.startsWith('temp-')) {
      await supabase.from('chat_messages').delete().eq('id', id)
    }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  if (loading) return <div className="text-gray-500">Loading chat...</div>

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat with Claude</h1>
        <p className="text-sm text-gray-500">
          Ask questions about the diagnosis, treatment options, or logistics. Claude has access to all your uploaded information. This is a shared chat visible to all family members.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-400 text-lg">Start a conversation</p>
            <p className="text-gray-300 text-sm mt-2">
              Ask about the diagnosis, what questions to ask the doctors,<br />
              or help understanding medical terms.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-blue-600" />
              </div>
            )}

            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white shadow-sm border border-gray-100'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              <div className={`flex gap-2 mt-1 text-xs text-gray-400 items-center ${msg.role === 'user' ? 'justify-end' : ''}`}>
                <span>{msg.user_display_name}</span>
                <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                {msg.role === 'assistant' && !msg.id.startsWith('temp-') && (
                  <button
                    onClick={() => researchFurther(msg)}
                    disabled={researchingMsgId === msg.id}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50 font-medium"
                    title="Create a deep-dive research report on this topic"
                  >
                    {researchingMsgId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                    Research further
                  </button>
                )}
                <button
                  onClick={() => deleteMessage(msg.id)}
                  className="text-gray-500 hover:text-red-600 transition-colors"
                  title="Delete message"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 mt-1">
                <User size={16} className="text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-4 py-3">
              <Loader2 size={16} className="animate-spin text-blue-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about the diagnosis, treatment, or next steps..."
          rows={1}
          disabled={sending}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none disabled:opacity-50"
          style={{ minHeight: '48px', maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = '48px'
            target.style.height = Math.min(target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
