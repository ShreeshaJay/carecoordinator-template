'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Square } from 'lucide-react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
}

export default function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let fullTranscript = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          fullTranscript += transcript + ' '
          onTranscript(fullTranscript.trim())
        } else {
          interim += transcript
        }
      }
      setInterimText(interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [onTranscript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimText('')
  }, [])

  if (!supported) {
    return (
      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
        Voice input is not supported in this browser. Use Chrome or Edge for voice, or type/paste your text below. If you have Wispr installed, you can dictate directly into the text field.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isListening
            ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {isListening ? (
          <>
            <Square size={16} className="fill-current" /> Stop Recording
          </>
        ) : (
          <>
            <Mic size={16} /> Start Voice Input
          </>
        )}
      </button>
      {isListening && interimText && (
        <span className="text-sm text-gray-400 italic truncate max-w-xs">{interimText}...</span>
      )}
    </div>
  )
}
