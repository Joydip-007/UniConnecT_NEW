// Imported first by each entry point (server.ts, workers/index.ts) so the handler is
// in place before any module-level Redis/Bull call can reject.
import { installProcessHandlers } from './process-handlers'

installProcessHandlers()
