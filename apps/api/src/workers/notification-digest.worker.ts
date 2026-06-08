import { db } from '../config/db'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import { emailQueue } from '../queues/email.queue'
import { notificationDigestQueue } from '../queues/notification-digest.queue'

// Daily at 03:00 UTC (= 09:00 BDT). Stable jobId prevents duplicate registration on restart.
notificationDigestQueue.add(
  {},
  {
    repeat: { cron: '0 3 * * *' },
    jobId: 'notification-daily-digest',
  },
)

interface DigestRow {
  user_id: string
  email: string
  full_name: string | null
  unread: string | number
}

notificationDigestQueue.process(async () => {
  logger.info('Notification daily digest job started')

  // Users who opted into the daily digest AND have unread notifications in the last 24h.
  const rows = await db('user_settings as us')
    .join('users as u', 'u.id', 'us.user_id')
    .leftJoin('profiles as p', 'p.user_id', 'us.user_id')
    .whereRaw("us.notification_preferences->>'emailDigest' = 'daily'")
    .andWhere('u.is_active', true)
    .select<DigestRow[]>(
      'us.user_id',
      'u.email',
      'p.full_name',
      db.raw(
        "(SELECT COUNT(*) FROM notifications n WHERE n.user_id = us.user_id AND n.is_read = false AND n.created_at >= now() - interval '24 hours') as unread",
      ),
    )

  const webUrl = env.WEB_URL
  let sent = 0

  for (const row of rows) {
    const unread = Number(row.unread)
    if (unread <= 0) continue

    await emailQueue.add({
      to: row.email,
      subject: `You have ${unread} new notification${unread === 1 ? '' : 's'} on UniConnecT`,
      html: renderDigestHtml(row.full_name ?? 'there', unread, `${webUrl}/notifications`),
    })
    sent++
  }

  logger.info('Notification daily digest job completed', { candidates: rows.length, sent })
})

notificationDigestQueue.on('failed', (job, error) => {
  logger.error('Notification digest queue job failed', { jobId: job?.id, error })
})

function renderDigestHtml(name: string, unread: number, url: string): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b1220;color:#e8ecf4;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#121a2b;border-radius:12px;padding:28px">
    <h1 style="font-size:18px;font-weight:500;margin:0 0 12px">Hi ${name},</h1>
    <p style="font-size:14px;line-height:1.6;color:#aab4c5;margin:0 0 20px">
      You have <strong style="color:#e8ecf4">${unread}</strong> unread notification${unread === 1 ? '' : 's'}
      from the last day on UniConnecT.
    </p>
    <a href="${url}" style="display:inline-block;background:#f26a21;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:999px">
      View notifications
    </a>
    <p style="font-size:12px;color:#66748c;margin:24px 0 0">
      You're receiving this because daily digests are on. Change this anytime in Settings → Notifications.
    </p>
  </div>
</body></html>`
}
