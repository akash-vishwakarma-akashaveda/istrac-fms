import DOMPurify from 'dompurify'

// ============================================================
// FRONTEND SECURITY & SANITIZATION UTILITIES
// ============================================================

/**
 * Sanitizes rich HTML content to prevent Cross-Site Scripting (XSS).
 * Useful for CMS rendering, formatted reports, and dynamic announcements.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'code', 'pre', 'blockquote', 'hr', 'br', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'id', 'aria-label'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
  })
}

/**
 * Strips path traversal characters (../, ..\, null bytes, control chars)
 * and normalizes filenames before sending them to the backend or displaying.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'unnamed_file'
  return name
    .replace(/[\x00-\x1f\x7f]/g, '') // remove ASCII control characters
    .replace(/[/\\]/g, '_')           // replace path separators
    .replace(/\.\.+/g, '.')           // remove directory traversal '..'
    .trim()
}

/**
 * Validates whether a URL is safe to navigate to or render in an <a> tag.
 * Rejects dangerous schemes like `javascript:`, `data:`, and `vbscript:`.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim().toLowerCase()

  // Disallow javascript:, vbscript:, data:, and file: schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    return false
  }

  // Relative URLs starting with '/' are safe
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true
  }

  // Absolute HTTP/HTTPS/mailto URLs
  try {
    const parsed = new URL(url, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Returns a safe href attribute or a fallback '#' if unsafe.
 */
export function safeHref(url: string | null | undefined, fallback = '#'): string {
  return isSafeUrl(url) ? url!.trim() : fallback
}

/**
 * Sanitizes search input: limits max length to 200 chars and trims excessive whitespace.
 */
export function sanitizeSearchQuery(q: string | null | undefined): string {
  if (!q) return ''
  return q.slice(0, 200).replace(/\s+/g, ' ').trim()
}
