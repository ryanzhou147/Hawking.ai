import { useEffect, useRef, useState, useCallback } from 'react'
import { useGridStore } from '../stores/useGridStore'
import { useChatStore } from '../stores/useChatStore'
import { useClenchStore } from '../stores/useClenchStore'

interface UseAutoSelectOptions {
  delay?: number
  enabled?: boolean
  onSelect?: (word: string) => void
}

export function useAutoSelect(options: UseAutoSelectOptions = {}) {
  const { delay = 800, enabled = true, onSelect } = options

  const [progress, setProgress] = useState(0)
  const [isSelecting, setIsSelecting] = useState(false)
  const timerRef = useRef<number | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const lastPositionRef = useRef<number>(0)

  const cursorPosition = useGridStore((state) => state.cursorPosition)
  const getCurrentWord = useGridStore((state) => state.getCurrentWord)
  const setMode = useGridStore((state) => state.setMode)
  const addWord = useChatStore((state) => state.addWord)
  const triggerClench = useClenchStore((state) => state.triggerClench)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setProgress(0)
    setIsSelecting(false)
  }, [])

  const selectWord = useCallback(() => {
    const word = getCurrentWord()
    if (!word) return

    // Trigger visual indicator for selection (0 clenches = pause selection)
    triggerClench(0)

    // Add word to current sentence
    const sentenceCompleted = addWord(word)

    // If sentence completed, switch to sentence-start mode
    if (sentenceCompleted) {
      setMode('sentence-start')
    } else {
      setMode('normal')
    }

    onSelect?.(word)
    clearTimers()
  }, [getCurrentWord, addWord, setMode, triggerClench, onSelect, clearTimers])

  const startTimer = useCallback(() => {
    if (!enabled) return

    clearTimers()
    setIsSelecting(true)

    // Start progress animation
    const startTime = Date.now()
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / delay) * 100, 100)
      setProgress(newProgress)
    }, 16) // ~60fps

    // Set selection timer
    timerRef.current = window.setTimeout(() => {
      selectWord()
    }, delay)
  }, [enabled, delay, selectWord, clearTimers])

  // Watch for cursor position changes
  useEffect(() => {
    if (!enabled) return

    // If position changed, reset timer
    if (cursorPosition !== lastPositionRef.current) {
      lastPositionRef.current = cursorPosition
      startTimer()
    }

    return () => clearTimers()
  }, [cursorPosition, enabled, startTimer, clearTimers])

  // Start timer on mount
  useEffect(() => {
    if (enabled) {
      startTimer()
    }
    return () => clearTimers()
  }, [enabled, startTimer, clearTimers])

  return {
    progress,
    isSelecting,
    resetTimer: startTimer
  }
}
