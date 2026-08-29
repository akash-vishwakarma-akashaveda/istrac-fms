import { api } from "../lib/axios";
import { useAuthStore } from '../store/authStore'

type MessageHandler = (event: string, payload: unknown) => void
const EXPECTED_EVENTS = new Set(['ping', 'pong', 'CMS_UPDATE', 'NOTIFICATION', 'FILE_UPLOAD', 'FILE_DELETED', 'SYNC_COMPLETE'])
class WSClient {
  private socket: WebSocket | null = null
  private handlers = new Map<string, MessageHandler[]>()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  connect() {
    const token = useAuthStore.getState().accessToken
    if (!token) return

    const baseWsUrl = import.meta.env.VITE_WS_URL!
    // const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(token)}`

    try {
      this.socket = new WebSocket(baseWsUrl, [`Bearer.${token}`])

      this.socket.onopen = () => {
        this.reconnectAttempt = 0
        this.startHeartbeat()
      }

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          const eventType = parsed.type || parsed.channel || 'message'
          if (!EXPECTED_EVENTS.has(eventType)) {
  console.warn('[WS] Unexpected event type ignored:', eventType)
  return
}
          const payload = parsed.payload !== undefined ? parsed.payload : parsed

          const eventHandlers = this.handlers.get(eventType) || []
          eventHandlers.forEach((h) => h(eventType, payload))

          // Also notify wildcard handlers
          const wildcardHandlers = this.handlers.get('*') || []
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

  private scheduleReconnect() {
    const delays = [1000, 2000, 4000, 8000, 16000]
    const delay = delays[this.reconnectAttempt] ?? 60000
    this.reconnectAttempt++

      this.reconnectTimer = setTimeout(async () => {
    // Ensure token is valid before reconnecting
    try {
      const { data } =  await api.post("/auth/refresh");
      const newToken = data?.data?.accessToken || data.accessToken
      if (newToken) {
        const user = useAuthStore.getState().user
        if (user) useAuthStore.getState().setAuth(user, newToken)
      }
    } catch { return }
    this.connect()
  }, delay)
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
  }

  subscribe(eventOrChannel: string, handler: MessageHandler) {
    if (!this.handlers.has(eventOrChannel)) this.handlers.set(eventOrChannel, [])
    this.handlers.get(eventOrChannel)!.push(handler)

    return () => {
      const list = this.handlers.get(eventOrChannel) || []
      this.handlers.set(eventOrChannel, list.filter((h) => h !== handler))
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.stopHeartbeat()
    this.socket?.close()
    this.socket = null
  }
}

export const wsClient = new WSClient()