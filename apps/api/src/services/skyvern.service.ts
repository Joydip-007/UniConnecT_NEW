import { env } from '../config/env'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

/**
 * Thin client over Skyvern's REST API for triggering and polling the
 * parameterized content-sync workflow. All HTTP shape lives here so it is the
 * single place to adjust once the live workflow is built via the Skyvern MCP.
 */

export interface SkyvernWorkflowParameters {
  /** The single listing-page URL (news, notice, or event) this run scrapes. */
  listUrl: string
  /** source_urls already ingested for this tenant — the workflow skips these. */
  knownSourceUrls: string[]
}

const TERMINAL_OK = new Set(['completed'])
const TERMINAL_FAIL = new Set(['failed', 'terminated', 'timed_out', 'canceled'])

function assertConfigured(): { apiKey: string; workflowId: string } {
  if (!env.SKYVERN_API_KEY || !env.SKYVERN_CONTENT_WORKFLOW_ID) {
    throw new AppError(
      'Skyvern is not configured. Set SKYVERN_API_KEY and SKYVERN_CONTENT_WORKFLOW_ID.',
      503,
      'SKYVERN_NOT_CONFIGURED',
    )
  }
  return { apiKey: env.SKYVERN_API_KEY, workflowId: env.SKYVERN_CONTENT_WORKFLOW_ID }
}

async function skyvernFetch(path: string, init: RequestInit, apiKey: string): Promise<unknown> {
  const response = await fetch(`${env.SKYVERN_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...init.headers,
    },
  })

  const text = await response.text()
  const json = text ? safeParse(text) : null

  if (!response.ok) {
    logger.error('Skyvern request failed', { path, status: response.status, body: text.slice(0, 500) })
    throw new AppError(`Skyvern request failed (${response.status})`, 502, 'SKYVERN_REQUEST_FAILED')
  }

  return json
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Triggers a workflow run and returns the Skyvern run id. */
export async function triggerWorkflow(params: SkyvernWorkflowParameters): Promise<string> {
  const { apiKey, workflowId } = assertConfigured()

  const result = (await skyvernFetch(
    `/api/v1/workflows/${workflowId}/run`,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          list_url: params.listUrl,
          known_source_urls: params.knownSourceUrls,
        },
      }),
    },
    apiKey,
  )) as { workflow_run_id?: string; run_id?: string } | null

  const runId = result?.workflow_run_id ?? result?.run_id
  if (!runId) {
    throw new AppError('Skyvern did not return a run id', 502, 'SKYVERN_NO_RUN_ID')
  }
  return runId
}

interface SkyvernRunResponse {
  status?: string
  output?: unknown
  outputs?: unknown
}

/** Polls a run until it reaches a terminal state, then returns its raw output payload. */
export async function pollRun(runId: string): Promise<unknown> {
  const { apiKey, workflowId } = assertConfigured()
  const deadline = Date.now() + env.SKYVERN_RUN_TIMEOUT_MS
  const intervalMs = 5000

  // Loop is intentionally sequential: poll → wait → poll until terminal or timeout.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const run = (await skyvernFetch(
      `/api/v1/workflows/${workflowId}/runs/${runId}`,
      { method: 'GET' },
      apiKey,
    )) as SkyvernRunResponse | null

    const status = run?.status ?? 'unknown'

    if (TERMINAL_OK.has(status)) {
      return run?.output ?? run?.outputs ?? null
    }
    if (TERMINAL_FAIL.has(status)) {
      throw new AppError(`Skyvern run ended with status "${status}"`, 502, 'SKYVERN_RUN_FAILED')
    }
    if (Date.now() > deadline) {
      throw new AppError('Skyvern run timed out', 504, 'SKYVERN_RUN_TIMEOUT')
    }

    await delay(intervalMs)
  }
}

export function isSkyvernConfigured(): boolean {
  return Boolean(env.SKYVERN_API_KEY && env.SKYVERN_CONTENT_WORKFLOW_ID)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const skyvernService = { triggerWorkflow, pollRun, isSkyvernConfigured }
