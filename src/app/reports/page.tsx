'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { Upload, FileText, Trash2, ExternalLink, Loader2, Brain, CheckCircle, AlertCircle, Download } from 'lucide-react'

interface Report {
  id: string
  filename: string
  file_url: string
  description: string
  uploaded_at: string
  profiles: { display_name: string } | null
}

import { ALL_CATEGORIES } from '@/lib/config'

const CATEGORIES = ALL_CATEGORIES

export default function ReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, filename: '' })
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const driveId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*, profiles:uploaded_by(display_name)')
      .order('uploaded_at', { ascending: false })
    if (error) {
      console.error('Error loading reports:', error)
      // Fallback: load without the join in case profiles table has issues
      const { data: fallbackData } = await supabase
        .from('reports')
        .select('*')
        .order('uploaded_at', { ascending: false })
      if (fallbackData) setReports(fallbackData.map(r => ({ ...r, profiles: null })) as Report[])
    } else if (data) {
      setReports(data as Report[])
    }
    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    setMessage(null)
    setUploadProgress({ current: 0, total: files.length, filename: '' })

    let successCount = 0
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress({ current: i + 1, total: files.length, filename: file.name })

        // Check for duplicate filename
        const duplicate = reports.find(
          (r) => r.filename.toLowerCase() === file.name.toLowerCase()
        )
        if (duplicate) {
          const uploadDate = new Date(duplicate.uploaded_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })
          const proceed = window.confirm(
            `"${file.name}" was already uploaded on ${uploadDate}.\n\nUpload again anyway?`
          )
          if (!proceed) continue
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('description', description)
        formData.append('category', category)

        const response = await fetch('/api/process-report', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed')
        }

        successCount++
        if (result.ai_processed) {
          setMessage({
            type: 'success',
            text: files.length > 1
              ? `Processing ${i + 1}/${files.length}: ${file.name} done.`
              : `${file.name} uploaded and processed by AI. Summary, timeline, and action items updated.`,
          })
        } else {
          setMessage({
            type: 'info',
            text: result.message || `${file.name} uploaded successfully.`,
          })
        }
      }

      // Final summary message for multi-file uploads
      if (files.length > 1) {
        setMessage({
          type: 'success',
          text: `All done! ${successCount} of ${files.length} file${files.length > 1 ? 's' : ''} uploaded and processed.`,
        })
      }

      setDescription('')
      setCategory('General')
      loadReports()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Upload failed',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function deleteReport(report: Report) {
    const url = new URL(report.file_url)
    const pathMatch = url.pathname.match(/\/uploads\/(.+)$/)
    if (pathMatch) {
      await supabase.storage.from('uploads').remove([pathMatch[1]])
    }
    await supabase.from('reports').delete().eq('id', report.id)
    setReports((prev) => prev.filter((r) => r.id !== report.id))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports & Documents</h1>

      {/* Google Drive Link */}
      {driveId && (
        <section className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Google Drive Folder</h2>
          <a
            href={`https://drive.google.com/drive/folders/${driveId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <ExternalLink size={16} />
            Open Shared Google Drive Folder
          </a>
          <p className="text-xs text-gray-400 mt-2">
            The shared Google Drive folder contains all reports shared with the wider family.
          </p>
        </section>
      )}

      {/* Upload Section */}
      <section className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Upload Documents</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Context / Notes</label>
            <textarea
              placeholder={"Add any context that will help the AI process this document, e.g.:\n• Who created it and when\n• Which doctor or hospital it's from\n• What it's about (referral, test results, etc.)"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
            />
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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

          <div className="flex gap-3 items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading & Processing...' : 'Upload Files'}
            </button>
            {uploading && (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-xs text-blue-600">
                  <Brain size={14} className="animate-pulse" />
                  {uploadProgress.total > 1
                    ? `Processing file ${uploadProgress.current} of ${uploadProgress.total}`
                    : 'AI is extracting and processing the document...'}
                </span>
                {uploadProgress.filename && (
                  <span className="text-xs text-gray-500 truncate max-w-xs">
                    {uploadProgress.filename}
                  </span>
                )}
                {uploadProgress.total > 1 && (
                  <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-400">
            PDF files are automatically parsed and processed by AI to update the summary, timeline, and action items.
          </p>
        </div>

        {/* Status message */}
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' :
            message.type === 'error' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {message.type === 'success' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> :
             message.type === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> :
             <Brain size={16} className="mt-0.5 shrink-0" />}
            {message.text}
          </div>
        )}
      </section>

      {/* Reports List */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Uploaded Documents</h2>
        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <p className="text-gray-400">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4 group">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block"
                  >
                    {report.filename}
                  </a>
                  <div className="flex gap-3 text-xs text-gray-400">
                    {report.description && <span>{report.description}</span>}
                    <span>{format(new Date(report.uploaded_at), 'MMM d, yyyy')}</span>
                    <span>by {report.profiles?.display_name || 'Unknown'}</span>
                  </div>
                </div>
                <a
                  href={report.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-500 shrink-0"
                  title="Download / View"
                >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${report.filename}"? This cannot be undone.`)) {
                      deleteReport(report)
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
