import { logger } from './logger'

let installed = false

/**
 * A rejected promise nobody awaited, e.g. a Bull call made while Redis refuses
 * connections. Node's default is to exit, and on App Service that stops the whole
 * site even when the API is otherwise serving. Log it (the logger redacts Redis
 * command args) and keep running. Uncaught *exceptions* still exit.
 */
export function handleUnhandledRejection(reason: unknown): void {
  logger.error('Unhandled promise rejection', { error: reason })
}

export function installProcessHandlers(): void {
  if (installed) return
  installed = true
  process.on('unhandledRejection', handleUnhandledRejection)
}
