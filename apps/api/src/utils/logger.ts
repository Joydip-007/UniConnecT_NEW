type LogMeta = Record<string, unknown>

function write(level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    ...(meta ? { meta: serializeMeta(meta) } : {}),
    timestamp: new Date().toISOString(),
  }

  if (level === 'error') {
    console.error(JSON.stringify(payload))
    return
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload))
    return
  }

  console.info(JSON.stringify(payload))
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write('info', message, meta),
  warn: (message: string, meta?: LogMeta) => write('warn', message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
}

function serializeMeta(meta: LogMeta): LogMeta {
  return Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, serializeValue(value)]))
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...copyEnumerableProperties(value),
    }
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeValue(nested)]))
  }

  return value
}

function copyEnumerableProperties(value: Error) {
  const entries = Object.entries(value)
  return entries.length > 0 ? Object.fromEntries(entries) : {}
}
