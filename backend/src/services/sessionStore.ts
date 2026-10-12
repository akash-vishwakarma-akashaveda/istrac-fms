import { redis } from '../config/redis.js'

const SESSION_PREFIX = 'session:'
const BLACKLIST_PREFIX = 'blacklist:'

// In-memory fallback map if Redis is not running
const memSessions = new Map<string, { value: string; expiresAt: number }>()
const memBlacklist = new Map<string, number>()
const memUserRevoked = new Map<string, number>()
// Access tokens live 15 minutes; remembering a revocation for 20 covers every token it affects.
const USER_REVOKE_TTL_SECONDS = 20 * 60

export const sessionStore = {
  /** Invalidate every access token already issued to this user (suspend, force logout, password change). */
  async revokeAllForUser(userId: string) {
    const at = Date.now()
    try {
      await redis.set(`user-revoked:${userId}`, String(at), 'EX', USER_REVOKE_TTL_SECONDS)
    } catch {
      memUserRevoked.set(userId, at)
    }
  },

  /** Time (ms) after which this user's tokens are valid again, or null. */
  async userRevokedAt(userId: string): Promise<number | null> {
    try {
      const v = await redis.get(`user-revoked:${userId}`)
      return v ? Number(v) : null
    } catch {
      const at = memUserRevoked.get(userId)
      if (!at) return null
      if (Date.now() - at > USER_REVOKE_TTL_SECONDS * 1000) {
        memUserRevoked.delete(userId)
        return null
      }
      return at
    }
  },

  // Store an active refresh token session, TTL matches token expiry (7 days)
  async set(userId: string, tokenId: string, ttlSeconds = 60 * 60 * 24 * 7) {
    try {
      await redis.set(`${SESSION_PREFIX}${tokenId}`, userId, 'EX', ttlSeconds)
    } catch {
      memSessions.set(`${SESSION_PREFIX}${tokenId}`, {
        value: userId,
        expiresAt: Date.now() + ttlSeconds * 1000,
      })
    }
  },

  // Fast lookup — is this token ID a valid active session?
  async get(tokenId: string): Promise<string | null> {
    try {
      return await redis.get(`${SESSION_PREFIX}${tokenId}`)
    } catch {
      const item = memSessions.get(`${SESSION_PREFIX}${tokenId}`)
      if (!item) return null
      if (item.expiresAt < Date.now()) {
        memSessions.delete(`${SESSION_PREFIX}${tokenId}`)
        return null
      }
      return item.value
    }
  },

  // Force-logout (Ch. 5.3) — admin invalidates instantly
  async revoke(tokenId: string) {
    try {
      await redis.del(`${SESSION_PREFIX}${tokenId}`)
      await redis.set(`${BLACKLIST_PREFIX}${tokenId}`, '1', 'EX', 60 * 60 * 24 * 7)
    } catch {
      memSessions.delete(`${SESSION_PREFIX}${tokenId}`)
      memBlacklist.set(`${BLACKLIST_PREFIX}${tokenId}`, Date.now() + 60 * 60 * 24 * 7 * 1000)
    }
  },

  async isBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const result = await redis.get(`${BLACKLIST_PREFIX}${tokenId}`)
      return result !== null
    } catch {
      const exp = memBlacklist.get(`${BLACKLIST_PREFIX}${tokenId}`)
      if (!exp) return false
      if (exp < Date.now()) {
        memBlacklist.delete(`${BLACKLIST_PREFIX}${tokenId}`)
        return false
      }
      return true
    }
  },
}