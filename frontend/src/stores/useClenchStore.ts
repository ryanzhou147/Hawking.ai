import { create } from 'zustand'

interface ClenchState {
  lastClenchCount: number
  activeIndicator: number | null
  isFading: boolean

  triggerClench: (count: number) => void
  clearIndicator: () => void
}

export const useClenchStore = create<ClenchState>((set) => ({
  lastClenchCount: 0,
  activeIndicator: null,
  isFading: false,

  triggerClench: (count) => {
    set({
      lastClenchCount: count,
      activeIndicator: count,
      isFading: false
    })

    // Start fading after a brief moment
    setTimeout(() => {
      set({ isFading: true })
    }, 100)

    // Clear indicator after 800ms
    setTimeout(() => {
      set({ activeIndicator: null, isFading: false })
    }, 800)
  },

  clearIndicator: () => set({
    activeIndicator: null,
    isFading: false
  })
}))
