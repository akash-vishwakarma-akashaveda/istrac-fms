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

function getBaseWsUrl(): string {
  let envUrl = import.meta.env.VITE_WS_URL || ""

  // Fallback to VITE_API_URL if VITE_WS_URL is not set
  if (!envUrl && import.meta.env.VITE_API_URL) {
    envUrl = import.meta.env.VITE_API_URL.replace(/^http/i, "ws")
  }

  if (!envUrl && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    envUrl = `${proto}//${window.location.host}/ws`
  }

  if (!envUrl) {
    envUrl = "wss://d2qycovk79gx2n.cloudfront.net/ws"
  }

  // Force wss:// when running over HTTPS (e.g. AWS Amplify)
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    envUrl = envUrl.replace(/^ws:\/\//i, "wss://")
  }

  // Ensure trailing path is /ws
  try {
    const parsed = new URL(envUrl.replace(/^wss?:/i, "https:"))
    if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "") {
      envUrl = envUrl.replace(/\/+$/, "") + "/ws"
    }
  } catch {
    if (!envUrl.endsWith("/ws")) {
      envUrl = envUrl.replace(/\/+$/, "") + "/ws"
    }
  }

  return envUrl
}

class WSClient {
  private socket: WebSocket | null = null
  private handlers = new Map<string, MessageHandler[]>()
  private reconnectAttempt = 0
  private maxReconnectAttempts = 5
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  connect() {
    const token = useAuthStore.getState().accessToken
    // Do not attempt to establish WebSocket for unauthenticated public sessions
    if (!token) return

    const baseWsUrl = getBaseWsUrl()

    try {
      // Do NOT pass token in query string (prevents token leakage in URL, logs, and browser console)
      this.socket = new WebSocket(baseWsUrl, [`Bearer.${token}`])

      this.socket.onopen = () => {
        this.reconnectAttempt = 0
        this.startHeartbeat()
        // Send auth frame as supplementary verification
        try {
          this.socket?.send(JSON.stringify({ type: 'auth', token }))
        } catch {}
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
    this.reconnectAttempt = 0
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

    // Exponential backoff up to 30s; if max attempts exceeded, pause for 60s
    let delay = Math.min(1500 * 2 ** this.reconnectAttempt, 30_000)
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      delay = 60_000 // pause for 1 minute before retrying
      this.reconnectAttempt = 0
    } else {
      this.reconnectAttempt++
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      const token = useAuthStore.getState().accessToken
      if (token) {
        this.connect()
      }
    }, delay)
  }
}

export const wsClient = new WSClient()
