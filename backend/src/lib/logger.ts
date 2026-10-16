export type LogLevel = 'debug' | 'http' | 'info' | 'warn' | 'error'

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  http: 20,
  info: 30,
  warn: 40,
  error: 50,
}

// ANSI Escape Codes for Terminal Color Formatting
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
}

function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
}

function getLevelBadge(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return `${COLORS.gray}[DEBUG]${COLORS.reset}`
    case 'http':
      return `${COLORS.brightMagenta}${COLORS.bold}[HTTP ]${COLORS.reset}`
    case 'info':
      return `${COLORS.brightCyan}${COLORS.bold}[INFO ]${COLORS.reset}`
    case 'warn':
      return `${COLORS.brightYellow}${COLORS.bold}[WARN ]${COLORS.reset}`
    case 'error':
      return `${COLORS.brightRed}${COLORS.bold}[ERROR]${COLORS.reset}`
  }
}

function formatTag(tag?: string): string {
  if (!tag) return `${COLORS.brightBlue}[ISTRAC-SIMS]${COLORS.reset}`
  return `${COLORS.brightBlue}[${tag}]${COLORS.reset}`
}

class Logger {
  private minLevelWeight: number

  constructor() {
    const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel
    this.minLevelWeight = LOG_LEVEL_WEIGHTS[configuredLevel] ?? LOG_LEVEL_WEIGHTS.info
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHTS[level] >= this.minLevelWeight
  }

  private print(level: LogLevel, tag: string | undefined, message: string, ...meta: any[]) {
    if (!this.shouldLog(level)) return

    const timeStr = `${COLORS.gray}${getTimestamp()}${COLORS.reset}`
    const levelStr = getLevelBadge(level)
    const tagStr = formatTag(tag)

    if (level === 'error') {
      console.error(`${timeStr} ${levelStr} ${tagStr} ${message}`, ...meta)
    } else if (level === 'warn') {
      console.warn(`${timeStr} ${levelStr} ${tagStr} ${message}`, ...meta)
    } else {
      console.log(`${timeStr} ${levelStr} ${tagStr} ${message}`, ...meta)
    }
  }

  public debug(tagOrMsg: string, msgOrMeta?: any, ...meta: any[]) {
    if (typeof msgOrMeta === 'string') {
      this.print('debug', tagOrMsg, msgOrMeta, ...meta)
    } else if (msgOrMeta !== undefined) {
      this.print('debug', undefined, tagOrMsg, msgOrMeta, ...meta)
    } else {
      this.print('debug', undefined, tagOrMsg)
    }
  }

  public info(tagOrMsg: string, msgOrMeta?: any, ...meta: any[]) {
    if (typeof msgOrMeta === 'string') {
      this.print('info', tagOrMsg, msgOrMeta, ...meta)
    } else if (msgOrMeta !== undefined) {
      this.print('info', undefined, tagOrMsg, msgOrMeta, ...meta)
    } else {
      this.print('info', undefined, tagOrMsg)
    }
  }

  public http(tagOrMsg: string, msgOrMeta?: any, ...meta: any[]) {
    if (typeof msgOrMeta === 'string') {
      this.print('http', tagOrMsg, msgOrMeta, ...meta)
    } else if (msgOrMeta !== undefined) {
      this.print('http', undefined, tagOrMsg, msgOrMeta, ...meta)
    } else {
      this.print('http', undefined, tagOrMsg)
    }
  }

  public warn(tagOrMsg: string, msgOrMeta?: any, ...meta: any[]) {
    if (typeof msgOrMeta === 'string') {
      this.print('warn', tagOrMsg, msgOrMeta, ...meta)
    } else if (msgOrMeta !== undefined) {
      this.print('warn', undefined, tagOrMsg, msgOrMeta, ...meta)
    } else {
      this.print('warn', undefined, tagOrMsg)
    }
  }

  public error(tagOrMsg: string, msgOrMeta?: any, ...meta: any[]) {
    if (typeof msgOrMeta === 'string') {
      this.print('error', tagOrMsg, msgOrMeta, ...meta)
    } else if (msgOrMeta !== undefined) {
      this.print('error', undefined, tagOrMsg, msgOrMeta, ...meta)
    } else {
      this.print('error', undefined, tagOrMsg)
    }
  }

  /**
   * Creates a scoped child logger with a fixed namespace tag.
   */
  public child(tag: string) {
    return {
      debug: (msg: string, ...meta: any[]) => this.debug(tag, msg, ...meta),
      info: (msg: string, ...meta: any[]) => this.info(tag, msg, ...meta),
      http: (msg: string, ...meta: any[]) => this.http(tag, msg, ...meta),
      warn: (msg: string, ...meta: any[]) => this.warn(tag, msg, ...meta),
      error: (msg: string, ...meta: any[]) => this.error(tag, msg, ...meta),
    }
  }
}

export const logger = new Logger()
