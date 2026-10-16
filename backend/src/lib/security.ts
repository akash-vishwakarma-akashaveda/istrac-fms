/**
 * SECURITY & SANITIZATION UTILITIES
 * Hardens against Stored XSS, XML External Entity (XXE) injection,
 * malicious SVG delivery, and path traversal across file/media uploads.
 */

/**
 * Scans an SVG document string for dangerous scripts, event handlers,
 * XML entities (XXE), and disallowed schemes.
 */
export function isUnsafeSvgContent(content: string): { unsafe: boolean; reason?: string } {
  if (!content || typeof content !== 'string') {
    return { unsafe: false }
  }

  // Normalize Unicode/HTML/XML entities to detect obfuscated payloads (e.g. &#106;avascript:)
  const normalized = content
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16))
      } catch {
        return ''
      }
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10))
      } catch {
        return ''
      }
    })
    .toLowerCase()

  // 1. Dangerous XML/HTML elements that can execute code or embed external contexts
  const dangerousTags = [
    /<script[\s>]/i,
    /<foreignobject[\s>]/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<applet[\s>]/i,
    /<meta[\s>]/i,
    /<base[\s>]/i,
    /<!entity[\s>]/i,
    /<!doctype[^>]+system/i,
  ]

  for (const pattern of dangerousTags) {
    if (pattern.test(normalized)) {
      return { unsafe: true, reason: 'Disallowed active tag or XML entity definition detected' }
    }
  }

  // 2. Inline event handler attributes (onload, onerror, onclick, onfocus, etc.)
  if (/\bon[a-z]+\s*=/i.test(normalized)) {
    return { unsafe: true, reason: 'Inline event handlers (on* attributes) are forbidden in SVGs' }
  }

  // 3. Dangerous URI schemes in attributes (href, xlink:href, src, formaction)
  if (/\b(?:href|xlink:href|src|action|formaction)\s*=\s*['"]?\s*(?:javascript|data|vbscript):/i.test(normalized)) {
    return { unsafe: true, reason: 'Unsafe URI scheme (javascript:, data:, vbscript:) detected' }
  }

  return { unsafe: false }
}

/**
 * Verifies magic bytes/binary headers of image uploads to prevent MIME masquerading
 * (e.g. an HTML/PHP/JS script renamed to image.png or image.jpg).
 */
export function validateImageMagicBytes(buffer: Buffer, ext: string): boolean {
  if (!buffer || buffer.length < 4) return false
  const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`

  if (cleanExt === '.png') {
    // PNG magic bytes: 89 50 4E 47 (‰PNG)
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  }

  if (cleanExt === '.jpg' || cleanExt === '.jpeg') {
    // JPEG SOI marker: FF D8 FF
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  if (cleanExt === '.gif') {
    // GIF magic: GIF87a or GIF89a
    if (buffer.length < 6) return false
    const sig = buffer.subarray(0, 6).toString('ascii')
    return sig === 'GIF87a' || sig === 'GIF89a'
  }

  if (cleanExt === '.webp') {
    // WebP: RIFF....WEBP
    if (buffer.length < 12) return false
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }

  if (cleanExt === '.svg') {
    const head = buffer.subarray(0, 2048).toString('utf8').trim()
    return head.includes('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
  }

  return true
}

/**
 * Strips directory traversal dots and dangerous path characters.
 */
export function sanitizeSafeFilename(name: string): string {
  if (!name) return 'unnamed_file'
  return (
    name
      .replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/\\/g, '/')
      .replace(/\.\.+/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^_+/, '') || 'unnamed_file'
  )
}

/**
 * Recursively cleans CMS payload strings: strips null bytes and raw <script> blocks.
 */
export function sanitizeCmsContent<T>(data: T): T {
  if (typeof data === 'string') {
    let s = data.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()
    s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    return s as unknown as T
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeCmsContent) as unknown as T
  }
  if (data !== null && typeof data === 'object') {
    const clean: Record<string, any> = {}
    for (const [k, v] of Object.entries(data)) {
      clean[k] = sanitizeCmsContent(v)
    }
    return clean as T
  }
  return data
}
