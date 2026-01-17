import { create } from 'zustand'
import { commonWords } from '../data/commonWords'
import { sentenceStarters } from '../data/sentenceStarters'

type GridMode = 'normal' | 'sentence-start'

interface GridState {
  cursorPosition: number
  words: string[]
  mode: GridMode

  moveRight: () => void
  moveDown: () => void
  refreshGrid: () => void
  setMode: (mode: GridMode) => void
  getCurrentWord: () => string
}

const GRID_SIZE = 5
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE

function getRandomWords(wordList: string[], count: number): string[] {
  const shuffled = [...wordList].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export const useGridStore = create<GridState>((set, get) => ({
  cursorPosition: 0,
  words: getRandomWords(commonWords, TOTAL_CELLS),
  mode: 'sentence-start',

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

  refreshGrid: () => set((state) => {
    const wordList = state.mode === 'sentence-start' ? sentenceStarters : commonWords
    return {
      words: getRandomWords(wordList, TOTAL_CELLS),
      cursorPosition: 0
    }
  }),

  setMode: (mode) => set((state) => {
    const wordList = mode === 'sentence-start' ? sentenceStarters : commonWords
    return {
      mode,
      words: getRandomWords(wordList, TOTAL_CELLS),
      cursorPosition: 0
    }
  }),

  getCurrentWord: () => {
    const state = get()
    return state.words[state.cursorPosition] || ''
  }
}))
