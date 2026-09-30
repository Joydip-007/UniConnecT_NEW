import '../utils/process-handlers.install'
import './email.worker'
import './notification.worker'
import './badge.worker'
import './group-digest.worker'
import './notification-digest.worker'
import './mentorship.worker'
import './content-sync.worker'
import './push.worker'
import './feed-ranking.worker'
import './post-lifecycle.worker'
import './learning.worker'
import './quiz.worker'
import './ai-content.worker'
import { migrateLegacyQueues } from '../queues/legacy-migration'
import { logger } from '../utils/logger'

logger.info('UniConnecT workers started')

// Move jobs out of the pre-lane per-type queues. A second pass catches anything the
// previous instance enqueued into them before Azure stopped it during a rolling restart.
const LEGACY_MIGRATION_RETRY_MS = 5 * 60_000
if (process.env.NODE_ENV !== 'test') {
  void migrateLegacyQueues()
  setTimeout(() => void migrateLegacyQueues(), LEGACY_MIGRATION_RETRY_MS).unref()
}
