import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { verifyAccessToken } from '../lib/jwt.js'
import { redisSub } from '../config/redis.js'
import { prisma } from '../config/db.js'
import { logger } from '../lib/logger.js'

interface ConnectedClient {
  ws: WebSocket
  userId: string
  role: 'ADMIN' | 'MEMBER'
  deptIds: string[]
  missedPings: number
  heartbeatTimer?: NodeJS.Timeout
}

const clients = new Map<string, ConnectedClient[]>() // Key: userId

function addClient(client: ConnectedClient) {
  const existing = clients.get(client.userId) || []
  clients.set(client.userId, [...existing, client])
}

function removeClient(client: ConnectedClient) {
  const userClients = clients.get(client.userId) || []
  const filtered = userClients.filter((c) => c.ws !== client.ws)
  if (filtered.length > 0) {
    clients.set(client.userId, filtered)
  } else {
    clients.delete(client.userId)
  }
}

function sendToWs(ws: WebSocket, event: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: event, payload, timestamp: new Date().toISOString() }))
  }
}

export function sendToUser(userId: string, event: string, payload: unknown): void {
  const userClients = clients.get(userId) || []
  userClients.forEach((c) => sendToWs(c.ws, event, payload))
}

export function sendToAll(event: string, payload: unknown): void {
  clients.forEach((userClients) => {
    userClients.forEach((c) => sendToWs(c.ws, event, payload))
  })
}

export function sendToAdmins(event: string, payload: unknown): void {
  clients.forEach((userClients) => {
    userClients.forEach((c) => {
      if (c.role === 'ADMIN') {
        sendToWs(c.ws, event, payload)
      }
    })
  })
}

export function sendToDeptUsers(deptId: string, event: string, payload: unknown): void {
  clients.forEach((userClients) => {
    userClients.forEach((c) => {
      if (c.role === 'ADMIN' || c.deptIds.includes(deptId)) {
        sendToWs(c.ws, event, payload)
      }
    })
  })
}

export function createWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws',handleProtocols: (protocols, req) => {
      const bearerProtocol = Array.from(protocols).find((p) =>
        p.startsWith('Bearer.')
      )
      // Return the matching protocol to satisfy the browser handshake
      return bearerProtocol || false
    }, })

  wss.on('connection', async (ws: WebSocket, req) => {
    let client: ConnectedClient | null = null

    try {
      const protocolHeader = req.headers['sec-websocket-protocol']

    if (!protocolHeader) {
      ws.close(4401, 'Unauthorized: Missing authentication')
      return
    }

    const protocols = protocolHeader
      .split(',')
      .map((protocol) => protocol.trim())

    const bearerProtocol = protocols.find((protocol) =>
      protocol.startsWith('Bearer.')
    )

    if (!bearerProtocol) {
      ws.close(4401, 'Unauthorized: Missing authentication')
      return
    }

    const token = bearerProtocol.slice('Bearer.'.length)

    if (!token) {
      ws.close(4401, 'Unauthorized: Missing token')
      return
    }

    const payload = verifyAccessToken(token)

      // Fetch user's active department memberships
      const accessRows = await prisma.userDepartmentAccess.findMany({
        where: { userId: payload.id, deletedAt: null },
        select: { departmentId: true },
      })
      const deptIds = accessRows.map((r: any) => r.departmentId)

      client = {
        ws,
        userId: payload.id,
        role: payload.role,
        deptIds,
        missedPings: 0,
      }

      addClient(client)

      // Start 30s Heartbeat
      client.heartbeatTimer = setInterval(() => {
        if (!client) return
        if (client.missedPings >= 3) {
          if (client.heartbeatTimer) clearInterval(client.heartbeatTimer)
          removeClient(client)
          ws.terminate()
          return
        }

        client.missedPings++
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString())
          if (parsed.type === 'pong' || parsed.type === 'ping') {
            if (client) client.missedPings = 0
          }
        } catch {
          // ignore malformed frame
        }
      })

      ws.on('close', () => {
        if (client) {
          if (client.heartbeatTimer) clearInterval(client.heartbeatTimer)
          removeClient(client)
        }
      })

      ws.on('error', () => {
        if (client) {
          if (client.heartbeatTimer) clearInterval(client.heartbeatTimer)
          removeClient(client)
        }
      })
    } catch {
      ws.close(4401, 'Unauthorized: Invalid token')
    }
  })

  // ============================================================
  // REDIS PUB/SUB BRIDGE
  // ============================================================
  try {
    redisSub.subscribe('cms.update', 'hdd.sync', 'notification.broadcast', () => {})
    redisSub.psubscribe('notification.*', 'file.*', () => {})
  } catch {}

  redisSub.on('message', (channel, message) => {
    try {
      const payload = JSON.parse(message)

      if (channel === 'cms.update') {
        sendToAll('CMS_UPDATE', payload)
      } else if (channel === 'hdd.sync') {
        sendToAdmins('SYNC_COMPLETE', payload)
      } else if (channel === 'notification.broadcast') {
        sendToAll('NOTIFICATION', payload)
      }
    } catch (err) {
      logger.error('WEBSOCKET', 'Redis message parse error:', err)
    }
  })

  redisSub.on('pmessage', (_pattern, channel, message) => {
    try {
      const payload = JSON.parse(message)

      if (channel.startsWith('notification.')) {
        const targetUserId = channel.replace('notification.', '')
        if (targetUserId !== 'broadcast') {
          sendToUser(targetUserId, 'NOTIFICATION', payload)
        }
      } else if (channel.startsWith('file.upload.')) {
        const deptId = channel.replace('file.upload.', '')
        sendToDeptUsers(deptId, 'FILE_UPLOAD', payload)
      } else if (channel.startsWith('file.deleted.')) {
        const deptId = channel.replace('file.deleted.', '')
        sendToDeptUsers(deptId, 'FILE_DELETED', payload)
      }
    } catch (err) {
      logger.error('WEBSOCKET', 'Redis pmessage parse error:', err)
    }
  })

  return wss
}
