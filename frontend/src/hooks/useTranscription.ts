import { useEffect, useRef, useCallback, useState } from 'react'
import { useChatStore } from '../stores/useChatStore'

let muteUntilTimestamp = 0

export function muteTranscriptionFor(durationMs: number) {
  muteUntilTimestamp = Date.now() + durationMs
}

interface UseTranscriptionOptions {
  enabled?: boolean
  onTranscription?: (text: string, speaker: string) => void
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const { enabled = true, onTranscription } = options

  const addMessage = useChatStore((state) => state.addMessage)
  const wsRef = useRef<WebSocket | null>(null)
  const lastTranscriptionRef = useRef<string | null>(null)
  const isConnectingRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)

  const handleTranscription = useCallback((text: string, speaker: string = "Someone") => {
    if (Date.now() < muteUntilTimestamp) return
    if (!text.trim()) return

    const fullText = `${speaker}: ${text}`.trim()
    if (lastTranscriptionRef.current === fullText) {
      return
    }
    lastTranscriptionRef.current = fullText

    console.log(`Transcription from ${speaker}: ${text}`)

    addMessage(fullText, false)

    onTranscription?.(text, speaker)
  }, [addMessage, onTranscription])

  // Connect to WebSocket to receive transcriptions from backend
  useEffect(() => {
    if (!enabled) return

    const wsUrl = 'ws://localhost:8000/ws/transcription'
    let reconnectTimeout: number | null = null
    let pingInterval: number | null = null

    const connectWs = () => {
      if (wsRef.current && (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      )) {
        return
      }
      if (isConnectingRef.current) {
        return
      }

      try {
        isConnectingRef.current = true
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('Transcription WebSocket connected')
          setIsConnected(true)
          isConnectingRef.current = false
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'transcription' && data.text) {
              handleTranscription(data.text, data.speaker || 'Someone')
            }
          } catch (e) {
            // Ignore pong and other non-JSON messages
          }
        }

        ws.onclose = () => {
          console.log('Transcription WebSocket disconnected')
          setIsConnected(false)
          wsRef.current = null
          isConnectingRef.current = false
          // Reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectWs, 3000)
        }

        ws.onerror = () => {
          isConnectingRef.current = false
        }

        wsRef.current = ws

        // Keepalive ping every 30 seconds
        pingInterval = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 30000)
      } catch (error) {
        isConnectingRef.current = false
        reconnectTimeout = window.setTimeout(connectWs, 3000)
      }
    }

    connectWs()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (pingInterval) clearInterval(pingInterval)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, handleTranscription])

  return { isConnected }
}
