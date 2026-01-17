import { create } from 'zustand'

export interface ChatMessage {
  id: string
  text: string
  timestamp: Date
  isUser: boolean
}

interface ChatState {
  messages: ChatMessage[]
  currentSentence: string[]

  addWord: (word: string) => boolean // Returns true if sentence completed
  clearCurrentSentence: () => void
  addMessage: (text: string, isUser?: boolean) => void
  getCurrentSentenceText: () => string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function isSentenceEnder(word: string): boolean {
  return /[.!?]$/.test(word)
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentSentence: [],

  addWord: (word) => {
    const isSentenceComplete = isSentenceEnder(word)

    set((state) => {
      const newSentence = [...state.currentSentence, word]

      if (isSentenceComplete) {
        const sentenceText = newSentence.join(' ')
        const newMessage: ChatMessage = {
          id: generateId(),
          text: sentenceText,
          timestamp: new Date(),
          isUser: true
        }
        return {
          currentSentence: [],
          messages: [...state.messages, newMessage]
        }
      }

      return { currentSentence: newSentence }
    })

    return isSentenceComplete
  },

  clearCurrentSentence: () => set({ currentSentence: [] }),

  addMessage: (text, isUser = false) => set((state) => ({
    messages: [...state.messages, {
      id: generateId(),
      text,
      timestamp: new Date(),
      isUser
    }]
  })),

  getCurrentSentenceText: () => {
    const state = get()
    return state.currentSentence.join(' ')
  }
}))
