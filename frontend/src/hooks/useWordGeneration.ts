import { useEffect, useCallback } from 'react'
import { useGridStore } from '../stores/useGridStore'
import { useChatStore } from '../stores/useChatStore'
import { checkHealth, refreshWords, ChatMessage as ApiChatMessage } from '../api/wordApi'

export function useWordGeneration() {
  const fetchNewWords = useGridStore((state) => state.fetchNewWords)
  const setWords = useGridStore((state) => state.setWords)
  const setBackendConnected = useGridStore((state) => state.setBackendConnected)
  const isBackendConnected = useGridStore((state) => state.isBackendConnected)
  const mode = useGridStore((state) => state.mode)
  const cachedWords = useGridStore((state) => state.cachedWords)

  const messages = useChatStore((state) => state.messages)
  const currentSentence = useChatStore((state) => state.currentSentence)

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      const healthy = await checkHealth()
      setBackendConnected(healthy)

      if (healthy) {
        // Fetch initial words
        const chatHistory = messages.map(msg => ({
          text: msg.text,
          isUser: msg.isUser
        }))
        fetchNewWords(chatHistory, currentSentence, mode === 'sentence-start')
      }
    }

    checkBackend()

    // Check periodically
    const interval = setInterval(checkBackend, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch new words when sentence is completed (mode changes to sentence-start)
  const onSentenceComplete = useCallback(async () => {
    if (!isBackendConnected) return

    const chatHistory = messages.map(msg => ({
      text: msg.text,
      isUser: msg.isUser
    }))

    await fetchNewWords(chatHistory, [], true)
  }, [isBackendConnected, messages, fetchNewWords])

  // Fetch new words when a word is selected (continuing sentence)
  const onWordSelected = useCallback(async (word: string) => {
    if (!isBackendConnected) return

    const chatHistory = messages.map(msg => ({
      text: msg.text,
      isUser: msg.isUser
    }))

    const newSentence = [...currentSentence, word]
    const isSentenceEnd = /[.!?]$/.test(word)

    if (!isSentenceEnd) {
      await fetchNewWords(chatHistory, newSentence, false)
    }
    // If sentence ends, onSentenceComplete will be called separately
  }, [isBackendConnected, messages, currentSentence, fetchNewWords])

  // Handle refresh (3 clenches) - swap cache and fetch new cache
  const onRefresh = useCallback(async () => {
    // Immediately show cached words
    setWords(cachedWords)

    if (!isBackendConnected) return

    try {
      const chatHistory = messages.map(msg => ({
        text: msg.text,
        isUser: msg.isUser
      }))

      const apiChatHistory: ApiChatMessage[] = chatHistory.map(msg => ({
        text: msg.text,
        is_user: msg.isUser
      }))

      const response = await refreshWords({
        chat_history: apiChatHistory,
        current_sentence: currentSentence,
        is_sentence_start: mode === 'sentence-start'
      })

      // Update cache with new words
      setWords(response.words, response.cached_words)
    } catch (error) {
      console.error('Failed to refresh words:', error)
    }
  }, [isBackendConnected, messages, currentSentence, mode, cachedWords, setWords])

  return {
    onSentenceComplete,
    onWordSelected,
    onRefresh,
    isBackendConnected
  }
}
