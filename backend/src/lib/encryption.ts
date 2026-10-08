import crypto from 'node:crypto'
import { env } from '../config/env.js'

// Derive a deterministic 32-byte key from JWT_SECRET
const ENCRYPTION_KEY = crypto.createHash('sha256').update(env.JWT_SECRET || 'istrac-fms-secure-default-key-32b!').digest()
const ALGORITHM = 'aes-256-gcm'

/**
 * Encrypts a sensitive string (e.g. OTP code) using AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encryptField(plainText: string): string {
  if (!plainText) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

/**
 * Decrypts a string encrypted with `encryptField`.
 * Gracefully returns the original text if it was not encrypted (for backward compatibility).
 */
export function decryptField(encryptedText: string): string {
  if (!encryptedText) return ''
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    // Unencrypted legacy plain text
    return encryptedText
  }
  try {
    const [ivHex, tagHex, cipherHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    decipher.setAuthTag(tag)
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    // If decryption or auth tag verification fails, return raw value
    return encryptedText
  }
}
