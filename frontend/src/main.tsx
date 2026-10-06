// Polyfill ES2024 features before any imports (fixes pdfjs-dist on older Chromium/Chrome/Edge <119)
if (typeof (globalThis as any).Iterator === 'undefined') {
  ;(globalThis as any).Iterator = class Iterator {}
}
if (typeof (Promise as any).withResolvers === 'undefined') {
  ;(Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}
if (typeof (Object as any).groupBy === 'undefined') {
  ;(Object as any).groupBy = function <T, K extends PropertyKey>(
    items: Iterable<T>,
    callback: (item: T, index: number) => K
  ): Partial<Record<K, T[]>> {
    const result = Object.create(null)
    let i = 0
    for (const item of items) {
      const key = callback(item, i++)
      if (key in result) {
        result[key].push(item)
      } else {
        result[key] = [item]
      }
    }
    return result
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient.ts'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
