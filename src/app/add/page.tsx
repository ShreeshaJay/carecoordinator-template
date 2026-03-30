'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import VoiceInput from '@/components/VoiceInput'
import { Send, ImagePlus, Loader2, X, Eye, Edit3, CheckCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { ALL_CATEGORIES } from '@/lib/config'

const CATEGORIES = ALL_CATEGORIES

export default function AddPage() {
  const supabase = createClient()
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('General')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // WhatsApp confirmation flow
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [whatsappSummary, setWhatsappSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setImages((prev) => [...prev, ...files])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && images.length === 0) return

    // If WhatsApp Chat category and no confirmation yet, show confirmation modal
    if (category === 'WhatsApp Chat' && !showConfirmModal && content.trim()) {
      setSummarizing(true)
      setMessage(null)
      try {
        const res = await fetch('/api/summarize-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content.trim() }),
        })
        if (!res.ok) throw new Error('Failed to summarize')
        const data = await res.json()
        setWhatsappSummary(data.summary)
        setShowConfirmModal(true)
        setEditingSummary(false)
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to generate summary. Please try again.' })
      } finally {
        setSummarizing(false)
      }
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload images to Supabase Storage
      const imageUrls: string[] = []
      for (const file of images) {
        const ext = file.name.split('.').pop()
        const path = `entries/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(path, file)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
        imageUrls.push(publicUrl)
      }

      // Prepare image data for OCR
      const imageBase64List: Array<{ base64: string; mimeType: string }> = []
      for (const file of images) {
        const buffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        imageBase64List.push({ base64, mimeType: file.type })
      }

      // For WhatsApp, use the confirmed/edited summary instead of raw chat
      const contentToSubmit = (category === 'WhatsApp Chat' && whatsappSummary)
        ? `[Original WhatsApp chat pasted by user — AI-extracted summary below]\n\n${whatsappSummary}`
        : content.trim()

      // Call API to process entry
      const response = await fetch('/api/process-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToSubmit,
          category,
          entry_type: images.length > 0 ? 'image' : 'text',
          image_urls: imageUrls,
          images: imageBase64List,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to process entry')
      }

      setMessage({ type: 'success', text: 'Entry submitted! Summary, timeline, and action items updated.' })
      setContent('')
      setImages([])
      setImagePreviews([])
      setCategory('General')
      setShowConfirmModal(false)
      setWhatsappSummary('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Add Information</h1>
      <p className="text-sm text-gray-500 mb-6">
        Submit new information — voice recordings, text notes, WhatsApp messages, or screenshots.
        The AI will automatically update the summary, timeline, and action items.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Voice Input</label>
          <VoiceInput onTranscript={(text) => setContent((prev) => prev ? prev + ' ' + text : text)} />
          <p className="text-xs text-gray-400 mt-1">
            Tap the mic button to dictate. If you have Wispr installed, you can also dictate directly into the text area below.
          </p>
        </div>

        {/* Text Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes / Transcription / WhatsApp Messages
          </label>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
            <p className="text-xs text-amber-800">
              <strong>WhatsApp chats welcome!</strong> Paste group chat messages directly — typos, emojis, mixed languages, and all.
              The AI will sort through the back-and-forth and extract only the medically relevant information.
            </p>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder={"Paste WhatsApp messages, type notes, or dictate...\n\nExamples of what you can paste:\n• WhatsApp group chat (copy-paste entire threads)\n• Doctor's verbal instructions you remember\n• Phone call notes\n• Appointment details\n• Questions for the next doctor visit"}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Screenshots / Images (optional)
          </label>
          <div className="flex flex-wrap gap-3 mb-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <ImagePlus size={24} />
              <span className="text-xs mt-1">Add</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <p className="text-xs text-gray-400">
            Upload screenshots of WhatsApp messages, medical documents, etc. AI will extract text from images.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || summarizing || (!content.trim() && images.length === 0)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Processing with AI...
            </>
          ) : summarizing ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Analyzing WhatsApp chat...
            </>
          ) : category === 'WhatsApp Chat' ? (
            <>
              <Eye size={18} /> Review & Submit
            </>
          ) : (
            <>
              <Send size={18} /> Submit Entry
            </>
          )}
        </button>
      </form>

      {/* WhatsApp Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Confirm Understanding</h2>
              <p className="text-sm text-gray-500 mt-1">
                Here&apos;s what the AI extracted from your WhatsApp conversation. Review and edit if needed before submitting.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {editingSummary ? (
                <textarea
                  value={whatsappSummary}
                  onChange={(e) => setWhatsappSummary(e.target.value)}
                  rows={16}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y font-mono"
                />
              ) : (
                <div className="prose prose-sm max-w-none bg-gray-50 rounded-xl p-4">
                  <ReactMarkdown>{whatsappSummary}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingSummary(!editingSummary)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Edit3 size={16} />
                  {editingSummary ? 'Preview' : 'Edit'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowConfirmModal(false)
                    setWhatsappSummary('')
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    // Submit with the confirmed summary
                    handleSubmit(e as unknown as React.FormEvent)
                  }}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} /> Confirm & Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
