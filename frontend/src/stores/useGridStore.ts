import { create } from 'zustand'
import { fetchWords, refreshWords, ChatMessage as ApiChatMessage } from '../api/wordApi'
import { sentenceStarters } from '../data/sentenceStarters'

type GridMode = 'normal' | 'sentence-start'

interface GridState {
  cursorPosition: number
  words: string[]
  cachedWords: string[]
  mode: GridMode
  isLoading: boolean
  isBackendConnected: boolean

  moveRight: () => void
  moveDown: () => void
  refreshGrid: () => void
  setMode: (mode: GridMode) => void
  getCurrentWord: () => string | null  // null if on refresh button
  isOnRefreshButton: () => boolean
  setWords: (words: string[], cached?: string[]) => void
  fetchNewWords: (
    chatHistory: Array<{ text: string; isUser: boolean }>,
    currentSentence: string[],
    isSentenceStart: boolean
  ) => Promise<void>
  setBackendConnected: (connected: boolean) => void
}

const GRID_SIZE = 5
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE
const WORD_COUNT = 24  // 24 words + 1 refresh button
const REFRESH_BUTTON_INDEX = 4  // Top-right corner (index 4 in 5x5 grid)

// Fallback words if backend is unavailable
const DEFAULT_STARTERS = sentenceStarters.slice(0, WORD_COUNT)

export const useGridStore = create<GridState>((set, get) => ({
  cursorPosition: 0,
  words: DEFAULT_STARTERS,
  cachedWords: DEFAULT_STARTERS,
  mode: 'sentence-start',
  isLoading: false,
  isBackendConnected: false,

  moveRight: () => set((state) => {
    const col = state.cursorPosition % GRID_SIZE
    const row = Math.floor(state.cursorPosition / GRID_SIZE)
    const newCol = (col + 1) % GRID_SIZE
    return { cursorPosition: row * GRID_SIZE + newCol }
  }),

  moveDown: () => set((state) => {
    const row = Math.floor(state.cursorPosition / GRID_SIZE)
    const col = state.cursorPosition % GRID_SIZE
    const newRow = (row + 1) % GRID_SIZE
    return { cursorPosition: newRow * GRID_SIZE + col }
  }),

  refreshGrid: () => {
    const state = get()
    // Use cached words immediately
    set({
      words: state.cachedWords,
      cursorPosition: 0
    })
  },

  setMode: (mode) => set({ mode }),

  getCurrentWord: () => {
    const state = get()
    if (state.cursorPosition === REFRESH_BUTTON_INDEX) {
      return null  // On refresh button
    }
    // Adjust index to account for refresh button
    const wordIndex = state.cursorPosition > REFRESH_BUTTON_INDEX
      ? state.cursorPosition - 1
      : state.cursorPosition
    return state.words[wordIndex] || ''
  },

  isOnRefreshButton: () => {
    return get().cursorPosition === REFRESH_BUTTON_INDEX
  },

  setWords: (words, cached) => set({
    words: words.slice(0, WORD_COUNT),
    cachedWords: cached ? cached.slice(0, WORD_COUNT) : get().cachedWords,
    cursorPosition: 0
  }),

  fetchNewWords: async (chatHistory, currentSentence, isSentenceStart) => {
    set({ isLoading: true })

    try {
      // Convert to API format
      const apiChatHistory: ApiChatMessage[] = chatHistory.map(msg => ({
        text: msg.text,
        is_user: msg.isUser
      }))

      const response = await fetchWords({
        chat_history: apiChatHistory,
        current_sentence: currentSentence,
        is_sentence_start: isSentenceStart
      })

      set({
        words: response.words.slice(0, WORD_COUNT),
        cachedWords: response.cached_words.slice(0, WORD_COUNT),
        cursorPosition: 0,
        isLoading: false,
        isBackendConnected: true,
        mode: isSentenceStart ? 'sentence-start' : 'normal'
      })
    } catch (error) {
      console.error('Failed to fetch words from backend:', error)
      set({
        isLoading: false,
        isBackendConnected: false
      })
    }
  },

  setBackendConnected: (connected) => set({ isBackendConnected: connected })
}))

export { REFRESH_BUTTON_INDEX, WORD_COUNT, GRID_SIZE, TOTAL_CELLS }
