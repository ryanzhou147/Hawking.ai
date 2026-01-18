import { useEffect, useCallback, useRef } from 'react'
import { Layout } from './components/Layout'
import { WordGrid } from './components/WordGrid'
import { ChatPanel } from './components/ChatPanel'
import { ActionIndicators } from './components/ActionIndicators'
import { useKeyboardSimulation } from './hooks/useKeyboardSimulation'
import { useSignalListener } from './hooks/useSignalListener'
import { useTranscription, muteTranscriptionFor } from './hooks/useTranscription'
import { useWordGeneration } from './hooks/useWordGeneration'
import { useGridStore } from './stores/useGridStore'
import { useChatStore } from './stores/useChatStore'
import { useClenchStore } from './stores/useClenchStore'
import { speakSentence } from './api/wordApi'

function App() {
  const { onWordSelected, onSentenceComplete, onRefresh, isBackendConnected } = useWordGeneration()

  const mode = useGridStore((state) => state.mode)
  const getCurrentWord = useGridStore((state) => state.getCurrentWord)
  const isOnRefreshButton = useGridStore((state) => state.isOnRefreshButton)
  const refreshGrid = useGridStore((state) => state.refreshGrid)
  const setMode = useGridStore((state) => state.setMode)
  const generationTime = useGridStore((state) => state.generationTime)

  const messages = useChatStore((state) => state.messages)
  const addWord = useChatStore((state) => state.addWord)
  const lastSpokenMessageId = useRef<string | null>(null)

  // Handle manual selection (3 clenches)
  const handleManualSelect = useCallback(() => {
    if (isOnRefreshButton()) {
      refreshGrid()
      onRefresh()
      return
    }

    const word = getCurrentWord()
    if (!word) return

    const sentenceCompleted = addWord(word)

    if (sentenceCompleted) {
      setMode('sentence-start')
    } else {
      setMode('normal')
    }

    onWordSelected(word)
  }, [getCurrentWord, isOnRefreshButton, addWord, setMode, refreshGrid, onRefresh, onWordSelected])

  // Enable keyboard simulation for dev mode (ArrowRight, ArrowDown, 1, 2, 3)
  useKeyboardSimulation({
    enabled: true,
    onSelect: handleManualSelect
  })

  // Enable signal listener for ClenchDetection.py (RIGHT, DOWN, SELECT via WebSocket)
  useSignalListener({
    enabled: true,
    onSelect: handleManualSelect
  })

  // Transcription runs as separate Python process (TranscriptionService.py)
  // Frontend just receives transcriptions via WebSocket - no CPU impact
  useTranscription({
    enabled: true  // Only listens to WebSocket, doesn't use browser mic
  })

  // Watch for mode changes to sentence-start (sentence completed)
  useEffect(() => {
    if (mode === 'sentence-start' && messages.length > 0) {
      onSentenceComplete()
    }
  }, [mode, messages.length, onSentenceComplete])

  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (!last.isUser) return
    const text = last.text.trim()
    if (!/[.!?]$/.test(text)) return
    if (lastSpokenMessageId.current === last.id) return
    lastSpokenMessageId.current = last.id

    const wordCount = text.split(/\s+/).filter(Boolean).length
    const muteDuration = Math.min(10000, Math.max(3000, wordCount * 450))
    muteTranscriptionFor(muteDuration)

    speakSentence(text).catch((error) => {
      console.error('Failed to speak sentence:', error)
    })
  }, [messages])

  return (
    <Layout
      leftPanel={
        <WordGrid
          onWordSelected={onWordSelected}
          onRefresh={onRefresh}
        />
      }
      rightPanel={<ChatPanel />}
      bottomBar={<ActionIndicators />}
    />
  )
}

export default App
