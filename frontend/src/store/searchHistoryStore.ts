import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SearchHistoryState {
  history: string[]
  addSearch: (query: string) => void
  clearHistory: () => void
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      history: [],
      addSearch: (query) =>
        set((s) => ({
          history: [query, ...s.history.filter((q) => q !== query)].slice(0, 20),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'istrac-search-history', storage: createJSONStorage(() => localStorage) }
  )
)