import { useAuthStore } from "../store/authStore"

type MessageHandler = (event: string, payload: unknown) => void
const EXPECTED_EVENTS = new Set([
  "ping",
  "pong",
  "CMS_UPDATE",
  "cms.update",
  "cms",
  "NOTIFICATION",
  "FILE_UPLOAD",
  "FILE_DELETED",
  "SYNC_COMPLETE",
])

function getSecureWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL
  if (envUrl) {
    // If the browser page is loaded over HTTPS (like AWS Amplify), force wss://
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      return envUrl.replace(/^ws:\/\//i, "wss://")
    }
    return envUrl
  }

  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${proto}//${window.location.host}/ws`
  }

  return "wss://d2qycovk79gx2n.cloudfront.net/"
}

class WSClient {
  private socket: WebSocket | null = null
  private handlers = new Map<string, MessageHandler[]>()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  connect() {
    const token = useAuthStore.getState().accessToken
    if (!token) return

    const wsUrl = getSecureWsUrl()

    try {
      this.socket = new WebSocket(wsUrl, [`Bearer.${token}`])

      this.socket.onopen = () => {
        this.reconnectAttempt = 0
        this.startHeartbeat()
      }

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          const eventType = parsed.type || parsed.channel || "message"
          if (!EXPECTED_EVENTS.has(eventType)) {
            return
          }
          const payload = parsed.payload !== undefined ? parsed.payload : parsed

          const eventHandlers = this.handlers.get(eventType) || []
          eventHandlers.forEach((h) => h(eventType, payload))

          // Also notify wildcard handlers
          const wildcardHandlers = this.handlers.get("*") || []
          wildcardHandlers.forEach((h) => h(eventType, payload))
        } catch {
          // ignore malformed frame
        }
      }

      this.socket.onclose = (event) => {
        this.stopHeartbeat()
        // Code 4401 = server rejected an invalid/expired token — do not spam retry
        if (event.code !== 4401) {
          this.scheduleReconnect()
        }
      }

      this.socket.onerror = () => {
        this.socket?.close()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  subscribe(event: string, handler: MessageHandler): () => void {
    const list = this.handlers.get(event) || []
    list.push(handler)
    this.handlers.set(event, list)

    return () => {
      const current = this.handlers.get(event) || []
      this.handlers.set(
        event,
        current.filter((h) => h !== handler)
      )
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "ping" }))
      }
    }, 30_000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}

export const wsClient = new WSClient()
