import { useState, useCallback } from 'react'
import { useGridStore } from '../stores/useGridStore'
import { useChatStore } from '../stores/useChatStore'
import { useClenchStore } from '../stores/useClenchStore'

interface UseAutoSelectOptions {
  onSelect?: (word: string) => void
  onRefresh?: () => void
}

export function useAutoSelect(options: UseAutoSelectOptions = {}) {
  const { onSelect, onRefresh } = options

  // No auto-select timer - only manual selection via 3 clenches
  const [progress] = useState(0)

  const getCurrentWord = useGridStore((state) => state.getCurrentWord)
  const isOnRefreshButton = useGridStore((state) => state.isOnRefreshButton)
  const refreshGrid = useGridStore((state) => state.refreshGrid)
  const setMode = useGridStore((state) => state.setMode)
  const addWord = useChatStore((state) => state.addWord)
  const triggerClench = useClenchStore((state) => state.triggerClench)

  const performAction = useCallback(() => {
    // Check if on refresh button
    if (isOnRefreshButton()) {
      triggerClench(0)
      refreshGrid()
      onRefresh?.()
      return
    }

    // Select word
    const word = getCurrentWord()
    if (!word) return

    // Trigger visual indicator for selection
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
  }, [getCurrentWord, isOnRefreshButton, addWord, setMode, refreshGrid, triggerClench, onSelect, onRefresh])

  return {
    progress,
    isSelecting: false,
    performAction
  }
}
