import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface PreviewRefreshContextValue {
  refreshKey: number
  triggerRefresh: () => void
  activeSection: string | null
  scrollToSection: (sectionKey: string) => void
}

const PreviewRefreshContext = createContext<PreviewRefreshContextValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
  activeSection: null,
  scrollToSection: () => {},
})

export function PreviewRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const scrollToSection = useCallback((sectionKey: string) => {
    setActiveSection(sectionKey)
  }, [])

  return (
    <PreviewRefreshContext.Provider value={{ refreshKey, triggerRefresh, activeSection, scrollToSection }}>
      {children}
    </PreviewRefreshContext.Provider>
  )
}

export function usePreviewRefresh() {
  return useContext(PreviewRefreshContext)
}